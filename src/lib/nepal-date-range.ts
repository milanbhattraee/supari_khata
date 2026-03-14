const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateOnlyNepalStart(dateOnly: string): Date {
  // Interpret YYYY-MM-DD as Nepal business day start (00:00 NPT), then convert to UTC.
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utcAtNepalMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - NEPAL_OFFSET_MS;
  return new Date(utcAtNepalMidnight);
}

export function buildUtcDateRange(fromDate?: string | null, toDate?: string | null):
  | { $gte?: Date; $lte?: Date }
  | undefined {
  if (!fromDate && !toDate) return undefined;

  const range: { $gte?: Date; $lte?: Date } = {};

  if (fromDate) {
    range.$gte = isDateOnly(fromDate)
      ? parseDateOnlyNepalStart(fromDate)
      : new Date(fromDate);
  }

  if (toDate) {
    if (isDateOnly(toDate)) {
      // End of Nepal day = next Nepal midnight minus 1ms.
      const nextDayStart = new Date(parseDateOnlyNepalStart(toDate).getTime() + 24 * 60 * 60 * 1000);
      range.$lte = new Date(nextDayStart.getTime() - 1);
    } else {
      range.$lte = new Date(toDate);
    }
  }

  return range;
}
