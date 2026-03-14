import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Product from "@/models/product.model";
import Transaction from "@/models/transaction.model";
import Payment from "@/models/payment.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { DashboardSummaryDTO } from "@/types/dto";
import mongoose from "mongoose";
import { calculatePartyOutstanding, roundMoney } from "@/lib/financial";
import { requireApiAuth } from "@/lib/api-auth";
import NepaliDate from "nepali-date-converter";

// ── GET /api/dashboard ────────────────────────────────────────
// Returns a high-level business snapshot for the home screen

export async function GET(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    // ── Nepal timezone fix: UTC+5:45
    // Using server setHours() would anchor to UTC midnight, missing Nepal's first 5h45m.
    const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const nowNepal = new Date(Date.now() + NEPAL_OFFSET_MS);
    const nepalMidnight = new Date(nowNepal);
    nepalMidnight.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(nepalMidnight.getTime() - NEPAL_OFFSET_MS);
    const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const LOW_STOCK_THRESHOLD = 100; // kg

    // ── Fetch active party IDs first — all outstanding calculations must be
    // scoped to active parties only. Otherwise deactivated parties still
    // inflate/deflate receivable and payable totals asymmetrically.
    // (openingBalance was already scoped to isActive:true but txn/payment queries were not)
    const activeParties = await Party.find({ isActive: true })
      .select("_id openingBalance")
      .lean();

    const activePartyIds = activeParties.map((p) => p._id);

    // Calculate start of the year for Yearly Activity
    const startOfYear = new Date(nowNepal.getFullYear(), 0, 1);
    startOfYear.setUTCHours(0, 0, 0, 0);

    // Run all remaining queries in parallel
    const [
      totalProducts,
      yearlyTransactions,
      stockSummary,
      txnOutstandingByParty,
      paymentOutstandingByParty,
      cashflowTxns,
      cashflowPayments,
    ] = await Promise.all([
      // Count active products
      Product.countDocuments({ isActive: true }),

      // Yearly transactions — scoped to active parties
      Transaction.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
            date: { $gte: startOfYear },
          },
        },
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
          $lt: mongoose.Types.Decimal128.fromString(String(LOW_STOCK_THRESHOLD)),
        },
      })
        .lean()
        .limit(10),

      // Outstanding balances grouped by PARTY to avoid cross-party netting. If we
      // net first and then apply Math.max, an overpayment from Party A would hide
      // dues from Party B. Summing party-level outstanding keeps each ledger siloed.
      Transaction.aggregate([
        { $match: { partyId: { $in: activePartyIds } } },
        {
          $group: {
            _id: { partyId: "$partyId", type: "$type" },
            totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
          },
        },
      ]),

      // Standalone payments (not linked to a transaction), grouped by party.
      Payment.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
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

      // Cashflow: Transactions last 180 days
      Transaction.aggregate([
        {
          $match: {
            date: { $gte: new Date(startOfDay.getTime() - 179 * 24 * 60 * 60 * 1000), $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: {
              dateStr: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $add: ["$date", NEPAL_OFFSET_MS] },
                },
              },
              type: "$type",
            },
            totalPaid: { $sum: { $toDouble: "$paidAmount" } },
          },
        },
      ]),

      // Cashflow: Payments last 180 days
      Payment.aggregate([
        {
          $match: {
            date: { $gte: new Date(startOfDay.getTime() - 179 * 24 * 60 * 60 * 1000), $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: {
              dateStr: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: { $add: ["$date", NEPAL_OFFSET_MS] },
                },
              },
              direction: "$direction",
            },
            totalAmount: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),
    ]);

    // ── Yearly stats
    const purchaseStats = yearlyTransactions.find((t) => t._id === "purchase");
    const saleStats     = yearlyTransactions.find((t) => t._id === "sale");

    // Index outstanding figures per party to avoid cross-party offsetting.
    const txnByPartyMap = txnOutstandingByParty.reduce(
      (acc, row) => {
        const partyId = (row._id.partyId as { toString(): string }).toString();
        const entry = acc.get(partyId) ?? { sale: 0, purchase: 0 };
        if (row._id.type === "sale") entry.sale = row.totalBalance;
        else if (row._id.type === "purchase") entry.purchase = row.totalBalance;
        acc.set(partyId, entry);
        return acc;
      },
      new Map<string, { sale: number; purchase: number }>()
    );

    const paymentsByPartyMap = paymentOutstandingByParty.reduce(
      (acc, row) => {
        const partyId = (row._id.partyId as { toString(): string }).toString();
        const entry = acc.get(partyId) ?? { payin: 0, payout: 0 };
        if (row._id.direction === "payin") entry.payin = row.totalAmount;
        else if (row._id.direction === "payout") entry.payout = row.totalAmount;
        acc.set(partyId, entry);
        return acc;
      },
      new Map<string, { payin: number; payout: number }>()
    );

    // Compute outstanding per party, then sum — prevents Party A's advance
    // from hiding Party B's dues.
    const { receivable, payable } = activeParties.reduce(
      (acc, party) => {
        const raw = (party as unknown as Record<string, unknown>).openingBalance;
        const opening =
          raw instanceof mongoose.Types.Decimal128
            ? parseFloat(raw.toString())
            : typeof raw === "number" && Number.isFinite(raw)
            ? raw
            : 0;

        const partyId = (party._id as { toString(): string }).toString();
        const txn = txnByPartyMap.get(partyId) ?? { sale: 0, purchase: 0 };
        const pay = paymentsByPartyMap.get(partyId) ?? { payin: 0, payout: 0 };

        const outstanding = calculatePartyOutstanding({
          openingBalance: opening,
          totalSalesDue: txn.sale,
          totalPurchasesDue: txn.purchase,
          totalPayIn: pay.payin,
          totalPayout: pay.payout,
        });

        acc.receivable += outstanding.receivable;
        acc.payable += outstanding.payable;
        return acc;
      },
      { receivable: 0, payable: 0 }
    );

    // Build cashflow daily array (last 7 days) and monthly array (last 6 months)
    const dailyCashflow = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay.getTime() - i * 24 * 60 * 60 * 1000);
      const tzDate = new Date(d.getTime() + NEPAL_OFFSET_MS);
      const dateStr = tzDate.toISOString().split("T")[0]; // YYYY-MM-DD
      
      let moneyIn = 0;
      let moneyOut = 0;

      // Add from transactions
      for (const t of cashflowTxns) {
        if (t._id.dateStr === dateStr) {
          if (t._id.type === "sale") moneyIn += t.totalPaid;
          if (t._id.type === "purchase") moneyOut += t.totalPaid;
        }
      }

      // Add from payments
      for (const p of cashflowPayments) {
        if (p._id.dateStr === dateStr) {
          if (p._id.direction === "payin") moneyIn += p.totalAmount;
          if (p._id.direction === "payout") moneyOut += p.totalAmount;
        }
      }

      dailyCashflow.push({
        date: dateStr,
        moneyIn,
        moneyOut,
      });
    }

    // Process last 6 months
    const monthlyCashflowMap = new Map<string, { moneyIn: number; moneyOut: number }>();
    const monthKeys = [];
    
    // Get keys for last 6 months
    let currentND = new NepaliDate();
    for(let i = 5; i >= 0; i--) {
      // safe subtraction
      let m = currentND.getMonth() - i;
      let y = currentND.getYear();
      if(m < 0) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthlyCashflowMap.set(key, { moneyIn: 0, moneyOut: 0 });
    }

    // Aggregate into the map
    const processItem = (dateStr: string, isMoneyIn: boolean, amount: number) => {
      try {
        const nd = new NepaliDate(new Date(dateStr));
        const key = `${nd.getYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyCashflowMap.has(key)) {
          const entry = monthlyCashflowMap.get(key)!;
          if (isMoneyIn) entry.moneyIn += amount;
          else entry.moneyOut += amount;
        }
      } catch (e) {}
    };

    for (const t of cashflowTxns) {
      processItem(t._id.dateStr, t._id.type === "sale", t.totalPaid);
    }
    for (const p of cashflowPayments) {
      processItem(p._id.dateStr, p._id.direction === "payin", p.totalAmount);
    }

    const monthlyCashflow = monthKeys.map(key => ({
      date: key,
      ...monthlyCashflowMap.get(key)!
    }));

    const data: DashboardSummaryDTO = {
      totalParties: activeParties.length, // reuse from the query already done above
      totalProducts,
        totalTransactionsYearly:
          (purchaseStats?.count ?? 0) + (saleStats?.count ?? 0),
        totalPurchasesYearly: purchaseStats?.totalAmount ?? 0,
        totalSalesYearly:     saleStats?.totalAmount     ?? 0,
      totalOutstandingReceivable: roundMoney(receivable),
      totalOutstandingPayable: roundMoney(payable),
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
      cashflow: {
        daily: dailyCashflow,
        monthly: monthlyCashflow,
      },
    };

    console.log("Dashboard summary data:", data);
    return successResponse(data, "Dashboard data fetched");
  } catch (err) {
    return handleApiError(err);
  }
}