import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Transaction from "@/models/transaction.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requireApiAuth } from "@/lib/api-auth";
import NepaliDate from "nepali-date-converter";
import { roundMoney } from "@/lib/financial";

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboard/yearly
// ══════════════════════════════════════════════════════════════════════════════
// Returns yearly business metrics (Purchases, Sales)
// Year = Nepali calendar year (Baishakh 1 to Chaitra 32)

export async function GET(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Calculate Nepali year boundaries
    // Baishakh 1 = First day of Nepali year
    // ─────────────────────────────────────────────────────────────────────────
    const currentNpDate = new NepaliDate();
    const yearStart = new NepaliDate(
      currentNpDate.getYear(),
      0, // Baishakh (month 0)
      1  // Day 1
    ).toJsDate();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Get active parties (scope calculations to active parties)
    // ─────────────────────────────────────────────────────────────────────────
    const activeParties = await Party.find({ isActive: true })
      .select("_id")
      .lean();

    const activePartyIds = activeParties.map((p) => p._id);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Aggregate transactions by type
    // totalAmount = full business value of the transaction
    // (NOT paidAmount, which is only cash received/paid)
    // ─────────────────────────────────────────────────────────────────────────
    const yearlyStats = await Transaction.aggregate([
      {
        $match: {
          partyId: { $in: activePartyIds },
          date: { $gte: yearStart },
          type: { $in: ["purchase", "sale"] }
        }
      },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: { $toDouble: "$totalAmount" } },
          count: { $sum: 1 },
          averageAmount: { $avg: { $toDouble: "$totalAmount" } }
        }
      }
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Extract and format results
    // ─────────────────────────────────────────────────────────────────────────
    const purchaseStats = yearlyStats.find((s) => s._id === "purchase");
    const saleStats = yearlyStats.find((s) => s._id === "sale");

    const totalPurchases = purchaseStats?.totalAmount ?? 0;
    const totalSales = saleStats?.totalAmount ?? 0;

    return successResponse(
      {
        yearInfo: {
          nepaliYear: currentNpDate.getYear(),
          yearStartDate: yearStart.toISOString(),
          // Year end = day before next year's Baishakh 1 (safer than assuming Chaitra 32)
          yearEndDate: new Date(
            new NepaliDate(currentNpDate.getYear() + 1, 0, 1).toJsDate().getTime() - 1
          ).toISOString()
        },
        purchases: {
          total: roundMoney(totalPurchases),
          count: purchaseStats?.count ?? 0,
          average: roundMoney(purchaseStats?.averageAmount ?? 0)
        },
        sales: {
          total: roundMoney(totalSales),
          count: saleStats?.count ?? 0,
          average: roundMoney(saleStats?.averageAmount ?? 0)
        },
        summary: {
          totalTransactionValue: roundMoney(totalPurchases + totalSales),
          transactionCount: (purchaseStats?.count ?? 0) + (saleStats?.count ?? 0)
        }
      },
      "Yearly statistics fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}
