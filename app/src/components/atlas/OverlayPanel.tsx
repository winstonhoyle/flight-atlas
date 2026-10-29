import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/common/Button";
import { Combobox } from "@/components/common/Combobox";
import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { Panel } from "@/components/common/Panel";
import { ArrowBackIcon, ExpandLessIcon, ExpandMoreIcon, SettingsIcon } from "@/icons";
import { API_BASE, snapshotParams } from "@/services/api";
import type { AirlineSummary, Airport, Compare, MonthOption, Routes } from "@/types";
import { shortLabel } from "@/utils/months";
import { CHANGE_LABELS } from "@/utils/routeChanges";
import { ChangedAirports } from "./ChangedAirports";
import { MonthControls } from "./MonthControls";
import styles from "./OverlayPanel.module.css";

type Option = { value: string; label: string; search?: string };

type OverlayPanelProps = {
  airports: Airport[];
  selectedAirport: Airport | null;
  setSelectedAirport: (airport: Airport | null) => void;
  selectedAirline: string;
  setSelectedAirline: (code: string) => void;
  filteredAirlines: AirlineSummary[];
  handleBack: () => void;
  routes: Routes | null;
  destinationAirport: Airport | null;
  setDestinationAirport: (airport: Airport | null) => void;
  monthOptions: MonthOption[];
  snapshot: MonthOption | null;
  setSnapshot: (snapshot: MonthOption) => void;
  compare: Compare | null;
  setCompare: (compare: Compare | null) => void;
  /** Routes that changed between the compared months; `null` outside compare mode. */
  changeCount: number | null;
  loading: boolean;
  error: string | null;
  children?: ReactNode;
};

const ALL_AIRPORTS: Option = { value: "", label: "All airports" };

const buildApiUrl = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  snapshot: MonthOption | null,
) => {
  const params = snapshotParams(snapshot);
  if (selectedAirport) params.set("airport", selectedAirport.properties.IATA);
  if (selectedAirline) params.set("airline_code", selectedAirline);
  const path = selectedAirport || selectedAirline ? "/routes" : "/airports";
  const query = params.toString();
  return `${API_BASE}${path}${query ? `?${query}` : ""}`;
};

export const OverlayPanel = ({
  airports,
  selectedAirport,
  setSelectedAirport,
  selectedAirline,
  setSelectedAirline,
  filteredAirlines,
  handleBack,
  routes,
  destinationAirport,
  setDestinationAirport,
  monthOptions,
  snapshot,
  setSnapshot,
  compare,
  setCompare,
  changeCount,
  loading,
  error,
  children,
}: OverlayPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const selection = [
    selectedAirport?.properties.IATA,
    destinationAirport?.properties.IATA,
    selectedAirline,
  ].join();
  const [prevSelection, setPrevSelection] = useState(selection);
  if (selection !== prevSelection) {
    setPrevSelection(selection);
    if ((selectedAirport || selectedAirline) && window.matchMedia("(max-width: 40em)").matches)
      setIsOpen(false);
  }
  const [showAdvanced, setShowAdvanced] = useState(false);

  const findAirport = (iata: string) => airports.find((a) => a.properties.IATA === iata) ?? null;

  const airportOptions: Option[] = [
    ALL_AIRPORTS,
    ...airports.map((a) => ({
      value: a.properties.IATA,
      label: `${a.properties.Name} (${a.properties.IATA})`,
      search: `${a.properties.Name} ${a.properties.IATA} ${a.properties.City ?? ""}`,
    })),
  ];

  const destinationOptions = useMemo<Option[]>(() => {
    if (!routes?.features.length || !airports.length) return [ALL_AIRPORTS];

    const dstCodes = new Set(
      routes.features
        .filter((f) => !selectedAirline || f.properties.airline_code === selectedAirline)
        .map((f) => f.properties.dst_airport),
    );
    const options = [...dstCodes]
      .map((code) => {
        const match = airports.find((a) => a.properties.IATA === code);
        return {
          value: code,
          label: `${match?.properties.Name || "Unknown airport"} (${code})`,
          search: `${match?.properties.Name ?? ""} ${code} ${match?.properties.City ?? ""}`,
          destinations: match?.properties.destinations ?? 0,
        };
      })
      .sort((a, b) => b.destinations - a.destinations)
      .map(({ value, label, search }) => ({ value, label, search }));

    return [ALL_AIRPORTS, ...options];
  }, [routes, airports, selectedAirline]);

  const airlineOptions: Option[] = [
    { value: "", label: "All airlines" },
    ...filteredAirlines.map((a) => ({
      value: a.code,
      label:
        selectedAirport || compare ? `${a.name} (${a.destinations ?? 0})` : `${a.name} (${a.code})`,
    })),
  ];

  const change = compare && CHANGE_LABELS[compare.show].toLowerCase();
  const range = compare && snapshot && `${shortLabel(compare.from)} to ${shortLabel(snapshot)}`;
  // In compare mode, the routes drawn from it, not the marker's count, which includes inbound changes.
  const destinationCount = compare
    ? destinationOptions.length - 1
    : (selectedAirport?.properties.destinations ?? 0);

  return (
    <Panel id="overlay-panel" className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Direct flight routes</h1>
          {snapshot && (
            <p className={styles.snapshot}>
              {compare
                ? `${CHANGE_LABELS[compare.show]} routes, ${range}`
                : `Data from ${snapshot.label}`}
            </p>
          )}
        </div>
        <IconButton
          label={isOpen ? "Collapse panel" : "Expand panel"}
          aria-expanded={isOpen}
          aria-controls="overlay-body"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </div>

      {isOpen && (
        <div id="overlay-body" className={styles.body}>
          <div className={styles.fields}>
            <Combobox<Option>
              label="Origin airport"
              value={
                selectedAirport
                  ? (airportOptions.find((o) => o.value === selectedAirport.properties.IATA) ??
                    null)
                  : null
              }
              onChange={(option) => {
                setDestinationAirport(null);
                setSelectedAirline("");
                setSelectedAirport(option && findAirport(option.value));
              }}
              options={airportOptions}
              isClearable
              isDisabled={loading}
              placeholder="Search for an airport"
              getOptionSearch={(o) => o.search ?? o.label}
            />

            {selectedAirport && (
              <Combobox<Option>
                label="Destination airport"
                value={
                  destinationAirport
                    ? (destinationOptions.find(
                        (o) => o.value === destinationAirport.properties.IATA,
                      ) ?? null)
                    : null
                }
                onChange={(option) => setDestinationAirport(option && findAirport(option.value))}
                options={destinationOptions}
                isClearable
                isDisabled={loading}
                placeholder="Search for a destination"
                getOptionSearch={(o) => o.search ?? o.label}
              />
            )}

            {!destinationAirport && (
              <Combobox<Option>
                label="Airline"
                value={
                  selectedAirline
                    ? (airlineOptions.find((o) => o.value === selectedAirline) ?? null)
                    : airlineOptions[0]
                }
                onChange={(option) => setSelectedAirline(option?.value ?? "")}
                options={airlineOptions}
                isClearable={!!selectedAirline}
                isDisabled={loading}
                placeholder="Search for an airline"
              />
            )}
          </div>

          {selectedAirport && !destinationAirport && (
            <p className={styles.summary}>
              {selectedAirport.properties.Name}{" "}
              {compare ? `has ${change} routes to` : "has direct flights to"} {destinationCount}{" "}
              {destinationCount === 1 ? "destination" : "destinations"}.
            </p>
          )}

          {children}

          <div className={styles.footer}>
            {(selectedAirport || selectedAirline) && (
              <Button variant="unstyled" icon={<ArrowBackIcon />} onClick={handleBack}>
                Back
              </Button>
            )}
            <Button
              variant="unstyled"
              className={styles.advancedToggle}
              icon={<SettingsIcon />}
              aria-expanded={showAdvanced}
              aria-controls="overlay-advanced"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Advanced
            </Button>
          </div>

          {showAdvanced && (
            <div id="overlay-advanced" className={styles.advanced}>
              <MonthControls
                months={monthOptions}
                snapshot={snapshot}
                setSnapshot={setSnapshot}
                compare={compare}
                setCompare={setCompare}
                disabled={loading}
              />
              <p className={styles.hint}>
                {compare
                  ? "The comparison is built from these two requests."
                  : "Data snapshot: the month the routes were collected, not a flight schedule."}
              </p>
              {(compare ? [compare.from, snapshot] : [snapshot]).map((month) => {
                const url = buildApiUrl(selectedAirport, selectedAirline, month);
                return (
                  <ExternalLink
                    key={url}
                    href={url}
                    className={styles.apiUrl}
                    title="Open this API request in a new tab"
                  >
                    {url}
                  </ExternalLink>
                );
              })}
              <ExternalLink href="/docs">API docs</ExternalLink>
              <ExternalLink href="/errors">Wikipedia data problems</ExternalLink>
            </div>
          )}

          {changeCount === 0 && (
            <p className={styles.summary}>
              No {change} routes, {range}.
            </p>
          )}

          {compare && !!changeCount && !selectedAirport && !selectedAirline && (
            <ChangedAirports
              airports={airports}
              show={compare.show}
              routeCount={changeCount}
              onSelect={setSelectedAirport}
            />
          )}

          <div role="status" className={styles.status}>
            {loading && "Loading airports and routes…"}
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
};
