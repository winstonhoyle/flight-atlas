import type { MonthOption } from "@/types";

/** Orders months across years: a later month has a larger index. */
export const monthIndex = (m: MonthOption) => m.year * 12 + Number(m.month);

/** "Sep 2026", for pickers too narrow for "September 2026". */
export const shortLabel = (m: MonthOption) => `${m.label.slice(0, 3)} ${m.year}`;

export const monthsBefore = (months: MonthOption[], later: MonthOption) =>
  months.filter((m) => monthIndex(m) < monthIndex(later));

export const monthsAfter = (months: MonthOption[], earlier: MonthOption) =>
  months.filter((m) => monthIndex(m) > monthIndex(earlier));
