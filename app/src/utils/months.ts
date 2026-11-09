import { tagOf } from "@/i18n/translate";
import type { MonthOption } from "@/types";

/** Orders months across years: a later month has a larger index. */
export const monthIndex = (m: MonthOption) => m.year * 12 + Number(m.month);

/** "Sep 2026", for pickers too narrow for "September 2026". */
export const shortLabel = (m: MonthOption) =>
  new Intl.DateTimeFormat(tagOf(window.location.pathname), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(m.year, Number(m.month) - 1));

export const monthsBefore = (months: MonthOption[], later: MonthOption) =>
  months.filter((m) => monthIndex(m) < monthIndex(later));

export const monthsAfter = (months: MonthOption[], earlier: MonthOption) =>
  months.filter((m) => monthIndex(m) > monthIndex(earlier));
