import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@/components/common/Combobox";
import { ExternalLink } from "@/components/common/ExternalLink";
import { Panel } from "@/components/common/Panel";
import { useMonths } from "@/hooks/useMonths";
import { ArrowBackIcon } from "@/icons";
import { fetchProblems } from "@/services/api";
import type { MonthOption, Problem } from "@/types";
import { airlineAnchor, groupBy } from "@/utils/problems";
import { ProblemList } from "./ProblemList";
import { ProblemsMap, type ProblemPlace } from "./ProblemsMap";
import styles from "./ErrorsPage.module.css";

type Option = { value: string; label: string };

const monthKey = (m: MonthOption) => `${m.year}-${m.month}`;

const monthFromUrl = (months: MonthOption[]) => {
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  return months.find((m) => m.year === year && Number(m.month) === month) ?? months[0] ?? null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const ErrorsPage = () => {
  const { months, error: monthsError } = useMonths();
  const [chosen, setChosen] = useState<MonthOption | null>(null);
  const month = chosen ?? monthFromUrl(months);
  const [loaded, setLoaded] = useState<{ key: string; problems: Problem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Wikipedia data problems | Flight Atlas";
  }, []);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    fetchProblems(month)
      .then((problems) => !cancelled && setLoaded({ key: monthKey(month), problems }))
      .catch((err: unknown) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const problems = month && loaded?.key === monthKey(month) ? loaded.problems : null;

  const byAirport = useMemo(() => groupBy(problems ?? [], (p) => p.airport), [problems]);
  const byAirline = useMemo(
    () =>
      new Map(
        [...groupBy(problems ?? [], (p) => p.airline)].sort(([a], [b]) => a.localeCompare(b)),
      ),
    [problems],
  );
  const unplaced = useMemo(() => (problems ?? []).filter((p) => !p.airport), [problems]);

  const places = useMemo<ProblemPlace[]>(
    () =>
      [...byAirport].flatMap(([iata, list]) =>
        list[0].coordinates
          ? [
              {
                iata,
                name: list[0].airport_name ?? iata,
                coordinates: list[0].coordinates,
                count: list.length,
              },
            ]
          : [],
      ),
    [byAirport],
  );

  const jumpOptions = useMemo<Option[]>(
    () => [
      ...[...byAirport].map(([iata, list]) => ({
        value: iata,
        label: `${list[0].airport_name ?? "Unknown airport"} (${iata})`,
      })),
      ...[...byAirline.keys()].map((name) => ({ value: airlineAnchor(name), label: name })),
    ],
    [byAirport, byAirline],
  );

  // The sections arrive after the page loads, so the browser can't scroll to the hash itself.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (problems && id) document.getElementById(id)?.scrollIntoView();
  }, [problems]);

  const chooseMonth = (option: MonthOption | null) => {
    if (!option) return;
    setChosen(option);
    window.history.replaceState(
      null,
      "",
      `/errors?year=${option.year}&month=${Number(option.month)}`,
    );
  };

  const jumpTo = (anchor: string) => {
    window.location.hash = anchor;
  };

  return (
    <main className={styles.page}>
      <a href="/" className={styles.back}>
        <ArrowBackIcon /> Back to the map
      </a>
      <h1 className={styles.title}>Wikipedia data problems</h1>
      <p className={styles.intro}>
        Flight Atlas reads its routes from each airport&apos;s &ldquo;Airlines and
        destinations&rdquo; table on Wikipedia. These are the pages it couldn&apos;t fully read in a
        month&apos;s scrape, so some routes are missing. Fixing the page on Wikipedia fixes the map
        at the next scrape.
      </p>

      <div className={styles.controls}>
        <Combobox<MonthOption>
          label="Scrape month"
          value={month}
          onChange={chooseMonth}
          options={months}
          placeholder="Select a month"
          getOptionLabel={(o) => o.label}
          getOptionValue={monthKey}
        />
        <Combobox<Option>
          label="Find an airport or airline"
          value={null}
          onChange={(option) => option && jumpTo(option.value)}
          options={jumpOptions}
          isDisabled={!problems?.length}
          placeholder="Find an airport or airline"
        />
      </div>

      {(monthsError || error) && (
        <p role="alert" className={styles.error}>
          {monthsError || error}
        </p>
      )}
      <p role="status" className={styles.summary}>
        {!problems
          ? "Loading problems…"
          : problems.length === 0
            ? "No problems were recorded for this month."
            : `${plural(problems.length, "problem")} across ${plural(byAirport.size, "airport")} and ${plural(byAirline.size, "airline")}.`}
      </p>

      {problems && problems.length > 0 && (
        <>
          <ProblemsMap places={places} onSelect={jumpTo} />

          <h2 className={styles.heading}>Airports</h2>
          <div className={styles.grid}>
            {[...byAirport].map(([iata, list]) => (
              <Panel key={iata} id={iata} className={styles.card}>
                <h3 className={styles.cardTitle}>
                  {list[0].airport_name ?? "Unknown airport"} ({iata})
                </h3>
                {list[0].coordinates && (
                  <a href={`/${iata}`} className={styles.mapLink}>
                    View on the map
                  </a>
                )}
                <ProblemList problems={list} groupedBy="airport" />
              </Panel>
            ))}
          </div>

          {byAirline.size > 0 && (
            <>
              <h2 className={styles.heading}>Airlines</h2>
              <div className={styles.grid}>
                {[...byAirline].map(([name, list]) => (
                  <Panel key={name} id={airlineAnchor(name)} className={styles.card}>
                    <h3 className={styles.cardTitle}>{name}</h3>
                    <ProblemList
                      problems={list}
                      groupedBy="airline"
                      airportHref={(iata) => `#${iata}`}
                    />
                  </Panel>
                ))}
              </div>
            </>
          )}

          {unplaced.length > 0 && (
            <>
              <h2 className={styles.heading}>Other pages</h2>
              <Panel className={styles.card}>
                <ProblemList problems={unplaced} groupedBy="none" />
              </Panel>
            </>
          )}
        </>
      )}

      <footer className={styles.footer}>
        Also available from the API: <ExternalLink href="/docs">GET /problems</ExternalLink>
      </footer>
    </main>
  );
};
