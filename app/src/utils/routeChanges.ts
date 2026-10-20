import type { Airport, Problem, RouteChange, RouteRow } from "@/types";

const key = ([airline, src, dst]: RouteRow) => `${airline}|${src}|${dst}`;

const missingFrom = (rows: RouteRow[], other: RouteRow[]) => {
  const seen = new Set(other.map(key));
  return rows.filter((row) => {
    const k = key(row);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** An airline swap on the same pair counts as one lost and one added route. */
export const routeChanges = (from: RouteRow[], to: RouteRow[]) => ({
  added: missingFrom(to, from),
  lost: missingFrom(from, to),
});

/**
 * Airports on a changed route, busiest first. `destinations` becomes the number of airports
 * it gained or lost a route to. Later months' airports win; earlier ones fill in airports a
 * lost route's end no longer appears in.
 */
export const changedAirports = (rows: RouteRow[], later: Airport[], earlier: Airport[]) => {
  const partners = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!partners.has(a)) partners.set(a, new Set());
    partners.get(a)!.add(b);
  };
  for (const [, src, dst] of rows) {
    link(src, dst);
    link(dst, src);
  }
  const byCode = new Map([...earlier, ...later].map((a) => [a.properties.IATA, a]));
  return [...partners]
    .flatMap(([code, others]): Airport[] => {
      const airport = byCode.get(code);
      return airport
        ? [{ ...airport, properties: { ...airport.properties, destinations: others.size } }]
        : [];
    })
    .sort((a, b) => b.properties.destinations - a.properties.destinations);
};

/** Problems at either end of a changed route: a page the scraper couldn't read may explain it. */
export const changeProblems = (rows: RouteRow[], problems: Problem[]) => {
  const codes = new Set(rows.flatMap(([, src, dst]) => [src, dst]));
  return problems.filter((p) => p.airport !== null && codes.has(p.airport));
};

export const CHANGE_LABELS: Record<RouteChange, string> = { added: "New", lost: "Lost" };
