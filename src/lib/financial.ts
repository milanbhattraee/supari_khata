export interface PartyOutstandingInputs {
  openingBalance: number;
  totalSalesDue: number;
  totalPurchasesDue: number;
  totalPayIn: number;
  totalPayout: number;
}

export interface PartyOutstandingResult {
  receivable: number;
  payable: number;
  net: number;
}

function safeNumber(value: unknown): number {
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

  // Calculate the net relationship between the two sides.
  // Positive net means the party owes you (Receivable).
  // Negative net means you owe the party (Payable).
  const netValue = saleSide - purchaseSide;
  const net = roundMoney(netValue);

  const receivable = net > 0 ? net : 0;
  const payable = net < 0 ? Math.abs(net) : 0;

  return {
    receivable,
    payable,
    net,
  };
}
