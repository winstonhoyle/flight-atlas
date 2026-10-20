import { Combobox } from "@/components/common/Combobox";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import type { Compare, MonthOption, RouteChange } from "@/types";
import { monthsAfter, monthsBefore, shortLabel } from "@/utils/months";
import { CHANGE_LABELS } from "@/utils/routeChanges";
import styles from "./MonthControls.module.css";

type MonthControlsProps = {
  months: MonthOption[];
  /** The month the map shows; the later month when comparing. */
  snapshot: MonthOption | null;
  setSnapshot: (snapshot: MonthOption) => void;
  compare: Compare | null;
  setCompare: (compare: Compare | null) => void;
  disabled: boolean;
};

const monthValue = (m: MonthOption) => `${m.year}-${m.month}`;

const SHOW_OPTIONS = (Object.keys(CHANGE_LABELS) as RouteChange[]).map((value) => ({
  value,
  label: `${CHANGE_LABELS[value]} routes`,
}));

/** Picks the month to show, or two months and which routes changed between them. */
export const MonthControls = ({
  months,
  snapshot,
  setSnapshot,
  compare,
  setCompare,
  disabled,
}: MonthControlsProps) => {
  const earlier = snapshot ? monthsBefore(months, snapshot) : [];

  return (
    <>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={!!compare}
          disabled={disabled || !earlier.length}
          onChange={(e) =>
            setCompare(e.target.checked ? { from: earlier[0], show: "added" } : null)
          }
        />
        Compare months
      </label>
      {!earlier.length && !compare && (
        <p className={styles.hint}>Needs an earlier month of data to compare with.</p>
      )}
      {compare ? (
        <>
          <div className={styles.range}>
            <Combobox<MonthOption>
              label="From month"
              size="sm"
              value={compare.from}
              onChange={(option) => option && setCompare({ ...compare, from: option })}
              options={earlier}
              isDisabled={disabled}
              getOptionLabel={shortLabel}
              getOptionValue={monthValue}
            />
            <span aria-hidden>to</span>
            <Combobox<MonthOption>
              label="To month"
              size="sm"
              value={snapshot}
              onChange={(option) => option && setSnapshot(option)}
              options={monthsAfter(months, compare.from)}
              isDisabled={disabled}
              getOptionLabel={shortLabel}
              getOptionValue={monthValue}
            />
          </div>
          <SegmentedControl<RouteChange>
            label="Show"
            name="route-change"
            options={SHOW_OPTIONS}
            value={compare.show}
            onChange={(show) => setCompare({ ...compare, show })}
            disabled={disabled}
          />
        </>
      ) : (
        <Combobox<MonthOption>
          label="Data snapshot month"
          size="sm"
          value={snapshot}
          onChange={(option) => option && setSnapshot(option)}
          options={months}
          isDisabled={disabled}
          placeholder="Select a month"
          getOptionLabel={(o) => o.label}
          getOptionValue={monthValue}
        />
      )}
    </>
  );
};
