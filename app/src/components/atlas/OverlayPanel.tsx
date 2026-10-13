import { memo, useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import { Combobox } from "@/components/common/Combobox";
import { ExternalLink } from "@/components/common/ExternalLink";
import { Panel } from "@/components/common/Panel";
import { ArrowBackIcon, CloseIcon, MenuIcon, SettingsIcon } from "@/icons";
import { API_BASE } from "@/services/api";
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
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  loading: boolean;
  error: string | null;
};

const ALL_AIRPORTS: Option = { value: "", label: "All airports" };

const buildApiUrl = (selectedAirport: Airport | null, selectedAirline: string, month: string) => {
  if (month && !selectedAirline && !selectedAirport) {
    return `${API_BASE}/airports?month=${month}`;
  }
  const params = new URLSearchParams();
  if (selectedAirport) params.set("airport", selectedAirport.properties.IATA);
  if (selectedAirline) params.set("airline_code", selectedAirline);
  if (month) params.set("month", month);
  const qs = params.toString();
  return `${API_BASE}/routes${qs ? `?${qs}` : ""}`;
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
  selectedMonth,
  setSelectedMonth,
  loading,
  error,
}: OverlayPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);

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

  const apiUrl = buildApiUrl(selectedAirport, selectedAirline, selectedMonth);

  return (
    <div className={styles.overlay}>
      <Button
        className={styles.toggle}
        icon={isOpen ? <CloseIcon /> : <MenuIcon />}
        aria-expanded={isOpen}
        aria-controls="overlay-panel"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? "Hide panel" : "Menu"}
      </Button>

      {isOpen && (
        <Panel id="overlay-panel" className={styles.panel}>
          <h1 className={styles.title}>Direct flight routes between U.S. airports</h1>

          <Combobox<Option>
            label="Origin airport"
            value={
              selectedAirport
                ? (airportOptions.find((o) => o.value === selectedAirport.properties.IATA) ?? null)
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
              placeholder="Search for an airline"
            />
          )}

          <details className={styles.advanced}>
            <summary className={styles.summary}>
              <SettingsIcon />
              Advanced
            </summary>
            <div className={styles.advancedBody}>
              <p className={styles.hint} id="month-hint">
                Data snapshot: the month the routes were collected, not a flight schedule.
              </p>
              <Combobox<MonthOption>
                label="Data snapshot month"
                size="sm"
                value={
                  monthOptions.find((o) => o.month === selectedMonth) ?? monthOptions[0] ?? null
                }
                onChange={(option) => {
                  if (option) setSelectedMonth(option.month);
                }}
                options={monthOptions}
                placeholder="Select a month"
                getOptionLabel={(o) => o.label}
                getOptionValue={(o) => o.month}
              />
              <ExternalLink
                href={apiUrl}
                className={styles.apiUrl}
                title="Open this API request in a new tab"
              >
                {apiUrl}
              </ExternalLink>
            </div>
          </details>

          {(selectedAirport || routes) && (
            <Button variant="unstyled" icon={<ArrowBackIcon />} onClick={handleBack}>
              Back
            </Button>
          )}

          <div role="status" className={styles.status}>
            {loading && "Loading routes…"}
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
};

export const OverlayPanel = memo(OverlayPanelBase);
