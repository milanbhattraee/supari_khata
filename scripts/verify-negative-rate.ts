import assert from "assert";
import mongoose from "mongoose";
import TransactionModel from "../src/models/transaction.model";

async function verifyNegativeRate() {
  console.log("Running validation test for negative ratePerKg...");

  // Create a dummy transaction document with a negative rate
  const txn = new TransactionModel({
    type: "purchase",
    partyId: new mongoose.Types.ObjectId(),
    productId: new mongoose.Types.ObjectId(),
    quantity: 10,
    ratePerKg: -15.5, // Intentionally negative rate
    paidAmount: 0,
  });

  // validateSync() checks schema limits without needing a DB connection
  const validationError = txn.validateSync();

  // 1. Assert that an error is thrown
  assert(validationError !== undefined, "Expected a validation error but got undefined.");

  // 2. Assert that the specific property 'ratePerKg' threw the error
  const rateError = validationError.errors["ratePerKg"];
  assert(rateError !== undefined, "Expected a validation error specifically for 'ratePerKg'.");

  // 3. Assert that the error message matches the one defined in the schema
  assert(
    rateError.message === "Rate per KG cannot be negative",
    `Expected error message "Rate per KG cannot be negative", but got "${rateError.message}"`
  );

  console.log("✅ Success: The schema correctly blocks negative rate transactions.");
}

verifyNegativeRate().catch((err) => {
  console.error("❌ Test failed:");
  console.error(err);
  process.exit(1);
});
