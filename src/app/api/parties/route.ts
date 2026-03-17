import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Transaction from "@/models/transaction.model";
import Payment from "@/models/payment.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateParty } from "@/lib/validators";
import { CreatePartyDTO, PartyResponseDTO } from "@/types/dto";
import { toPartyDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";
import mongoose from "mongoose";
import { calculatePartyOutstanding } from "@/lib/financial";

// ── GET /api/parties ─────────────────────────────────────────
// Query params: page, limit, search (name/phone), category
//
// Uses BULK aggregation (2 queries for ALL parties in the page)
// instead of calling getOutstandingBalance() per party (N+1 problem).

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    const isActive = searchParams.get("isActive");

    // Build dynamic filter
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (category) filter.category = category;
    if (isActive !== null) filter.isActive = isActive === "true";

    const [parties, total] = await Promise.all([
      Party.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Party.countDocuments(filter),
    ]);

    // ── Bulk balance calculation ────────────────────────────────────────────
    // 2 aggregations for ALL parties on this page (replaces N × 2 queries).
    const pagePartyIds = parties.map((p) => p._id);

    const [txnBalances, standalonePayments] = await Promise.all([
      Transaction.aggregate([
        { $match: { partyId: { $in: pagePartyIds } } },
        {
          $group: {
            _id: { partyId: "$partyId", type: "$type" },
            totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            partyId: { $in: pagePartyIds },
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
          },
        },
        {
          $group: {
            _id: { partyId: "$partyId", direction: "$direction" },
            totalAmount: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const txnByParty = new Map<string, { sale: number; purchase: number }>();
    for (const row of txnBalances) {
      const pid = row._id.partyId.toString();
      if (!txnByParty.has(pid)) txnByParty.set(pid, { sale: 0, purchase: 0 });
      const entry = txnByParty.get(pid)!;
      if (row._id.type === "sale") entry.sale = row.totalBalance;
      if (row._id.type === "purchase") entry.purchase = row.totalBalance;
    }

    const payByParty = new Map<string, { payin: number; payout: number }>();
    for (const row of standalonePayments) {
      const pid = row._id.partyId.toString();
      if (!payByParty.has(pid)) payByParty.set(pid, { payin: 0, payout: 0 });
      const entry = payByParty.get(pid)!;
      if (row._id.direction === "payin") entry.payin = row.totalAmount;
      if (row._id.direction === "payout") entry.payout = row.totalAmount;
    }

    // Enrich each party DTO with calculated balance
    const data: PartyResponseDTO[] = parties.map((p) => {
      const dto = toPartyDTO(p as unknown as Record<string, unknown>);
      const pid = (p._id as mongoose.Types.ObjectId).toString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (p as any).openingBalance;
      const openingBalance =
        raw instanceof mongoose.Types.Decimal128
          ? parseFloat(raw.toString())
          : typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : 0;

      const txn = txnByParty.get(pid) ?? { sale: 0, purchase: 0 };
      const pay = payByParty.get(pid) ?? { payin: 0, payout: 0 };

      const result = calculatePartyOutstanding({
        openingBalance,
        totalSalesDue: txn.sale,
        totalPurchasesDue: txn.purchase,
        totalPayIn: pay.payin,
        totalPayout: pay.payout,
      });

      dto.balance = {
        receivable: result.receivable,
        payable: result.payable,
        net: result.net,
      };

      return dto;
    });

    return successResponse(data, "Parties fetched", 200, buildMeta(total, page, limit));
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/parties ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreatePartyDTO> = await req.json();

    const validation = validateCreateParty(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    const party = await Party.create({
      name: body.name!.trim(),
      phone: body.phone?.trim(),
      address: body.address?.trim(),
      category: body.category,
      openingBalance: body.openingBalance ?? 0,
    });

    const data: PartyResponseDTO = toPartyDTO(
      party.toObject() as unknown as Record<string, unknown>
    );


    return createdResponse(data, "Party created successfully");
  } catch (err) {
    return handleApiError(err);
  }
}