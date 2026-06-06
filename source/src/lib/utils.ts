import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =============================================================================
// Date helpers
// -----------------------------------------------------------------------------
// The browser's <input type="date"> works in local time — the value is a
// calendar date in the user's wall-clock timezone with no time-of-day. When
// we used new Date().toISOString().slice(0, 10) to derive "today" we were
// reading UTC, which rolls over to tomorrow several hours before the user's
// local midnight (true for the U.S. east coast after about 8 PM EDT / 7 PM
// EST). Likewise, new Date("2026-05-29") parses as UTC midnight, which then
// formats back as the previous day in any negative-offset timezone.
//
// These two helpers anchor everything in the user's local calendar:
//   - todayLocalISODate()        : "YYYY-MM-DD" for today in local time.
//   - localDateStringToISO(s)    : turn a "YYYY-MM-DD" into a stable ISO
//                                  timestamp at NOON local time, so the
//                                  recorded instant is unambiguously inside
//                                  the calendar day the user picked, in any
//                                  reasonable timezone, and roundtrips
//                                  through formatters like date-fns without
//                                  surprises.
// =============================================================================

export function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localDateStringToISO(dateStr: string): string {
  // dateStr is expected as "YYYY-MM-DD". Anchor at 12:00 local time so the
  // resulting Date sits squarely inside the chosen calendar day in any
  // common timezone.
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) {
    // Fall back to now if the input is malformed.
    return new Date().toISOString();
  }
  const local = new Date(y, m - 1, d, 12, 0, 0, 0);
  return local.toISOString();
}