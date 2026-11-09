import type { Translate } from "@/i18n/translate";
import type { MonthOption, Problem, ProblemKind } from "@/types";

export const problemLabels = (t: Translate): Record<ProblemKind, string> => ({
  destinations_table: t("Page doesn't follow the usual format"),
  destination_page: t("Unreadable destination page"),
  airline_code: t("Airline page has no IATA code"),
  airline_link: t("Airline isn't linked"),
  airport_page: t("Broken link in the airport list"),
  coordinates: t("No coordinates"),
  one_sided_route: t("Route listed by only one airport"),
});

export const problemLabel = (t: Translate, problem: Problem) =>
  problemLabels(t)[problem.kind] ?? problem.kind;

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
