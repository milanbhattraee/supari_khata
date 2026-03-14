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
import { CreateTransactionDTO, TransactionQueryDTO } from "@/types/dto";
import mongoose from "mongoose";
import { toTransactionDTO } from "@/lib/dto-mappers";
import { centsToMoneyString, toMoneyCents } from "@/lib/financial";
import { requireApiAuth } from "@/lib/api-auth";
import { buildUtcDateRange } from "@/lib/nepal-date-range";

// ── GET /api/transactions ─────────────────────────────────────
// Supports: type, partyId, productId, fromDate, toDate, page, limit

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const query = Object.fromEntries(searchParams.entries()) as TransactionQueryDTO;

    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.partyId) filter.partyId = new mongoose.Types.ObjectId(query.partyId);
    if (query.productId) filter.productId = new mongoose.Types.ObjectId(query.productId);
    const dateRange = buildUtcDateRange(query.fromDate, query.toDate);
    if (dateRange) filter.date = dateRange;

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
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreateTransactionDTO> = await req.json();

    const validation = validateCreateTransaction(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    // Validate paidAmount doesn't exceed total (pre-check before hitting DB)
    // Full validation in pre-save, but this gives a cleaner error message
    if (body.paidAmount) {
      const estimatedTotalCents = toMoneyCents(body.quantity! * body.ratePerKg!);
      const paidAmountCents = toMoneyCents(body.paidAmount);
      if (paidAmountCents > estimatedTotalCents) {
        return validationErrorResponse({
          paidAmount: `Paid amount (${centsToMoneyString(
            paidAmountCents
          )}) cannot exceed total bill (${centsToMoneyString(estimatedTotalCents)})`,
        });
      }
    }

    const session = await mongoose.startSession();
    let transactionId: mongoose.Types.ObjectId | null = null;

    try {
      await session.withTransaction(async () => {
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
        }).save({ session }); // triggers pre-save middleware using the same session

        transactionId = transaction._id as mongoose.Types.ObjectId;
      });
    } finally {
      await session.endSession();
    }

    if (!transactionId) {
      throw new Error("Transaction creation failed");
    }

    const populated = await Transaction.findById(transactionId)
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