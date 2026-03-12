import mongoose, { Document, Schema, Types } from "mongoose";

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
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Market rate on this specific day — locked at time of transaction
    ratePerKg: {
      type: mongoose.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Auto-calculated: quantity * ratePerKg
    totalAmount: {
      type: mongoose.Types.Decimal128,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // How much was paid at the time (0 = full credit/due)
    paidAmount: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // Auto-calculated: totalAmount - paidAmount
    balanceAmount: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
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

// ─── PRE-SAVE MIDDLEWARE ─────────────────────────────────────────────────────

TransactionSchema.pre("save", async function () {
  const doc = this as unknown as ITransaction;
  const Product = mongoose.model("Product");

  // 1. Auto-calculate totalAmount and balanceAmount
  const qty = parseFloat(doc.quantity.toString());
  const rate = parseFloat(doc.ratePerKg.toString());
  const paid = parseFloat(doc.paidAmount.toString());

  const total = qty * rate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (this as any).totalAmount = mongoose.Types.Decimal128.fromString(total.toFixed(2));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (this as any).balanceAmount = mongoose.Types.Decimal128.fromString(
    (total - paid).toFixed(2)
  );

  // 2. Update stock in Product collection
  const product = await Product.findById(doc.productId);
  if (!product) throw new Error("Product not found");

  const currentStock = parseFloat(product.currentStock.toString());

  if (doc.type === "purchase") {
    // Buying raw nuts → stock increases
    product.currentStock = mongoose.Types.Decimal128.fromString(
      (currentStock + qty).toFixed(3)
    );
  } else if (doc.type === "sale") {
    // Selling → stock decreases
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