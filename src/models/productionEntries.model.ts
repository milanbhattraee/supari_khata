import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProductionEntry extends Document {
  inputProductId: Types.ObjectId;
  inputQuantity: number;
  outputProductId: Types.ObjectId;
  outputQuantity: number;
  date: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Records the conversion of Raw Betel Nut → Processed/Sliced Supari
const ProductionEntrySchema: Schema = new Schema(
  {
    inputProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true, // e.g., "Raw Betel Nut"
    },
    inputQuantity: {
      type: mongoose.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    outputProductId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true, // e.g., "Sliced Supari"
    },
    outputQuantity: {
      type: mongoose.Types.Decimal128,
      required: true,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// ── PRE-SAVE MIDDLEWARE ───────────────────────────────────────────────────────
// Deduct raw input stock and add processed output stock.
//
// Only runs on NEW documents — if you ever update notes/date on an existing
// entry we must NOT move stock again (it already moved on creation).
//
// Session-aware: if the caller wraps this in a mongoose session/transaction,
// both product saves participate in the same atomic operation. If either throws,
// the whole session can be aborted and no stock is permanently changed.
ProductionEntrySchema.pre("save", async function () {
  // Only adjust stock when creating a new entry, not on subsequent updates
  if (!this.isNew) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = this as any;
  const Product = mongoose.model("Product");

  // Thread the caller's session through so saves are atomic
  const session = this.$session();
  const findOptions = session ? { session } : {};

  const inputProduct  = await Product.findById(doc.inputProductId,  null, findOptions);
  const outputProduct = await Product.findById(doc.outputProductId, null, findOptions);

  if (!inputProduct || !outputProduct)
    throw new Error("Product(s) not found");

  const inputQty  = parseFloat(doc.inputQuantity.toString());
  const outputQty = parseFloat(doc.outputQuantity.toString());
  const rawStock  = parseFloat(inputProduct.currentStock.toString());

  if (rawStock < inputQty)
    throw new Error(`Insufficient raw stock: ${rawStock} kg available`);

  inputProduct.currentStock = mongoose.Types.Decimal128.fromString(
    (rawStock - inputQty).toFixed(3)
  );
  outputProduct.currentStock = mongoose.Types.Decimal128.fromString(
    (parseFloat(outputProduct.currentStock.toString()) + outputQty).toFixed(3)
  );

  // Both product saves share the session — either both commit or both roll back
  await inputProduct.save(session  ? { session } : {});
  await outputProduct.save(session ? { session } : {});
});

const ProductionEntryModel =
  mongoose.models.ProductionEntry ||
  mongoose.model<IProductionEntry>("ProductionEntry", ProductionEntrySchema);

export default ProductionEntryModel;