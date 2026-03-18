import mongoose, { Document, Model, Schema } from "mongoose";
import { calculatePartyOutstanding, roundMoney } from "@/lib/financial";
import TransactionModel from "./transaction.model";
import PaymentModel from "./payment.model";

export interface IParty extends Document {
  name: string;
  phone?: string;
  address?: string;
  category: "supplier" | "customer" | "both";
  openingBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Return type for getOutstandingBalance ─────────────────────────────────────
// Returns both gross sides independently (receivable / payable) AND a net figure.
// For "both"-category parties the old single-number net would silently cancel
// real obligations on both sides — this makes each side visible.
export interface IOutstandingBalance {
  receivable: number; // what this party owes YOU  (positive = they owe you)
  payable: number;    // what YOU owe this party   (positive = you owe them)
  net: number;        // receivable − payable  (positive = net in your favour)
  openingBalance: number;
  totalSalesDue: number;
  totalPurchasesDue: number;
  totalPayIn: number;
  totalPayout: number;
  totalStandalonePayments: number;
}

export interface IPartyModel extends Model<IParty> {
  getOutstandingBalance(partyId: string): Promise<IOutstandingBalance>;
}

const PartySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Party name is required"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    // "supplier" | "customer" | "both"
    category: {
      type: String,
      enum: ["supplier", "customer", "both"],
      required: true,
      default: "both",
    },
    // Positive = party owes YOU money (they are in debt to you)
    // Negative = YOU owe the party money (e.g., advance paid to supplier)
    openingBalance: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ─── DATABASE INDEXES ───────────────────────────────────────────────────────
// Indexes for optimizing common queries
PartySchema.index({ isActive: 1, name: 1 }); // Active parties sorted by name
PartySchema.index({ category: 1, isActive: 1 }); // Parties by category

// ── Static: calculate outstanding balance for a single party ─────────────────
// Returns { receivable, payable, net } where:
//   net > 0  => party owes YOU (to-receive)
//   net < 0  => YOU owe party (to-pay)
//
// Net is computed directly so overpayments/advances flip the direction correctly:
//   net = openingBalance + saleBalance − purchaseBalance − payin + payout
//
// "Standalone" payments = those not linked to a specific transaction.
// Linked payments already reduced balanceAmount on their transaction via pre-save,
// so they must NOT be included here (would be double-counted).
PartySchema.statics.getOutstandingBalance = async function (
  partyId: string
): Promise<IOutstandingBalance> {
  const party = await this.findById(partyId).lean();
  if (!party) throw new Error("Party not found");

  // Sum of all unpaid amounts from transactions — grouped by type
  const txnResult = await TransactionModel.aggregate([
    { $match: { partyId: new mongoose.Types.ObjectId(partyId) } },
    {
      $group: {
        _id: "$type",
        totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
      },
    },
  ]);

  // Sum of all standalone payments (not linked to a transaction)
  const paymentResult = await PaymentModel.aggregate([
    {
      $match: {
        partyId: new mongoose.Types.ObjectId(partyId),
        $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
      },
    },
    {
      $group: {
        _id: "$direction",
        totalAmount: { $sum: { $toDouble: "$amount" } },
      },
    },
  ]);

  // Raw Decimal128 from lean() — getters don't fire
  const raw = (party as unknown as Record<string, unknown>).openingBalance;
  const openingBal =
    raw instanceof mongoose.Types.Decimal128
      ? parseFloat(raw.toString())
      : typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : 0;

  const saleBalance     = txnResult.find((t: { _id: string }) => t._id === "sale")?.totalBalance      ?? 0;
  const purchaseBalance = txnResult.find((t: { _id: string }) => t._id === "purchase")?.totalBalance  ?? 0;
  const totalPayIn      = paymentResult.find((p: { _id: string }) => p._id === "payin")?.totalAmount  ?? 0;
  const totalPayout     = paymentResult.find((p: { _id: string }) => p._id === "payout")?.totalAmount ?? 0;

  // Guard against any non-finite values creeping in from aggregates
  const safe = (n: unknown) => (Number.isFinite(n as number) ? (n as number) : 0);

  const saleBalSafe     = safe(saleBalance);
  const purchaseBalSafe = safe(purchaseBalance);
  const payInSafe       = safe(totalPayIn);
  const payoutSafe      = safe(totalPayout);

  const outstanding = calculatePartyOutstanding({
    openingBalance: openingBal,
    totalSalesDue: saleBalSafe,
    totalPurchasesDue: purchaseBalSafe,
    totalPayIn: payInSafe,
    totalPayout: payoutSafe,
  });

  return {
    ...outstanding,
    openingBalance: roundMoney(openingBal),
    totalSalesDue: roundMoney(saleBalSafe),
    totalPurchasesDue: roundMoney(purchaseBalSafe),
    totalPayIn: roundMoney(payInSafe),
    totalPayout: roundMoney(payoutSafe),
    totalStandalonePayments: roundMoney(payInSafe - payoutSafe),
  };
};

const PartyModel =
  (mongoose.models.Party as IPartyModel) ||
  mongoose.model<IParty, IPartyModel>("Party", PartySchema);

export default PartyModel;