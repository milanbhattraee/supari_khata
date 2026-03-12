import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdateTransactionDTO, TransactionResponseDTO } from "@/types/dto";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

function toTransactionDTO(t: Record<string, unknown>): TransactionResponseDTO {
  const party = t.partyId as Record<string, unknown>;
  const product = t.productId as Record<string, unknown>;

  return {
    _id: (t._id as { toString(): string }).toString(),
    type: t.type as TransactionResponseDTO["type"],
    party: {
      _id: (party._id as { toString(): string }).toString(),
      name: party.name as string,
      category: party.category as TransactionResponseDTO["party"]["category"],
    },
    product: {
      _id: (product._id as { toString(): string }).toString(),
      name: product.name as string,
      unit: product.unit as TransactionResponseDTO["product"]["unit"],
    },
    quantity: parseFloat((t.quantity as mongoose.Types.Decimal128).toString()),
    ratePerKg: parseFloat((t.ratePerKg as mongoose.Types.Decimal128).toString()),
    totalAmount: parseFloat((t.totalAmount as mongoose.Types.Decimal128).toString()),
    paidAmount: parseFloat((t.paidAmount as mongoose.Types.Decimal128).toString()),
    balanceAmount: parseFloat((t.balanceAmount as mongoose.Types.Decimal128).toString()),
    date: (t.date as Date).toISOString(),
    notes: (t.notes as string) ?? null,
    createdAt: (t.createdAt as Date).toISOString(),
    updatedAt: (t.updatedAt as Date).toISOString(),
  };
}

// ── GET /api/transactions/:id ─────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
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

    // If paidAmount is being updated, recalculate balanceAmount
    if (body.paidAmount !== undefined) {
      const total = parseFloat(transaction.totalAmount.toString());
      if (body.paidAmount > total) {
        return badRequestResponse(
          `Paid amount cannot exceed total bill of ${total}`
        );
      }
      transaction.paidAmount = mongoose.Types.Decimal128.fromString(
        String(body.paidAmount)
      );
      transaction.balanceAmount = mongoose.Types.Decimal128.fromString(
        String(total - body.paidAmount)
      );
    }

    if (body.notes !== undefined) transaction.notes = body.notes;
    if (body.date !== undefined) transaction.date = new Date(body.date);

    // Use save with { validateBeforeSave: false } to skip pre-save stock logic
    // (we only want that on initial creation)
    await Transaction.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.date !== undefined && { date: new Date(body.date) }),
          ...(body.paidAmount !== undefined && {
            paidAmount: mongoose.Types.Decimal128.fromString(String(body.paidAmount)),
            balanceAmount: mongoose.Types.Decimal128.fromString(
              String(
                parseFloat(transaction.totalAmount.toString()) - body.paidAmount
              )
            ),
          }),
        },
      },
      { new: true }
    );

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