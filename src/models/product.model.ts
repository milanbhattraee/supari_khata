import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  name: string;
  unit: "kg" | "quintal";
  currentStock: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      unique: true,
      // e.g., "Raw Betel Nut", "Sliced Supari", "Processed Supari"
    },
    unit: {
      type: String,
      enum: ["kg", "quintal"],
      default: "kg",
    },
    // Always reflects the live, current stock quantity
    currentStock: {
      type: mongoose.Types.Decimal128,
      default: 0.0,
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    description: {
      type: String,
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
// name already has unique index
ProductSchema.index({ isActive: 1, name: 1 }); // Active products sorted by name

const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default ProductModel;