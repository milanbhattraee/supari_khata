import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateTransaction } from "@/lib/validators";
import { CreateTransactionDTO, TransactionResponseDTO, TransactionQueryDTO } from "@/types/dto";
import mongoose from "mongoose";

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

// ── GET /api/transactions ─────────────────────────────────────
// Supports: type, partyId, productId, fromDate, toDate, page, limit

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const query = Object.fromEntries(searchParams.entries()) as TransactionQueryDTO;

    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.partyId) filter.partyId = new mongoose.Types.ObjectId(query.partyId);
    if (query.productId) filter.productId = new mongoose.Types.ObjectId(query.productId);
    if (query.fromDate || query.toDate) {
      filter.date = {
        ...(query.fromDate && { $gte: new Date(query.fromDate) }),
        ...(query.toDate && { $lte: new Date(query.toDate) }),
      };
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("partyId", "name category")
        .populate("productId", "name unit")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return successResponse(
      transactions.map((t) => toTransactionDTO(t as Record<string, unknown>)),
      "Transactions fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/transactions ────────────────────────────────────
// Pre-save middleware on the model handles:
//   1. Calculating totalAmount and balanceAmount
//   2. Updating product stock

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body: Partial<CreateTransactionDTO> = await req.json();

    const validation = validateCreateTransaction(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    // Validate paidAmount doesn't exceed total (pre-check before hitting DB)
    // Full validation in pre-save, but this gives a cleaner error message
    if (body.paidAmount) {
      const estimatedTotal = body.quantity! * body.ratePerKg!;
      if (body.paidAmount > estimatedTotal) {
        return validationErrorResponse({
          paidAmount: `Paid amount (${body.paidAmount}) cannot exceed total bill (${estimatedTotal})`,
        });
      }
    }

    const transaction = await new Transaction({
      type: body.type,
      partyId: body.partyId,
      productId: body.productId,
      quantity: mongoose.Types.Decimal128.fromString(String(body.quantity)),
      ratePerKg: mongoose.Types.Decimal128.fromString(String(body.ratePerKg)),
      paidAmount: mongoose.Types.Decimal128.fromString(
        String(body.paidAmount ?? 0)
      ),
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes?.trim(),
    }).save(); // triggers pre-save middleware

    const populated = await Transaction.findById(transaction._id)
      .populate("partyId", "name category")
      .populate("productId", "name unit")
      .lean();

    return createdResponse(
      toTransactionDTO(populated as Record<string, unknown>),
      "Transaction recorded successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}