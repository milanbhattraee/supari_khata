// ══════════════════════════════════════════════════════════════════════════════
// Supari Khata — Financial Calculation Utilities
// ══════════════════════════════════════════════════════════════════════════════
//
// ACCOUNTING MODEL SUMMARY
// ─────────────────────────
// Transaction.totalAmount  = business value (P&L: what was bought/sold)
// Transaction.paidAmount   = cash movement  (Cashflow: what was paid/received)
// Transaction.balanceAmount= future dues    (Outstanding: what's still owed)
//
// Payment (standalone)     = cash movement not tied to a transaction
// Payment (linked)         = settles a specific transaction (updates its paidAmount)
//
// CRITICAL RULE: Linked payments are ALREADY reflected in transaction.paidAmount.
// They must NEVER be added again in cashflow or outstanding calculations.
// Only STANDALONE payments (transactionId IS NULL) are counted separately.
// ══════════════════════════════════════════════════════════════════════════════

export interface PartyOutstandingInputs {
  openingBalance: number;
  /** Sum of balanceAmount from all sale transactions for this party */
  totalSalesDue: number;
  /** Sum of balanceAmount from all purchase transactions for this party */
  totalPurchasesDue: number;
  /** Sum of standalone payment amounts where direction = "payin" */
  totalPayIn: number;
  /** Sum of standalone payment amounts where direction = "payout" */
  totalPayout: number;
}

export interface PartyOutstandingResult {
  /** What the party owes YOU (always >= 0) */
  receivable: number;
  /** What YOU owe the party (always >= 0) */
  payable: number;
  /** receivable - payable (positive = in your favour) */
  net: number;
}

export function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function roundMoney(value: number): number {
  const normalized = safeNumber(value);
  return Math.round((normalized + Number.EPSILON) * 100) / 100;
}

export function toMoneyCents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

export function centsToMoneyString(cents: number): string {
  const normalized = Number.isFinite(cents) ? cents : 0;
  return (normalized / 100).toFixed(2);
}

/**
 * Calculate a single party's outstanding receivable/payable.
 *
 * Formula:
 *   saleSide     = max(openingBalance, 0) + totalSalesDue - totalPayIn
 *   purchaseSide = abs(min(openingBalance, 0)) + totalPurchasesDue - totalPayout
 *   net          = saleSide - purchaseSide
 *
 * If net > 0 → party owes you (receivable)
 * If net < 0 → you owe party (payable)
 *
 * IMPORTANT: totalSalesDue and totalPurchasesDue should be the SUM of
 * transaction.balanceAmount (NOT totalAmount). balanceAmount already
 * accounts for any paidAmount at transaction time AND linked payments.
 *
 * totalPayIn and totalPayout should ONLY include STANDALONE payments
 * (where transactionId is null). Linked payments are already reflected
 * in the reduced balanceAmount of their transactions.
 */
export function calculatePartyOutstanding(
  input: PartyOutstandingInputs
): PartyOutstandingResult {
  const opening = safeNumber(input.openingBalance);
  const totalSalesDue = safeNumber(input.totalSalesDue);
  const totalPurchasesDue = safeNumber(input.totalPurchasesDue);
  const totalPayIn = safeNumber(input.totalPayIn);
  const totalPayout = safeNumber(input.totalPayout);

  const openingCredit = opening > 0 ? opening : 0;
  const openingDebit = opening < 0 ? Math.abs(opening) : 0;

  // Keep sale-side and purchase-side ledgers separate, but carry any advance
  // from one side into the opposite side so overpayments are not lost.
  const saleSide = openingCredit + totalSalesDue - totalPayIn;
  const purchaseSide = openingDebit + totalPurchasesDue - totalPayout;

  // Net calculation without flooring - allows advances to flip balance direction
  // Positive net = party owes you (To Receive)
  // Negative net = you owe party (To Pay)
  const net = roundMoney(saleSide - purchaseSide);

  const receivable = net > 0 ? net : 0;
  const payable = net < 0 ? Math.abs(net) : 0;

  return {
    receivable,
    payable,
    net,
  };
}

// ── Cashflow helpers ─────────────────────────────────────────────────────────

export interface DailyCashflowEntry {
  date: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
}

/**
 * Merge transaction paidAmounts and standalone payment amounts into a
 * single daily cashflow array.
 *
 * CASHFLOW FORMULA (per day):
 *   moneyIn  = SUM(sale txn.paidAmount)    + SUM(standalone payin payment.amount)
 *   moneyOut = SUM(purchase txn.paidAmount) + SUM(standalone payout payment.amount)
 *   net      = moneyIn - moneyOut
 *
 * CRITICAL: Only count STANDALONE payments. Linked payments are already
 * reflected in transaction.paidAmount and would cause double-counting.
 */
export function buildDailyCashflow(
  dateStrings: string[],
  txnRows: Array<{ dateStr: string; type: string; totalPaid: number }>,
  paymentRows: Array<{ dateStr: string; direction: string; totalAmount: number }>
): DailyCashflowEntry[] {
  return dateStrings.map((dateStr) => {
    let moneyIn = 0;
    let moneyOut = 0;

    for (const t of txnRows) {
      if (t.dateStr !== dateStr) continue;
      if (t.type === "sale") moneyIn += t.totalPaid;
      else if (t.type === "purchase") moneyOut += t.totalPaid;
    }

    for (const p of paymentRows) {
      if (p.dateStr !== dateStr) continue;
      if (p.direction === "payin") moneyIn += p.totalAmount;
      else if (p.direction === "payout") moneyOut += p.totalAmount;
    }

    return {
      date: dateStr,
      moneyIn: roundMoney(moneyIn),
      moneyOut: roundMoney(moneyOut),
      net: roundMoney(moneyIn - moneyOut),
    };
  });
}
