import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import Party from "@/models/parties.model";
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
import { ActivityResponseDTO } from "@/types/dto";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/parties/:id/activities ─────────────────────────────
// Returns combined transactions and payments for a party, paginated and sorted by date.

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    // Verify party exists
    const party = await Party.findById(id).lean();
    if (!party) return notFoundResponse("Party");

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    // Build date filter if provided
    const fromDate = searchParams.get("fromDate") ?? undefined;
    const toDate = searchParams.get("toDate") ?? undefined;
    const dateFilter = buildUtcDateRange(fromDate, toDate);

    const partyObjectId = new mongoose.Types.ObjectId(id);

    // Base match for transactions
    const txnMatch: Record<string, unknown> = { partyId: partyObjectId };
    if (dateFilter) txnMatch.date = dateFilter;

    // Base match for payments
    const paymentMatch: Record<string, unknown> = { partyId: partyObjectId };
    if (dateFilter) paymentMatch.date = dateFilter;

    // Aggregation pipeline to combine transactions and payments
    const pipeline = [
      // Start with transactions
      { $match: txnMatch },
      // Lookup product info
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
      // Project transaction fields
      {
        $project: {
          _id: 1,
          kind: { $literal: "transaction" },
          date: 1,
          type: 1,
          product: {
            _id: "$productInfo._id",
            name: "$productInfo.name",
            unit: "$productInfo.unit",
          },
          quantity: { $toDouble: "$quantity" },
          ratePerKg: { $toDouble: "$ratePerKg" },
          totalAmount: { $toDouble: "$totalAmount" },
          balanceAmount: { $toDouble: "$balanceAmount" },
          notes: 1,
          createdAt: 1,
        },
      },
      // Union with payments
      {
        $unionWith: {
          coll: "payments",
          pipeline: [
            { $match: paymentMatch },
            {
              $project: {
                _id: 1,
                kind: { $literal: "payment" },
                date: 1,
                amount: { $toDouble: "$amount" },
                direction: 1,
                method: 1,
                notes: 1,
                createdAt: 1,
              },
            },
          ],
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
    const activities: ActivityResponseDTO[] = result.data.map(
      (item: Record<string, unknown>) => ({
        _id: (item._id as mongoose.Types.ObjectId).toString(),
        kind: item.kind as "transaction" | "payment",
        date: (item.date as Date).toISOString(),
        type: item.type as string | undefined,
        product: item.product
          ? {
              _id: (
                item.product as { _id: mongoose.Types.ObjectId }
              )._id.toString(),
              name: (item.product as { name: string }).name,
              unit: (item.product as { unit: string }).unit,
            }
          : undefined,
        quantity: item.quantity as number | undefined,
        ratePerKg: item.ratePerKg as number | undefined,
        totalAmount: item.totalAmount as number | undefined,
        balanceAmount: item.balanceAmount as number | undefined,
        amount: item.amount as number | undefined,
        direction: item.direction as string | undefined,
        method: item.method as string | undefined,
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
