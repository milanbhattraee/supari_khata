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
import { CreatePartyDTO, PartyResponseDTO, ProductKgBreakdown } from "@/types/dto";
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
    // 3 aggregations for ALL parties on this page (replaces N × 3 queries).
    const pagePartyIds = parties.map((p) => p._id);

    const [txnBalances, standalonePayments, productKgBreakdown] = await Promise.all([
      Transaction.aggregate([
        { $match: { partyId: { $in: pagePartyIds } } },
        {
          $group: {
            _id: { partyId: "$partyId", type: "$type" },
            totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
            totalQuantity: { $sum: { $toDouble: "$quantity" } },
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
      // Product-wise kg breakdown for all parties on this page
      Transaction.aggregate([
        { $match: { partyId: { $in: pagePartyIds } } },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: { partyId: "$partyId", type: "$type", productId: "$productId", productName: "$product.name" },
            totalQuantity: { $sum: { $toDouble: "$quantity" } },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const txnByParty = new Map<string, { sale: number; purchase: number; saleKg: number; purchaseKg: number }>();
    for (const row of txnBalances) {
      const pid = row._id.partyId.toString();
      if (!txnByParty.has(pid)) txnByParty.set(pid, { sale: 0, purchase: 0, saleKg: 0, purchaseKg: 0 });
      const entry = txnByParty.get(pid)!;
      if (row._id.type === "sale") {
        entry.sale = row.totalBalance;
        entry.saleKg = row.totalQuantity;
      }
      if (row._id.type === "purchase") {
        entry.purchase = row.totalBalance;
        entry.purchaseKg = row.totalQuantity;
      }
    }

    const payByParty = new Map<string, { payin: number; payout: number }>();
    for (const row of standalonePayments) {
      const pid = row._id.partyId.toString();
      if (!payByParty.has(pid)) payByParty.set(pid, { payin: 0, payout: 0 });
      const entry = payByParty.get(pid)!;
      if (row._id.direction === "payin") entry.payin = row.totalAmount;
      if (row._id.direction === "payout") entry.payout = row.totalAmount;
    }

    // Build product-wise kg lookup map
    const productKgByParty = new Map<string, { sales: ProductKgBreakdown[]; purchases: ProductKgBreakdown[] }>();
    for (const row of productKgBreakdown) {
      const pid = row._id.partyId.toString();
      if (!productKgByParty.has(pid)) productKgByParty.set(pid, { sales: [], purchases: [] });
      const entry = productKgByParty.get(pid)!;
      const breakdown: ProductKgBreakdown = {
        productId: row._id.productId.toString(),
        productName: row._id.productName,
        kg: Math.round((row.totalQuantity ?? 0) * 100) / 100,
      };
      if (row._id.type === "sale") {
        entry.sales.push(breakdown);
      } else if (row._id.type === "purchase") {
        entry.purchases.push(breakdown);
      }
    }
    // Sort by product name for consistent display
    for (const entry of productKgByParty.values()) {
      entry.sales.sort((a, b) => a.productName.localeCompare(b.productName));
      entry.purchases.sort((a, b) => a.productName.localeCompare(b.productName));
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

      const txn = txnByParty.get(pid) ?? { sale: 0, purchase: 0, saleKg: 0, purchaseKg: 0 };
      const pay = payByParty.get(pid) ?? { payin: 0, payout: 0 };
      const productKg = productKgByParty.get(pid) ?? { sales: [], purchases: [] };

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
        salesKg: txn.saleKg,
        purchasesKg: txn.purchaseKg,
        salesByProduct: productKg.sales,
        purchasesByProduct: productKg.purchases,
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