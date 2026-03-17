import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import Product from "@/models/product.model";
import Transaction from "@/models/transaction.model";
import Payment from "@/models/payment.model";
import { successResponse, handleApiError } from "@/lib/apiResponse";
import { DashboardSummaryDTO } from "@/types/dto";
import mongoose from "mongoose";
import { roundMoney, calculatePartyOutstanding } from "@/lib/financial";
import { requireApiAuth } from "@/lib/api-auth";
import NepaliDate from "nepali-date-converter";

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/dashboard
// ══════════════════════════════════════════════════════════════════════════════
//
// Returns a high-level business snapshot for the home screen.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │                    ACCOUNTING FORMULAS (Dashboard)                       │
// ├──────────────────────────────────────────────────────────────────────────┤
// │                                                                          │
// │  FINANCIAL SUMMARY (Yearly - This Nepali Fiscal Year)                    │
// │  ─────────────────────────────────────────────────────                   │
// │  Total Purchases  = SUM(txn.totalAmount WHERE type="purchase", thisYear) │
// │  Total Sales      = SUM(txn.totalAmount WHERE type="sale", thisYear)     │
// │  Gross Profit     = Total Sales - Total Purchases                        │
// │                                                                          │
// │  CASH POSITION (Yearly - This Nepali Fiscal Year)                        │
// │  ────────────────────────────────────────────────                        │
// │  Payments Received = SUM(sale txn.paidAmount) + SUM(standalone payin)    │
// │  Payments Made     = SUM(purchase txn.paidAmount) + SUM(standalone payout)│
// │  Net Cash          = Payments Received - Payments Made                   │
// │                                                                          │
// │  OUTSTANDING BALANCE (All-Time - From Party Ledgers)                     │
// │  ───────────────────────────────────────────────────                     │
// │  To Receive       = SUM(all customer outstanding balances)               │
// │  To Pay           = SUM(all supplier outstanding balances)               │
// │  Customer Advance = SUM(all customer advances)                           │
// │  Supplier Advance = SUM(all supplier advances)                           │
// │                                                                          │
// │  Party Ledger Formula (per party):                                       │
// │    saleSide     = openingCredit + totalSalesDue - totalPayIn             │
// │    purchaseSide = openingDebit + totalPurchasesDue - totalPayout         │
// │    receivable   = max(0, saleSide - purchaseSide) if net > 0             │
// │    payable      = max(0, purchaseSide - saleSide) if net < 0             │
// │                                                                          │
// │  Dashboard Outstanding = SUM of all party ledger balances                │
// │  This ensures Dashboard always matches Party Pages exactly.              │
// │                                                                          │
// └──────────────────────────────────────────────────────────────────────────┘

export async function GET(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    // ── Nepal timezone: UTC+5:45 ────────────────────────────────────────────
    const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const nowNepal = new Date(Date.now() + NEPAL_OFFSET_MS);
    const nepalMidnight = new Date(nowNepal);
    nepalMidnight.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(nepalMidnight.getTime() - NEPAL_OFFSET_MS);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const LOW_STOCK_THRESHOLD = 100; // kg

    // ── Nepali year start (Baishakh 1) ──────────────────────────────────────
    const currentNpDate = new NepaliDate();
    const startOfYear = new NepaliDate(currentNpDate.getYear(), 0, 1).toJsDate();

    // ── Active parties ──────────────────────────────────────────────────────
    const activeParties = await Party.find({ isActive: true })
      .select("_id")
      .lean();

    const activePartyIds = activeParties.map((p) => p._id);

    // ── Run queries in parallel ─────────────────────────────────────────────
    const [
      totalProducts,
      yearlyTransactions,
      stockSummary,
      cashflowTxns,
      cashflowPayments,
      yearlyTxnCash,
      yearlyStandalonePayments,
      linkedOldPayments,
      // Per-party ledger data for outstanding calculation
      allPartyTransactionBalances,
      allPartyStandalonePayments,
      allPartyOpeningBalances,
    ] = await Promise.all([
      // 1. Active product count
      Product.countDocuments({ isActive: true }),

      // 2. Yearly transaction totals (business value, not cash)
      //    Uses totalAmount = full value of the trade
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

      // 3. Low stock products
      Product.find({
        isActive: true,
        currentStock: {
          $lt: mongoose.Types.Decimal128.fromString(String(LOW_STOCK_THRESHOLD)),
        },
      })
        .lean()
        .limit(10),

      // 4. Cashflow: Transaction paidAmount (actual cash) — last 180 days
      //    Uses paidAmount, NOT totalAmount. paidAmount = actual cash that moved.
      Transaction.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(startOfDay.getTime() - 179 * 24 * 60 * 60 * 1000),
              $lte: endOfDay,
            },
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

      // 5. Cashflow: Standalone payments — last 180 days
      //    ONLY standalone payments (transactionId IS NULL).
      //    Linked payments already counted in transaction.paidAmount above.
      Payment.aggregate([
        {
          $match: {
            date: {
              $gte: new Date(startOfDay.getTime() - 179 * 24 * 60 * 60 * 1000),
              $lte: endOfDay,
            },
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
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

      // 6. Yearly cash from TRANSACTIONS (paidAmount for transactions created THIS YEAR)
      //    This includes initial payments + linked payments for new transactions.
      //    sale paidAmount → Money In | purchase paidAmount → Money Out
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
            totalPaid: { $sum: { $toDouble: "$paidAmount" } },
          },
        },
      ]),

      // 7. Yearly cash from STANDALONE PAYMENTS (transactionId IS NULL)
      //    payin → Money In | payout → Money Out
      Payment.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
            date: { $gte: startOfYear },
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
          },
        },
        {
          $group: {
            _id: "$direction",
            totalAmount: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),

      // 7b. Yearly cash from LINKED PAYMENTS to OLD transactions
      //     These are payments made THIS YEAR towards transactions from PREVIOUS years.
      //     Without this, payments to old transactions would be missed.
      Payment.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
            date: { $gte: startOfYear },
            transactionId: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "transactions",
            localField: "transactionId",
            foreignField: "_id",
            as: "txn",
          },
        },
        { $unwind: "$txn" },
        {
          $match: {
            "txn.date": { $lt: startOfYear },
          },
        },
        {
          $group: {
            _id: "$direction",
            totalAmount: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),

      // ═══════════════════════════════════════════════════════════════════════
      // 8. ALL-TIME: Transaction balanceAmount per party (grouped by type)
      //    This is the remaining due amount on each transaction.
      //    Used for party ledger outstanding calculation.
      // ═══════════════════════════════════════════════════════════════════════
      Transaction.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
          },
        },
        {
          $group: {
            _id: {
              partyId: "$partyId",
              type: "$type",
            },
            totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
          },
        },
      ]),

      // ═══════════════════════════════════════════════════════════════════════
      // 9. ALL-TIME: Standalone payments per party (grouped by direction)
      //    ONLY standalone payments (transactionId IS NULL).
      //    Linked payments already reduced transaction.balanceAmount above.
      // ═══════════════════════════════════════════════════════════════════════
      Payment.aggregate([
        {
          $match: {
            partyId: { $in: activePartyIds },
            $or: [{ transactionId: { $exists: false } }, { transactionId: null }],
          },
        },
        {
          $group: {
            _id: {
              partyId: "$partyId",
              direction: "$direction",
            },
            totalAmount: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),

      // ═══════════════════════════════════════════════════════════════════════
      // 10. ALL-TIME: Opening balances for all active parties
      // ═══════════════════════════════════════════════════════════════════════
      Party.find({ isActive: true })
        .select("_id openingBalance")
        .lean(),
    ]);

    // ── Yearly stats ────────────────────────────────────────────────────────
    const purchaseStats = yearlyTransactions.find((t) => t._id === "purchase");
    const saleStats = yearlyTransactions.find((t) => t._id === "sale");

    // ── Yearly cash position ──────────────────────────────────────────────
    // Money In  = cash received from sales + standalone payin payments
    // Money Out = cash paid for purchases + standalone payout payments
    const txnSalePaid = yearlyTxnCash.find((t) => t._id === "sale")?.totalPaid ?? 0;
    const txnPurchasePaid = yearlyTxnCash.find((t) => t._id === "purchase")?.totalPaid ?? 0;
    const standalonePayIn = yearlyStandalonePayments.find((p) => p._id === "payin")?.totalAmount ?? 0;
    const standalonePayOut = yearlyStandalonePayments.find((p) => p._id === "payout")?.totalAmount ?? 0;
    const linkedOldPayIn = linkedOldPayments.find((p) => p._id === "payin")?.totalAmount ?? 0;
    const linkedOldPayOut = linkedOldPayments.find((p) => p._id === "payout")?.totalAmount ?? 0;

    const totalMoneyIn = txnSalePaid + standalonePayIn + linkedOldPayIn;
    const totalMoneyOut = txnPurchasePaid + standalonePayOut + linkedOldPayOut;

    // ── LOG: Yearly cash position breakdown ──
    console.log("=== DASHBOARD YEARLY CALCULATIONS ===");
    console.log("Nepali Year:", currentNpDate.getYear());
    console.log("Year Start:", startOfYear.toISOString());
    console.log("\n--- Purchase Stats ---");
    console.log("Total Purchases:", purchaseStats?.totalAmount ?? 0);
    console.log("Purchase Count:", purchaseStats?.count ?? 0);
    console.log("\n--- Sale Stats ---");
    console.log("Total Sales:", saleStats?.totalAmount ?? 0);
    console.log("Sale Count:", saleStats?.count ?? 0);
    console.log("\n--- Yearly Cash Breakdown ---");
    console.log("Txn Sale Paid (from sale txns this year):", txnSalePaid);
    console.log("Txn Purchase Paid (from purchase txns this year):", txnPurchasePaid);
    console.log("Standalone Pay In:", standalonePayIn);
    console.log("Standalone Pay Out:", standalonePayOut);
    console.log("Linked Payment Pay In (old txns):", linkedOldPayIn);
    console.log("Linked Payment Pay Out (old txns):", linkedOldPayOut);
    console.log("--- Money In Calculation ---");
    console.log(`  = txnSalePaid(${txnSalePaid}) + standalonePayIn(${standalonePayIn}) + linkedOldPayIn(${linkedOldPayIn})`);
    console.log(`  = ${totalMoneyIn}`);
    console.log("--- Money Out Calculation ---");
    console.log(`  = txnPurchasePaid(${txnPurchasePaid}) + standalonePayOut(${standalonePayOut}) + linkedOldPayOut(${linkedOldPayOut})`);
    console.log(`  = ${totalMoneyOut}`);

    // ── Build cashflow arrays ───────────────────────────────────────────────
    // Helper to look up cashflow amounts for a given date string
    const getCashflowForDate = (dateStr: string) => {
      let moneyIn = 0;
      let moneyOut = 0;

      // From transactions: paidAmount = actual cash movement
      for (const t of cashflowTxns) {
        if (t._id.dateStr === dateStr) {
          if (t._id.type === "sale") moneyIn += t.totalPaid;
          if (t._id.type === "purchase") moneyOut += t.totalPaid;
        }
      }

      // From standalone payments only
      for (const p of cashflowPayments) {
        if (p._id.dateStr === dateStr) {
          if (p._id.direction === "payin") moneyIn += p.totalAmount;
          if (p._id.direction === "payout") moneyOut += p.totalAmount;
        }
      }

      return { moneyIn, moneyOut };
    };

    // Daily cashflow (last 7 days)
    const dailyCashflow = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfDay.getTime() - i * 24 * 60 * 60 * 1000);
      const tzDate = new Date(d.getTime() + NEPAL_OFFSET_MS);
      const dateStr = tzDate.toISOString().split("T")[0];
      const { moneyIn, moneyOut } = getCashflowForDate(dateStr);

      dailyCashflow.push({
        date: dateStr,
        moneyIn: roundMoney(moneyIn),
        moneyOut: roundMoney(moneyOut),
      });
    }

    // Monthly cashflow (last 6 Nepali months)
    const monthlyCashflowMap = new Map<string, { moneyIn: number; moneyOut: number }>();
    const monthKeys: string[] = [];

    for (let i = 5; i >= 0; i--) {
      let m = currentNpDate.getMonth() - i;
      let y = currentNpDate.getYear();
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      monthKeys.push(key);
      monthlyCashflowMap.set(key, { moneyIn: 0, moneyOut: 0 });
    }

    const processMonthlyItem = (dateStr: string, isMoneyIn: boolean, amount: number) => {
      try {
        const nd = new NepaliDate(new Date(dateStr));
        const key = `${nd.getYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
        if (monthlyCashflowMap.has(key)) {
          const entry = monthlyCashflowMap.get(key)!;
          if (isMoneyIn) entry.moneyIn += amount;
          else entry.moneyOut += amount;
        }
      } catch {
        // Skip invalid dates
      }
    };

    for (const t of cashflowTxns) {
      processMonthlyItem(t._id.dateStr, t._id.type === "sale", t.totalPaid);
    }
    for (const p of cashflowPayments) {
      processMonthlyItem(p._id.dateStr, p._id.direction === "payin", p.totalAmount);
    }

    const monthlyCashflow = monthKeys.map((key) => ({
      date: key,
      ...monthlyCashflowMap.get(key)!,
    }));

    // ── Build response ──────────────────────────────────────────────────────
    const totalPurchasesYearly = purchaseStats?.totalAmount ?? 0;
    const totalSalesYearly = saleStats?.totalAmount ?? 0;

    // ═══════════════════════════════════════════════════════════════════════════
    // OUTSTANDING BALANCE (All-Time - From Party Ledgers)
    // ═══════════════════════════════════════════════════════════════════════════
    // Instead of using yearly formula (Total Purchases - Payments Made),
    // we calculate per-party balances and sum them up.
    // This ensures Dashboard always matches Party Pages exactly.
    //
    // Formula per party:
    //   saleSide     = openingCredit + totalSalesDue - totalPayIn
    //   purchaseSide = openingDebit + totalPurchasesDue - totalPayout
    //   net          = saleSide - purchaseSide
    //   receivable   = max(0, net)
    //   payable      = max(0, -net)
    // ═══════════════════════════════════════════════════════════════════════════

    // Build lookup maps for efficient per-party aggregation
    const partyTxnBalances = new Map<string, { sale: number; purchase: number }>();
    for (const row of allPartyTransactionBalances) {
      const partyIdStr = row._id.partyId.toString();
      if (!partyTxnBalances.has(partyIdStr)) {
        partyTxnBalances.set(partyIdStr, { sale: 0, purchase: 0 });
      }
      const entry = partyTxnBalances.get(partyIdStr)!;
      if (row._id.type === "sale") entry.sale = row.totalBalance;
      if (row._id.type === "purchase") entry.purchase = row.totalBalance;
    }

    const partyPayments = new Map<string, { payin: number; payout: number }>();
    for (const row of allPartyStandalonePayments) {
      const partyIdStr = row._id.partyId.toString();
      if (!partyPayments.has(partyIdStr)) {
        partyPayments.set(partyIdStr, { payin: 0, payout: 0 });
      }
      const entry = partyPayments.get(partyIdStr)!;
      if (row._id.direction === "payin") entry.payin = row.totalAmount;
      if (row._id.direction === "payout") entry.payout = row.totalAmount;
    }

    // Calculate outstanding for each party using the same formula as Party.getOutstandingBalance
    let totalReceivable = 0;
    let totalPayable = 0;
    let totalCustAdvance = 0;
    let totalSuppAdvance = 0;

    for (const party of allPartyOpeningBalances) {
      const partyIdStr = party._id.toString();

      // Parse opening balance (Decimal128 from lean query)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawOpening = (party as any).openingBalance;
      const openingBalance =
        rawOpening instanceof mongoose.Types.Decimal128
          ? parseFloat(rawOpening.toString())
          : typeof rawOpening === "number" && Number.isFinite(rawOpening)
          ? rawOpening
          : 0;

      const txnBal = partyTxnBalances.get(partyIdStr) ?? { sale: 0, purchase: 0 };
      const payments = partyPayments.get(partyIdStr) ?? { payin: 0, payout: 0 };

      // Use the same formula as calculatePartyOutstanding
      const result = calculatePartyOutstanding({
        openingBalance,
        totalSalesDue: txnBal.sale,
        totalPurchasesDue: txnBal.purchase,
        totalPayIn: payments.payin,
        totalPayout: payments.payout,
      });

      totalReceivable += result.receivable;
      totalPayable += result.payable;
      totalCustAdvance += result.customerAdvance;
      totalSuppAdvance += result.supplierAdvance;
    }

    const data: DashboardSummaryDTO = {
      totalParties: activeParties.length,
      totalProducts,

      // Business value (P&L) — YEARLY
      totalTransactionsYearly: roundMoney(totalPurchasesYearly + totalSalesYearly),
      totalPurchasesYearly: roundMoney(totalPurchasesYearly),
      totalSalesYearly: roundMoney(totalSalesYearly),
      grossProfitYearly: roundMoney(totalSalesYearly - totalPurchasesYearly),

      // Cash position (actual money movement) — YEARLY
      totalMoneyInYearly: roundMoney(totalMoneyIn),
      totalMoneyOutYearly: roundMoney(totalMoneyOut),
      netCashflowYearly: roundMoney(totalMoneyIn - totalMoneyOut),

      // Outstanding balances — ALL-TIME (from party ledgers)
      // These values now EXACTLY match what's shown on individual party pages
      totalOutstandingReceivable: roundMoney(totalReceivable),
      totalOutstandingPayable: roundMoney(totalPayable),

      // Advances (customer/supplier paid more than they owe)
      totalCustomerAdvance: roundMoney(totalCustAdvance),
      totalSupplierAdvance: roundMoney(totalSuppAdvance),

      lowStockProducts: stockSummary.map((p) => ({
        _id: (p._id as mongoose.Types.ObjectId).toString(),
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

    return successResponse(data, "Dashboard data fetched");
  } catch (err) {
    return handleApiError(err);
  }
}
