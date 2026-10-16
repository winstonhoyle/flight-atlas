import { memo, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/common/Button";
import { Combobox } from "@/components/common/Combobox";
import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { Panel } from "@/components/common/Panel";
import { ArrowBackIcon, ExpandLessIcon, ExpandMoreIcon, SettingsIcon } from "@/icons";
import { API_BASE, snapshotParams } from "@/services/api";
import type { AirlineSummary, Airport, MonthOption, Routes } from "@/types";
import styles from "./OverlayPanel.module.css";

type Option = { value: string; label: string };

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
  setSelectedRoute: (route: string[]) => void;
  monthOptions: MonthOption[];
  snapshot: MonthOption | null;
  setSnapshot: (snapshot: MonthOption) => void;
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

const OverlayPanelBase = ({
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
  setSelectedRoute,
  monthOptions,
  snapshot,
  setSnapshot,
  loading,
  error,
  children,
}: OverlayPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const findAirport = (iata: string) => airports.find((a) => a.properties.IATA === iata) ?? null;

  const airportOptions: Option[] = [
    ALL_AIRPORTS,
    ...airports.map((a) => ({
      value: a.properties.IATA,
      label: `${a.properties.Name} (${a.properties.IATA})`,
    })),
  ];

  const destinationOptions = useMemo<Option[]>(() => {
    if (!routes?.features.length || !airports.length) return [ALL_AIRPORTS];

    const dstCodes = new Set(routes.features.map((f) => f.properties.dst_airport).filter(Boolean));
    const options = [...dstCodes]
      .map((code) => {
        const match = airports.find((a) => a.properties.IATA === code);
        return {
          value: code,
          label: `${match?.properties.Name || "Unknown airport"} (${code})`,
          destinations: match?.properties.destinations ?? 0,
        };
      })
      .sort((a, b) => b.destinations - a.destinations)
      .map(({ value, label }) => ({ value, label }));

    return [ALL_AIRPORTS, ...options];
  }, [routes, airports]);

  const airlineOptions: Option[] = [
    { value: "", label: "All airlines" },
    ...filteredAirlines.map((a) => ({
      value: a.code,
      label: selectedAirport ? `${a.name} (${a.destinations ?? 0})` : `${a.name} (${a.code})`,
    })),
  ];

  const apiUrl = buildApiUrl(selectedAirport, selectedAirline, snapshot);

  return (
    <Panel id="overlay-panel" className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Direct U.S. flight routes</h1>
          {snapshot && <p className={styles.snapshot}>Data from {snapshot.label}</p>}
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
                if (!option) {
                  handleBack();
                  return;
                }
                if (destinationAirport) setDestinationAirport(null);
                if (selectedAirline) setSelectedAirline("");
                setSelectedAirport(findAirport(option.value));
              }}
              options={airportOptions}
              isClearable
              isDisabled={loading}
              placeholder="Search for an airport"
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
                onChange={(option) => {
                  if (!option) {
                    handleBack();
                    return;
                  }
                  setDestinationAirport(findAirport(option.value));
                  setSelectedRoute([selectedAirport.properties.IATA, option.value]);
                }}
                options={destinationOptions}
                isClearable
                isDisabled={loading}
                placeholder="Search for a destination"
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
                onChange={(option) => {
                  if (option) setSelectedAirline(option.value);
                  else handleBack();
                }}
                options={airlineOptions}
                isClearable
                isDisabled={loading}
                placeholder="Search for an airline"
              />
            )}
          </div>

          {selectedAirport && !destinationAirport && (
            <p className={styles.summary}>
              {selectedAirport.properties.Name} has direct flights to{" "}
              {selectedAirport.properties.destinations}{" "}
              {selectedAirport.properties.destinations === 1 ? "destination" : "destinations"}.
            </p>
          )}

          {children}

          <div className={styles.footer}>
            {(selectedAirport || routes) && (
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
              <p className={styles.hint}>
                Data snapshot: the month the routes were collected, not a flight schedule.
              </p>
              <Combobox<MonthOption>
                label="Data snapshot month"
                size="sm"
                value={snapshot}
                onChange={(option) => {
                  if (option) setSnapshot(option);
                }}
                options={monthOptions}
                isDisabled={loading}
                placeholder="Select a month"
                getOptionLabel={(o) => o.label}
                getOptionValue={(o) => `${o.year}-${o.month}`}
              />
              <ExternalLink
                href={apiUrl}
                className={styles.apiUrl}
                title="Open this API request in a new tab"
              >
                {apiUrl}
              </ExternalLink>
            </div>
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

export const OverlayPanel = memo(OverlayPanelBase);
