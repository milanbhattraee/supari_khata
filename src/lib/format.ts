import NepaliDate from "nepali-date-converter";

/**
 * Format a number as Nepali Rupees
 */
export function formatNepaliCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "Rs. 0.00";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "Rs. 0.00";

  // Nepali numbering uses lakhs/crores grouping
  const formatted = new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numAmount));

  const sign = numAmount < 0 ? "-" : "";
  return `${sign}Rs. ${formatted}`;
}

/**
 * Format a number using compact notation (e.g. 1.2K, 15L)
 */
export function formatCompactCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "Rs. 0";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "Rs. 0";

  // en-IN supports Lakh (L) and Crore (Cr)
  const formatted = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 2,
  }).format(Math.abs(numAmount));

  const sign = numAmount < 0 ? "-" : "";
  return `${sign}Rs. ${formatted}`;
}

/**
 * Format a number with Nepali grouping (no currency symbol)
 */
export function formatNumber(num: number | string | null | undefined, decimals = 2): string {
  if (num === null || num === undefined) return "0";
  const numVal = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(numVal)) return "0";

  return new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numVal);
}

/**
 * Convert an ISO date string to Nepali BS date string
 */
export function toNepaliDate(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "N/A";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Invalid Date";
    const nepDate = new NepaliDate(date);
    return nepDate.format("YYYY/MM/DD");
  } catch {
    return "Invalid Date";
  }
}

/**
 * Convert an ISO date string to a more readable Nepali BS format
 */
export function toNepaliDateLong(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "N/A";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Invalid Date";
    const nepDate = new NepaliDate(date);
    return nepDate.format("DD MMMM, YYYY");
  } catch {
    return "Invalid Date";
  }
}

/**
 * Get today's date in Nepali BS
 */
/**
 * Convert an ISO date string to short Nepali BS format (e.g., "Fal 24")
 */
export function toNepaliDateShort(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "N/A";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Invalid Date";
    const nepDate = new NepaliDate(date);
    return nepDate.format("MMM DD");
  } catch {
    return "Invalid Date";
  }
}


export function todayNepali(): string {
  const nepDate = new NepaliDate();
  return nepDate.format("YYYY/MM/DD");
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return toNepaliDate(isoDate);
}
