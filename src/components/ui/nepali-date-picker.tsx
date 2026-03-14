"use client";

import { useState, useRef, useEffect } from "react";
import NepaliDate from "nepali-date-converter";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Compute the number of days in a given BS year/month (month is 0-indexed). */
function getDaysInBSMonth(year: number, month: number): number {
  for (let d = 32; d >= 28; d--) {
    try {
      const nd = new NepaliDate(year, month, d);
      if (nd.getMonth() === month && nd.getYear() === year) return d;
    } catch {
      // day out of range for this month — try smaller
    }
  }
  return 30;
}

/** Convert an ISO date string (YYYY-MM-DD or full ISO-8601) to BS components. */
function isoToBS(iso: string): { year: number; month: number; day: number } | null {
  try {
    const nd = new NepaliDate(new Date(iso));
    return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
  } catch {
    return null;
  }
}

/**
 * Convert BS year/month/day to a YYYY-MM-DD ISO date string.
 * We use noon UTC to avoid any timezone-related date shift.
 */
function bsToISO(year: number, month: number, day: number): string {
  const nd = new NepaliDate(year, month, day);
  const jsDate = nd.toJsDate();
  const y = jsDate.getFullYear();
  const m = String(jsDate.getMonth() + 1).padStart(2, "0");
  const d = String(jsDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get today's date in BS. */
function currentBS(): { year: number; month: number; day: number } {
  const nd = new NepaliDate();
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}

export interface NepaliDatePickerProps {
  /** Currently selected value as a YYYY-MM-DD ISO date string. */
  value?: string;
  /** Called with a YYYY-MM-DD string when a date is chosen, or undefined when cleared. */
  onChange?: (isoDate: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * A date-picker that displays and accepts dates in Bikram Sambat (BS) format
 * on the frontend, while emitting ISO YYYY-MM-DD strings compatible with UTC
 * storage on the backend.
 */
export function NepaliDatePicker({
  value,
  onChange,
  placeholder = "Select date (BS)",
  disabled,
  id,
  className,
}: NepaliDatePickerProps) {
  const today = currentBS();
  const selected = value ? isoToBS(value) : null;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.month);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Sync view when external value changes
  useEffect(() => {
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (day: number) => {
    onChange?.(bsToISO(viewYear, viewMonth, day));
    setOpen(false);
  };

  const clear = () => {
    onChange?.(undefined);
    setOpen(false);
  };

  const selectToday = () => {
    onChange?.(bsToISO(today.year, today.month, today.day));
    setViewYear(today.year);
    setViewMonth(today.month);
    setOpen(false);
  };

  const daysInMonth = getDaysInBSMonth(viewYear, viewMonth);
  const firstDayOfWeek = new NepaliDate(viewYear, viewMonth, 1).getDay();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const displayText = selected
    ? `${String(selected.day).padStart(2, "0")} ${BS_MONTHS[selected.month]}, ${selected.year}`
    : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "ios-input w-full flex items-center justify-between text-left px-3 h-11 rounded-xl text-sm transition-opacity",
          disabled && "opacity-50 cursor-not-allowed",
          displayText ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{displayText ?? placeholder}</span>
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[260px] bg-background/95 backdrop-blur-3xl rounded-2xl p-3 shadow-2xl border border-border">
          {/* Month / Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-black/5 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-[13px] font-semibold">
              {BS_MONTHS[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-black/5 active:scale-95 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday header row */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK_DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: totalCells }, (_, i) => {
              const day = i - firstDayOfWeek + 1;
              const valid = day >= 1 && day <= daysInMonth;

              const isToday =
                valid &&
                viewYear === today.year &&
                viewMonth === today.month &&
                day === today.day;

              const isSelected =
                valid &&
                !!selected &&
                viewYear === selected.year &&
                viewMonth === selected.month &&
                day === selected.day;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!valid}
                  onClick={() => valid && selectDay(day)}
                  className={cn(
                    "h-8 w-8 mx-auto flex items-center justify-center text-[12px] rounded-xl transition-all",
                    !valid && "invisible pointer-events-none",
                    isSelected && "bg-blue-500 text-white font-semibold",
                    isToday &&
                      !isSelected &&
                      "bg-blue-100 text-blue-600 font-semibold",
                    !isSelected &&
                      !isToday &&
                      valid &&
                      "hover:bg-black/5 text-foreground active:scale-95"
                  )}
                >
                  {valid ? day : ""}
                </button>
              );
            })}
          </div>

          {/* Footer — Clear / Today */}
          <div className="flex justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="text-xs text-blue-500 font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
