import type { MonthOption, Problem, ProblemKind } from "@/types";

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
  destinations_table: "Page doesn't follow the usual format",
  destination_page: "Unreadable destination page",
  airline_code: "Airline page has no IATA code",
  airline_link: "Airline isn't linked",
  airport_page: "Broken link in the airport list",
  coordinates: "No coordinates",
  one_sided_route: "Route listed by only one airport",
};

export const problemLabel = (problem: Problem) => PROBLEM_LABELS[problem.kind] ?? problem.kind;

export const airlineAnchor = (name: string) => `airline-${name.replace(/[^A-Za-z0-9]+/g, "-")}`;

export const errorsUrl = (anchor: string, snapshot: MonthOption | null) => {
  const query = snapshot ? `?year=${snapshot.year}&month=${Number(snapshot.month)}` : "";
  return `/errors${query}#${anchor}`;
};

/** Insertion order, so groups follow the API's airport order. */
export const groupBy = <T>(items: T[], key: (item: T) => string | null) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(item);
  }
  return groups;
};
