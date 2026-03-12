import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Product from "@/models/product.model";
import Transaction from "@/models/transaction.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { DashboardSummaryDTO } from "@/types/dto";
import mongoose from "mongoose";

// ── GET /api/dashboard ────────────────────────────────────────
// Returns a high-level business snapshot for the home screen

export async function GET(_req: NextRequest) {
  try {
    await dbConnect();

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const LOW_STOCK_THRESHOLD = 100; // kg

    // Run all queries in parallel for performance
    const [
      totalParties,
      totalProducts,
      todayTransactions,
      stockSummary,
      outstandingData,
    ] = await Promise.all([
      // Count active parties
      Party.countDocuments({ isActive: true }),

      // Count active products
      Product.countDocuments({ isActive: true }),

      // Today's transactions grouped by type
      Transaction.aggregate([
        { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: "$totalAmount" } },
          },
        },
      ]),

      // Low stock products
      Product.find({
        isActive: true,
        currentStock: {
          $lt: mongoose.Types.Decimal128.fromString(
            String(LOW_STOCK_THRESHOLD)
          ),
        },
      })
        .lean()
        .limit(10),

      // Outstanding receivable (customers owe you) vs payable (you owe suppliers)
      Transaction.aggregate([
        {
          $group: {
            _id: "$type",
            totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
          },
        },
      ]),
    ]);

    // Parse today's txn stats
    const purchaseStats = todayTransactions.find((t) => t._id === "purchase");
    const saleStats = todayTransactions.find((t) => t._id === "sale");

    // Outstanding: sales balance = receivable, purchase balance = payable
    const receivable =
      outstandingData.find((o) => o._id === "sale")?.totalBalance ?? 0;
    const payable =
      outstandingData.find((o) => o._id === "purchase")?.totalBalance ?? 0;

    const data: DashboardSummaryDTO = {
      totalParties,
      totalProducts,
      totalTransactionsToday:
        (purchaseStats?.count ?? 0) + (saleStats?.count ?? 0),
      totalPurchasesToday: purchaseStats?.totalAmount ?? 0,
      totalSalesToday: saleStats?.totalAmount ?? 0,
      totalOutstandingReceivable: receivable,
      totalOutstandingPayable: payable,
      lowStockProducts: stockSummary.map((p) => ({
        _id: (p._id as { toString(): string }).toString(),
        name: p.name,
        unit: p.unit,
        currentStock: parseFloat(
          (p.currentStock as mongoose.Types.Decimal128)?.toString() ?? "0"
        ),
        description: p.description ?? null,
        isActive: p.isActive,
        createdAt: (p.createdAt as Date).toISOString(),
        updatedAt: (p.updatedAt as Date).toISOString(),
      })),
    };

    return successResponse(data, "Dashboard data fetched");
  } catch (err) {
    return handleApiError(err);
  }
}