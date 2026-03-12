import mongoose, { Document, Model, Schema } from "mongoose";

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

export interface IPartyModel extends Model<IParty> {
  getOutstandingBalance(partyId: string): Promise<number>;
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

// Virtual: calculate total outstanding balance dynamically via aggregation
// Usage: Call Party.getOutstandingBalance(partyId) from your API route
PartySchema.statics.getOutstandingBalance = async function (partyId) {
  const Transaction = mongoose.model("Transaction");
  const Payment = mongoose.model("Payment");

  const party = await this.findById(partyId).lean();
  if (!party) throw new Error("Party not found");

  // Sum of all unpaid amounts from transactions — grouped by type
  const txnResult = await Transaction.aggregate([
    { $match: { partyId: new mongoose.Types.ObjectId(partyId) } },
    {
      $group: {
        _id: "$type",
        totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
      },
    },
  ]);

  // Sum of all standalone payments made
  const paymentResult = await Payment.aggregate([
    { $match: { partyId: new mongoose.Types.ObjectId(partyId) } },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: { $toDouble: "$amount" } },
      },
    },
  ]);

  const openingBal = parseFloat(party.openingBalance.toString());
  const saleBalance = txnResult.find((t: { _id: string }) => t._id === "sale")?.totalBalance ?? 0;
  const purchaseBalance = txnResult.find((t: { _id: string }) => t._id === "purchase")?.totalBalance ?? 0;
  const totalPaid = paymentResult[0]?.totalPaid ?? 0;

  // Positive = party owes you (sales due) | Negative = you owe party (purchases due)
  // Payments always reduce the outstanding (party settling dues)
  return openingBal + saleBalance - purchaseBalance - totalPaid;
};

const PartyModel =
  (mongoose.models.Party as IPartyModel) ||
  mongoose.model<IParty, IPartyModel>("Party", PartySchema);

export default PartyModel;