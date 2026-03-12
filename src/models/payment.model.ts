import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// Standalone payments — when a party settles old dues without a new transaction
const PaymentSchema = new Schema(
  {
    partyId: {
      type: Schema.Types.ObjectId,
      ref: "Party",
      required: true,
    },
    amount: {
      type: mongoose.Types.Decimal128,
      required: [true, "Payment amount is required"],
      get: (v:mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    // "cash" | "bank_transfer" | "cheque" | "upi"
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "upi", "other"],
      default: "cash",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    referenceNumber: {
      type: String,
      trim: true, // cheque no. / UTR no. / transaction ID
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

export default models.Payment || model("Payment", PaymentSchema);