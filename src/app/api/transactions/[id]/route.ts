import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdateTransactionDTO } from "@/types/dto";
import mongoose from "mongoose";
import { roundMoney } from "@/lib/financial";
import { toTransactionDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/transactions/:id ─────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const transaction = await Transaction.findById(id)
      .populate("partyId", "name category")
      .populate("productId", "name unit")
      .lean();

    if (!transaction) return notFoundResponse("Transaction");

    return successResponse(
      toTransactionDTO(transaction as Record<string, unknown>),
      "Transaction fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/transactions/:id ─────────────────────────────────
// Editable fields: notes, date, paidAmount, ratePerKg, quantity
// Immutable fields: totalAmount, type, partyId, productId

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdateTransactionDTO> = await req.json();

    // Prevent edits to truly immutable fields
    const immutableFields = ["totalAmount", "type", "partyId", "productId"];
    for (const field of immutableFields) {
      if (field in body) {
        return badRequestResponse(
          `Field "${field}" cannot be modified after a transaction is created.`
        );
      }
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) return notFoundResponse("Transaction");

    // Calculate the effective quantity and rate for validation
    const oldQty = parseFloat(transaction.quantity.toString());
    const newQty = body.quantity !== undefined ? roundMoney(body.quantity) : oldQty;
    const newRate = body.ratePerKg !== undefined
      ? roundMoney(body.ratePerKg)
      : parseFloat(transaction.ratePerKg.toString());
    const newTotal = roundMoney(newQty * newRate);

    // If paidAmount is being updated, validate against new total
    if (body.paidAmount !== undefined) {
      if (typeof body.paidAmount !== "number" || !Number.isFinite(body.paidAmount)) {
        return badRequestResponse("Paid amount must be a valid number");
      }

      if (body.paidAmount < 0) {
        return badRequestResponse("Paid amount cannot be negative");
      }

      const nextPaid = roundMoney(body.paidAmount);
      if (nextPaid > newTotal) {
        return badRequestResponse(
          `Paid amount cannot exceed total bill of ${newTotal}`
        );
      }
      transaction.paidAmount = mongoose.Types.Decimal128.fromString(
        nextPaid.toFixed(2)
      );
    }

    // If ratePerKg is being updated, validate and set
    if (body.ratePerKg !== undefined) {
      if (typeof body.ratePerKg !== "number" || !Number.isFinite(body.ratePerKg)) {
        return badRequestResponse("Rate per kg must be a valid number");
      }

      if (body.ratePerKg < 0) {
        return badRequestResponse("Rate per kg cannot be negative");
      }

      transaction.ratePerKg = mongoose.Types.Decimal128.fromString(
        newRate.toFixed(2)
      );

      // Validate paidAmount doesn't exceed new total (if paidAmount wasn't also updated)
      if (body.paidAmount === undefined) {
        const currentPaid = parseFloat(transaction.paidAmount.toString());
        if (currentPaid > newTotal) {
          return badRequestResponse(
            `Cannot reduce rate: paid amount (${currentPaid}) would exceed new total (${newTotal})`
          );
        }
      }
    }

    // If quantity is being updated, handle stock adjustment
    if (body.quantity !== undefined) {
      if (typeof body.quantity !== "number" || !Number.isFinite(body.quantity)) {
        return badRequestResponse("Quantity must be a valid number");
      }

      if (body.quantity <= 0) {
        return badRequestResponse("Quantity must be greater than 0");
      }

      const Product = (await import("@/models/product.model")).default;
      const product = await Product.findById(transaction.productId);
      if (!product) {
        return badRequestResponse("Associated product not found");
      }

      const currentStock = parseFloat(product.currentStock.toString());
      const qtyDiff = newQty - oldQty;

      if (transaction.type === "purchase") {
        // Purchase: increasing qty adds more stock, decreasing removes stock
        const newStock = currentStock + qtyDiff;
        if (newStock < 0) {
          return badRequestResponse(
            `Cannot reduce quantity: would result in negative stock (current: ${roundMoney(currentStock)}, change: ${roundMoney(qtyDiff)})`
          );
        }
        product.currentStock = mongoose.Types.Decimal128.fromString(
          roundMoney(newStock).toFixed(3)
        );
      } else if (transaction.type === "sale") {
        // Sale: increasing qty removes more stock, decreasing adds stock back
        const newStock = currentStock - qtyDiff;
        if (newStock < 0) {
          return badRequestResponse(
            `Cannot increase quantity: insufficient stock (current: ${roundMoney(currentStock)}, needed: ${roundMoney(qtyDiff)})`
          );
        }
        product.currentStock = mongoose.Types.Decimal128.fromString(
          roundMoney(newStock).toFixed(3)
        );
      }

      await product.save();

      transaction.quantity = mongoose.Types.Decimal128.fromString(
        newQty.toFixed(3)
      );

      // Validate paidAmount doesn't exceed new total (if paidAmount wasn't also updated)
      if (body.paidAmount === undefined) {
        const currentPaid = parseFloat(transaction.paidAmount.toString());
        if (currentPaid > newTotal) {
          return badRequestResponse(
            `Cannot reduce quantity: paid amount (${currentPaid}) would exceed new total (${newTotal})`
          );
        }
      }
    }

    if (body.notes !== undefined) transaction.notes = body.notes;
    if (body.date !== undefined) {
      const parsedDate = new Date(body.date);
      if (isNaN(parsedDate.getTime())) {
        return badRequestResponse("Invalid date format");
      }
      transaction.date = parsedDate;
    }

    // Save lets model middleware keep total and balance math authoritative.
    await transaction.save({ validateBeforeSave: false });

    const updated = await Transaction.findById(id)
      .populate("partyId", "name category")
      .populate("productId", "name unit")
      .lean();

    return successResponse(
      toTransactionDTO(updated as Record<string, unknown>),
      "Transaction updated"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/transactions/:id ──────────────────────────────
// Deletes a transaction and reverses its effects:
// - Reverses stock changes (purchase: subtract, sale: add back)
// - Deletes all linked payments
// - Blocks deletion if it would cause negative stock

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    // 1. Find transaction with product details
    const transaction = await Transaction.findById(id);
    if (!transaction) return notFoundResponse("Transaction");

    const Product = (await import("@/models/product.model")).default;
    const Payment = (await import("@/models/payment.model")).default;

    const product = await Product.findById(transaction.productId);
    if (!product) {
      return badRequestResponse("Associated product not found");
    }

    const quantity = parseFloat(transaction.quantity.toString());
    const currentStock = parseFloat(product.currentStock.toString());

    // 2. Validate stock won't go negative (for purchase deletion)
    if (transaction.type === "purchase") {
      if (currentStock < quantity) {
        return badRequestResponse(
          `Cannot delete: would result in negative stock (current: ${roundMoney(currentStock)} ${product.unit}, removing: ${roundMoney(quantity)} ${product.unit}). Delete related sales first.`
        );
      }
    }

    // 3. Delete all linked payments (cascade delete)
    const deletedPayments = await Payment.deleteMany({ transactionId: id });

    // 4. Reverse stock changes
    if (transaction.type === "purchase") {
      // Purchase added stock → subtract it back
      product.currentStock = mongoose.Types.Decimal128.fromString(
        roundMoney(currentStock - quantity).toFixed(3)
      );
    } else if (transaction.type === "sale") {
      // Sale removed stock → add it back
      product.currentStock = mongoose.Types.Decimal128.fromString(
        roundMoney(currentStock + quantity).toFixed(3)
      );
    }
    await product.save();

    // 5. Delete the transaction
    await Transaction.deleteOne({ _id: id });

    const message = deletedPayments.deletedCount > 0
      ? `Transaction deleted (${deletedPayments.deletedCount} linked payment(s) also removed)`
      : "Transaction deleted successfully";

    return successResponse(null, message);
  } catch (err) {
    return handleApiError(err);
  }
}