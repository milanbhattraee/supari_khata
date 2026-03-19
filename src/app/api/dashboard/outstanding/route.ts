import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Transaction from "@/models/transaction.model";
import Payment from "@/models/payment.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { requireApiAuth } from "@/lib/api-auth";
import mongoose from "mongoose";
import { calculatePartyOutstanding, roundMoney } from "@/lib/financial";

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboard/outstanding
// ══════════════════════════════════════════════════════════════════════════════
// Returns aggregated outstanding receivable and payable across all parties
// Key: Calculate per-party, then SUM to prevent cross-party netting

export async function GET(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Get all active parties
    // ─────────────────────────────────────────────────────────────────────────
    const activeParties = await Party.find({ isActive: true })
      .select("_id name openingBalance category")
      .lean();

    const activePartyIds = activeParties.map((p) => p._id);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Get TRANSACTION balances per party
    // Grouped by (partyId, type) to keep sale/purchase separate
    // ─────────────────────────────────────────────────────────────────────────
    const txnBalances = await Transaction.aggregate([
      {
        $match: {
          partyId: { $in: activePartyIds }
        }
      },
      {
        $group: {
          _id: {
            partyId: "$partyId",
            type: "$type" // "purchase" or "sale"
          },
          totalBalance: { $sum: { $toDouble: "$balanceAmount" } }
        }
      }
    ]);

    // Index by partyId for quick lookup
    const txnByParty = new Map<string, { sale: number; purchase: number }>();
    for (const row of txnBalances) {
      const partyId = (row._id.partyId as mongoose.Types.ObjectId).toString();
      if (!txnByParty.has(partyId)) {
        txnByParty.set(partyId, { sale: 0, purchase: 0 });
      }
      const entry = txnByParty.get(partyId)!;
      if (row._id.type === "sale") {
        entry.sale = row.totalBalance;
      } else if (row._id.type === "purchase") {
        entry.purchase = row.totalBalance;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Get STANDALONE PAYMENT totals per party
    // CRITICAL: Only payments where transactionId IS NULL
    // Linked payments are already in transaction.balanceAmount
    // ─────────────────────────────────────────────────────────────────────────
    const standalonePymnts = await Payment.aggregate([
      {
        $match: {
          partyId: { $in: activePartyIds },
          $or: [
            { transactionId: { $exists: false } },
            { transactionId: null }
          ]
        }
      },
      {
        $group: {
          _id: {
            partyId: "$partyId",
            direction: "$direction" // "payin" or "payout"
          },
          totalAmount: { $sum: { $toDouble: "$amount" } }
        }
      }
    ]);

    // Index by partyId
    const payByParty = new Map<string, { payin: number; payout: number }>();
    for (const row of standalonePymnts) {
      const partyId = (row._id.partyId as mongoose.Types.ObjectId).toString();
      if (!payByParty.has(partyId)) {
        payByParty.set(partyId, { payin: 0, payout: 0 });
      }
      const entry = payByParty.get(partyId)!;
      if (row._id.direction === "payin") {
        entry.payin = row.totalAmount;
      } else if (row._id.direction === "payout") {
        entry.payout = row.totalAmount;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Calculate per-party outstanding, then aggregate
    // ─────────────────────────────────────────────────────────────────────────
    let totalReceivable = 0;
    let totalPayable = 0;

    const partyDetails: Array<{
      partyId: string;
      partyName: string;
      category: string;
      receivable: number;
      payable: number;
      net: number;
    }> = [];

    for (const party of activeParties) {
      const partyId = (party._id as mongoose.Types.ObjectId).toString();
      const raw = (party as unknown as Record<string, unknown>).openingBalance;

      const openingBalance =
        raw instanceof mongoose.Types.Decimal128
          ? parseFloat(raw.toString())
          : typeof raw === "number" && Number.isFinite(raw)
            ? raw
            : 0;

      const txn = txnByParty.get(partyId) ?? { sale: 0, purchase: 0 };
      const pay = payByParty.get(partyId) ?? { payin: 0, payout: 0 };

      // Use the financial utility function
      const outstanding = calculatePartyOutstanding({
        openingBalance,
        totalSalesDue: txn.sale,
        totalPurchasesDue: txn.purchase,
        totalPayIn: pay.payin,
        totalPayout: pay.payout
      });

      // Add to aggregates
      totalReceivable += outstanding.receivable;
      totalPayable += outstanding.payable;

      partyDetails.push({
        partyId,
        partyName: party.name,
        category: party.category,
        receivable: roundMoney(outstanding.receivable),
        payable: roundMoney(outstanding.payable),
        net: roundMoney(outstanding.net)
      });
    }

    return successResponse(
      {
        summary: {
          totalReceivable: roundMoney(totalReceivable),
          totalPayable: roundMoney(totalPayable),
          net: roundMoney(totalReceivable - totalPayable)
        },
        byParty: partyDetails,
        partyCount: activeParties.length
      },
      "Outstanding balances fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}
