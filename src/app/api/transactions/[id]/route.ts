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
// Only editable fields: notes, date, paidAmount
// Core financial fields (qty, rate) are immutable after creation

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdateTransactionDTO> = await req.json();

    // Prevent edits to financial core
    const immutableFields = ["quantity", "ratePerKg", "totalAmount", "type", "partyId", "productId"];
    for (const field of immutableFields) {
      if (field in body) {
        return badRequestResponse(
          `Field "${field}" cannot be modified after a transaction is created.`
        );
      }
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) return notFoundResponse("Transaction");

    // If paidAmount is being updated, validate on rounded monetary value first.
    if (body.paidAmount !== undefined) {
      if (typeof body.paidAmount !== "number" || !Number.isFinite(body.paidAmount)) {
        return badRequestResponse("Paid amount must be a valid number");
      }

      if (body.paidAmount < 0) {
        return badRequestResponse("Paid amount cannot be negative");
      }

      const total = parseFloat(transaction.totalAmount.toString());
      const nextPaid = roundMoney(body.paidAmount);
      if (nextPaid > total) {
        return badRequestResponse(
          `Paid amount cannot exceed total bill of ${total}`
        );
      }
      transaction.paidAmount = mongoose.Types.Decimal128.fromString(
        nextPaid.toFixed(2)
      );
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
// Hard delete is blocked for financial integrity.
// Only allow soft flag via isVoided if needed in future.

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    void params;
    // Financial transactions should not be deleted in production.
    // Return a clear message explaining why.
    return badRequestResponse(
      "Transactions cannot be deleted to preserve financial integrity. Contact admin if a correction is needed."
    );
  } catch (err) {
    return handleApiError(err);
  }
}