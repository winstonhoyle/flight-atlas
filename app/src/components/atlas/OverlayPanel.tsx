import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { Combobox } from "@/components/common/Combobox";
import { ExternalLink } from "@/components/common/ExternalLink";
import { IconButton } from "@/components/common/IconButton";
import { Panel } from "@/components/common/Panel";
import { useI18n } from "@/i18n/context";
import { ArrowBackIcon, ExpandLessIcon, ExpandMoreIcon, SettingsIcon } from "@/icons";
import { API_BASE, snapshotParams } from "@/services/api";
import type { AirlineSummary, Airport, Compare, MonthOption, Routes } from "@/types";
import { shortLabel } from "@/utils/months";
import { canWebGL, type Renderer } from "@/utils/renderer";
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
  /** With an airline chosen, the airports it flies from; the origin list offers only these. */
  airlineSources?: Set<string> | null;
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
  renderer?: Renderer;
  /** Without this, the panel has no drawing choice. */
  onRendererChange?: (renderer: Renderer) => void;
  children?: ReactNode;
};

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
  airlineSources,
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
  renderer = "canvas",
  onRendererChange,
  children,
}: OverlayPanelProps) => {
  const { t, tn, href } = useI18n();
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
    { value: "", label: t("All airports") },
    ...airports
      .filter((a) => !airlineSources || airlineSources.has(a.properties.IATA))
      .map((a) => ({
        value: a.properties.IATA,
        label: `${a.properties.Name} (${a.properties.IATA})`,
        search: `${a.properties.Name} ${a.properties.IATA} ${a.properties.City ?? ""}`,
      })),
  ];

  const destinationOptions = useMemo<Option[]>(() => {
    if (!routes?.features.length || !airports.length)
      return [{ value: "", label: t("All airports") }];

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
          label: `${match?.properties.Name || t("Unknown airport")} (${code})`,
          search: `${match?.properties.Name ?? ""} ${code} ${match?.properties.City ?? ""}`,
          destinations: match?.properties.destinations ?? 0,
        };
      })
      .sort((a, b) => b.destinations - a.destinations)
      .map(({ value, label, search }) => ({ value, label, search }));

    return [{ value: "", label: t("All airports") }, ...options];
  }, [routes, airports, selectedAirline, t]);

  const airlineOptions: Option[] = [
    { value: "", label: t("All airlines") },
    ...filteredAirlines.map((a) => ({
      value: a.code,
      label:
        selectedAirport || compare ? `${a.name} (${a.destinations ?? 0})` : `${a.name} (${a.code})`,
    })),
  ];

  const range =
    compare && snapshot
      ? t("{from} to {to}", { from: shortLabel(compare.from), to: shortLabel(snapshot) })
      : "";
  // In compare mode, the routes drawn from it, not the marker's count, which includes inbound changes.
  const destinationCount = compare
    ? destinationOptions.length - 1
    : (selectedAirport?.properties.destinations ?? 0);

  return (
    <Panel id="overlay-panel" className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("Direct flight routes")}</h1>
          {snapshot && (
            <p className={styles.snapshot}>
              {compare
                ? compare.show === "added"
                  ? t("New routes, {range}", { range })
                  : t("Lost routes, {range}", { range })
                : t("Data from {month}", { month: snapshot.label })}
            </p>
          )}
        </div>
        <IconButton
          label={isOpen ? t("Collapse panel") : t("Expand panel")}
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
              label={t("Origin airport")}
              value={
                selectedAirport
                  ? (airportOptions.find((o) => o.value === selectedAirport.properties.IATA) ??
                    null)
                  : null
              }
              onChange={(option) => {
                setDestinationAirport(null);
                setSelectedAirport(option && findAirport(option.value));
              }}
              options={airportOptions}
              isClearable
              isDisabled={loading}
              placeholder={t("Search for an airport")}
              getOptionSearch={(o) => o.search ?? o.label}
            />

            {selectedAirport && (
              <Combobox<Option>
                label={t("Destination airport")}
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
                placeholder={t("Search for a destination")}
                getOptionSearch={(o) => o.search ?? o.label}
              />
            )}

            {!destinationAirport && (
              <Combobox<Option>
                label={t("Airline")}
                value={
                  selectedAirline
                    ? (airlineOptions.find((o) => o.value === selectedAirline) ?? null)
                    : airlineOptions[0]
                }
                onChange={(option) => setSelectedAirline(option?.value ?? "")}
                options={airlineOptions}
                isClearable={!!selectedAirline}
                isDisabled={loading}
                placeholder={t("Search for an airline")}
              />
            )}
          </div>

          {selectedAirport && !destinationAirport && (
            <p className={styles.summary}>
              {compare
                ? compare.show === "added"
                  ? tn(
                      "{airport} has new routes to {n} destination.",
                      "{airport} has new routes to {n} destinations.",
                      destinationCount,
                      { airport: selectedAirport.properties.Name },
                    )
                  : tn(
                      "{airport} has lost routes to {n} destination.",
                      "{airport} has lost routes to {n} destinations.",
                      destinationCount,
                      { airport: selectedAirport.properties.Name },
                    )
                : tn(
                    "{airport} has direct flights to {n} destination.",
                    "{airport} has direct flights to {n} destinations.",
                    destinationCount,
                    { airport: selectedAirport.properties.Name },
                  )}
            </p>
          )}

          {children}

          <div className={styles.footer}>
            {(selectedAirport || selectedAirline) && (
              <Button variant="unstyled" icon={<ArrowBackIcon />} onClick={handleBack}>
                {t("Back")}
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
              {t("Advanced")}
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
                  ? t("The comparison is built from these two requests.")
                  : t("Data snapshot: the month the routes were collected, not a flight schedule.")}
              </p>
              {onRendererChange && canWebGL() && (
                <Checkbox
                  label={t("Draw the map with your GPU")}
                  checked={renderer === "webgl"}
                  onChange={(on) => onRendererChange(on ? "webgl" : "canvas")}
                />
              )}
              {(compare ? [compare.from, snapshot] : [snapshot]).map((month) => {
                const url = buildApiUrl(selectedAirport, selectedAirline, month);
                return (
                  <ExternalLink
                    key={url}
                    href={url}
                    className={styles.apiUrl}
                    title={t("Open this API request in a new tab")}
                  >
                    {url}
                  </ExternalLink>
                );
              })}
              <ExternalLink href="/docs">{t("API docs")}</ExternalLink>
              <ExternalLink href={href("/errors")}>{t("Wikipedia data problems")}</ExternalLink>
            </div>
          )}

          {changeCount === 0 && (
            <p className={styles.summary}>
              {compare?.show === "added"
                ? t("No new routes, {range}.", { range })
                : t("No lost routes, {range}.", { range })}
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
            {loading && t("Loading airports and routes…")}
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
