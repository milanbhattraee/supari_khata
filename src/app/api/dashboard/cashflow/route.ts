import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Transaction from "@/models/transaction.model";
import Payment from "@/models/payment.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requireApiAuth } from "@/lib/api-auth";
import { roundMoney } from "@/lib/financial";

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboard/cashflow
// ══════════════════════════════════════════════════════════════════════════════
// Returns daily and monthly cashflow for visualization
// Cashflow = actual money movements (paidAmount from transactions + standalone payments)

export async function GET(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const now = new Date();

    // Last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Get TRANSACTION paidAmount grouped by day and type
    // ─────────────────────────────────────────────────────────────────────────
    const txnCashflow = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            dateStr: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $add: ["$date", NEPAL_OFFSET_MS] }
              }
            },
            type: "$type" // "purchase" or "sale"
          },
          totalPaid: { $sum: { $toDouble: "$paidAmount" } }
        }
      },
      {
        $sort: { "_id.dateStr": 1 }
      }
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Get STANDALONE PAYMENT amounts grouped by day and direction
    // CRITICAL: Only standalone payments (transactionId IS NULL)
    // Linked payments are already counted in transaction.paidAmount
    // ─────────────────────────────────────────────────────────────────────────
    const paymentCashflow = await Payment.aggregate([
      {
        $match: {
          date: { $gte: sevenDaysAgo },
          // ONLY standalone payments
          $or: [
            { transactionId: { $exists: false } },
            { transactionId: null }
          ]
        }
      },
      {
        $group: {
          _id: {
            dateStr: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $add: ["$date", NEPAL_OFFSET_MS] }
              }
            },
            direction: "$direction" // "payin" or "payout"
          },
          totalAmount: { $sum: { $toDouble: "$amount" } }
        }
      },
      {
        $sort: { "_id.dateStr": 1 }
      }
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Build daily cashflow array
    // ─────────────────────────────────────────────────────────────────────────
    const dailyCashflow = [];

    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayDateInNepal = new Date(dayDate.getTime() + NEPAL_OFFSET_MS);
      const dateStr = dayDateInNepal.toISOString().split("T")[0];

      // Default to 0
      let moneyIn = 0;
      let moneyOut = 0;

      // Add from transactions
      for (const t of txnCashflow) {
        if (t._id.dateStr === dateStr) {
          if (t._id.type === "sale") {
            moneyIn += t.totalPaid; // Customers pay → money in
          } else if (t._id.type === "purchase") {
            moneyOut += t.totalPaid; // We pay suppliers → money out
          }
        }
      }

      // Add from standalone payments
      for (const p of paymentCashflow) {
        if (p._id.dateStr === dateStr) {
          if (p._id.direction === "payin") {
            moneyIn += p.totalAmount; // Cash received from party
          } else if (p._id.direction === "payout") {
            moneyOut += p.totalAmount; // Cash paid to party
          }
        }
      }

      dailyCashflow.push({
        date: dateStr,
        moneyIn: roundMoney(moneyIn),
        moneyOut: roundMoney(moneyOut),
        net: roundMoney(moneyIn - moneyOut)
      });
    }

    return successResponse(
      {
        daily: dailyCashflow,
        period: "7 days"
      },
      "Cashflow data fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}
