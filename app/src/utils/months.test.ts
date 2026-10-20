import { describe, expect, it } from "vitest";
import type { MonthOption } from "@/types";
import { monthsAfter, monthsBefore, shortLabel } from "./months";

const month = (label: string, m: string, year: number): MonthOption => ({ label, month: m, year });
const DEC = month("December 2025", "12", 2025);
const JAN = month("January 2026", "01", 2026);
const FEB = month("February 2026", "02", 2026);
const MONTHS = [FEB, JAN, DEC];

describe("months", () => {
  it("orders months across a year boundary", () => {
    expect(monthsBefore(MONTHS, JAN)).toEqual([DEC]);
    expect(monthsAfter(MONTHS, DEC)).toEqual([FEB, JAN]);
  });

  it("shortens labels", () => {
    expect(shortLabel(DEC)).toBe("Dec 2025");
  });
});
