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
// Supports: type, partyId, productId, fromDate, toDate, search, page, limit

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

    // Handle search - search by party name or product name
    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");

      // Find matching party IDs
      const Party = (await import("@/models/parties.model")).default;
      const matchingParties = await Party.find({ name: searchRegex }).select("_id").lean();
      const partyIds = matchingParties.map((p) => p._id);

      // Find matching product IDs
      const Product = (await import("@/models/product.model")).default;
      const matchingProducts = await Product.find({ name: searchRegex }).select("_id").lean();
      const productIds = matchingProducts.map((p) => p._id);

      // Filter transactions where party OR product matches
      if (partyIds.length > 0 || productIds.length > 0) {
        const orConditions: Record<string, unknown>[] = [];
        if (partyIds.length > 0) {
          orConditions.push({ partyId: { $in: partyIds } });
        }
        if (productIds.length > 0) {
          orConditions.push({ productId: { $in: productIds } });
        }
        filter.$or = orConditions;
      } else {
        // No matches found, return empty result
        return successResponse([], "Transactions fetched", 200, buildMeta(0, page, limit));
      }
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
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreateTransactionDTO> = await req.json();

    const validation = validateCreateTransaction(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    // Validate paidAmount doesn't exceed total (pre-check before hitting DB)
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
    }).save();

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