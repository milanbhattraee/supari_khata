import mongoose, { Document, Schema, Types } from "mongoose";
import Product from "./product.model";

export interface ITransaction extends Document {
  type: "purchase" | "sale";
  partyId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: number;
  ratePerKg: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ["purchase", "sale"],
      required: [true, "Transaction type is required"],
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      required: [true, "Party is required"],
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    // Quantity in KG
    quantity: {
      type: mongoose.Types.Decimal128,
      required: true,
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          return parseFloat(v.toString()) >= 0;
        },
        message: "Quantity cannot be negative",
      },
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Market rate on this specific day — locked at time of transaction
    ratePerKg: {
      type: mongoose.Types.Decimal128,
      required: true,
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          return parseFloat(v.toString()) >= 0;
        },
        message: "Rate per KG cannot be negative",
      },
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Auto-calculated: quantity * ratePerKg
    totalAmount: {
      type: mongoose.Types.Decimal128,
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          return parseFloat(v.toString()) >= 0;
        },
        message: "Total amount cannot be negative",
      },
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // How much was paid at the time (0 = full credit/due)
    paidAmount: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          return parseFloat(v.toString()) >= 0;
        },
        message: "Paid amount cannot be negative",
      },
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Auto-calculated: totalAmount - paidAmount
    balanceAmount: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          return parseFloat(v.toString()) >= 0;
        },
        message: "Balance amount cannot be negative",
      },
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
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
TransactionSchema.index({ partyId: 1, date: -1 }); // Party transactions sorted by date
TransactionSchema.index({ productId: 1, date: -1 }); // Product transactions sorted by date
TransactionSchema.index({ date: -1 }); // Recent transactions
TransactionSchema.index({ type: 1, date: -1 }); // Transactions by type
TransactionSchema.index({ partyId: 1, type: 1 }); // Party transactions by type (for aggregations)

// ─── PRE-SAVE MIDDLEWARE ─────────────────────────────────────────────────────

TransactionSchema.pre("save", async function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = this as any;

  // ── 1. Always recalculate totalAmount and balanceAmount on every save.
  const qty  = parseFloat(doc.quantity.toString());
  const rate = parseFloat(doc.ratePerKg.toString());
  const paid = parseFloat(doc.paidAmount.toString());

  const total = qty * rate;
  doc.totalAmount   = mongoose.Types.Decimal128.fromString(total.toFixed(2));
  doc.balanceAmount = mongoose.Types.Decimal128.fromString((total - paid).toFixed(2));

  // ── 2. Stock adjustment — only on NEW documents.
  if (!this.isNew) return;

  const product = await Product.findById(doc.productId);
  if (!product) throw new Error("Product not found");

  const currentStock = parseFloat(product.currentStock.toString());

  if (doc.type === "purchase") {
    product.currentStock = mongoose.Types.Decimal128.fromString(
      (currentStock + qty).toFixed(3)
    );
  } else if (doc.type === "sale") {
    if (currentStock < qty) {
      throw new Error(
        `Insufficient stock. Available: ${currentStock} kg, Requested: ${qty} kg`
      );
    }
    product.currentStock = mongoose.Types.Decimal128.fromString(
      (currentStock - qty).toFixed(3)
    );
  }

  await product.save();
});

const TransactionModel =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default TransactionModel;