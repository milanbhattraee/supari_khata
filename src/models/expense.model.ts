import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const ExpenseSchema = new Schema(
  {
    amount: {
      type: mongoose.Types.Decimal128,
      required: [true, "Expense amount is required"],
      min: [0, "Amount cannot be negative"],
      get: (v: mongoose.Types.Decimal128) => (v ? parseFloat(v.toString()) : 0.0),
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Database indexes for optimizing common queries
ExpenseSchema.index({ date: -1 }); // Recent expenses

export default models.Expense || model("Expense", ExpenseSchema);
