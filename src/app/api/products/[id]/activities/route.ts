import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import ProductModel from "@/models/product.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import mongoose from "mongoose";
import { requireApiAuth } from "@/lib/api-auth";
import { buildUtcDateRange } from "@/lib/nepal-date-range";

type RouteContext = { params: Promise<{ id: string }> };

interface ProductActivityDTO {
  _id: string;
  type: "purchase" | "sale";
  date: string;
  party: {
    _id: string;
    name: string;
  };
  quantity: number;
  ratePerKg: number;
  totalAmount: number;
  balanceAmount: number;
  notes: string | null;
  createdAt: string;
}

// ── GET /api/products/:id/activities ─────────────────────────────
// Returns all transactions for a specific product, paginated and sorted by date.

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    // Verify product exists
    const product = await ProductModel.findById(id).lean();
    if (!product) return notFoundResponse("Product");

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    // Build date filter if provided
    const fromDate = searchParams.get("fromDate") ?? undefined;
    const toDate = searchParams.get("toDate") ?? undefined;
    const dateFilter = buildUtcDateRange(fromDate, toDate);

    const productObjectId = new mongoose.Types.ObjectId(id);

    // Base match for transactions
    const txnMatch: Record<string, unknown> = { productId: productObjectId };
    if (dateFilter) txnMatch.date = dateFilter;

    // Aggregation pipeline
    const pipeline = [
      { $match: txnMatch },
      // Lookup party info
      {
        $lookup: {
          from: "parties",
          localField: "partyId",
          foreignField: "_id",
          as: "partyInfo",
        },
      },
      { $unwind: { path: "$partyInfo", preserveNullAndEmptyArrays: true } },
      // Project transaction fields
      {
        $project: {
          _id: 1,
          type: 1,
          date: 1,
          party: {
            _id: "$partyInfo._id",
            name: "$partyInfo.name",
          },
          quantity: { $toDouble: "$quantity" },
          ratePerKg: { $toDouble: "$ratePerKg" },
          totalAmount: { $toDouble: "$totalAmount" },
          balanceAmount: { $toDouble: "$balanceAmount" },
          notes: 1,
          createdAt: 1,
        },
      },
      // Sort by date descending, then by createdAt for same-day items
      { $sort: { date: -1 as const, createdAt: -1 as const } },
      // Facet for pagination
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const [result] = await Transaction.aggregate(pipeline);

    const total = result.metadata[0]?.total ?? 0;
    const activities: ProductActivityDTO[] = result.data.map(
      (item: Record<string, unknown>) => ({
        _id: (item._id as mongoose.Types.ObjectId).toString(),
        type: item.type as "purchase" | "sale",
        date: (item.date as Date).toISOString(),
        party: item.party
          ? {
              _id: (
                item.party as { _id: mongoose.Types.ObjectId }
              )._id.toString(),
              name: (item.party as { name: string }).name,
            }
          : { _id: "", name: "Unknown" },
        quantity: item.quantity as number,
        ratePerKg: item.ratePerKg as number,
        totalAmount: item.totalAmount as number,
        balanceAmount: item.balanceAmount as number,
        notes: (item.notes as string) ?? null,
        createdAt: (item.createdAt as Date).toISOString(),
      })
    );

    return successResponse(
      activities,
      "Activities fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}
