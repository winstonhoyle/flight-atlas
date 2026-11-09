import { Checkbox } from "@/components/common/Checkbox";
import { Combobox } from "@/components/common/Combobox";
import { SegmentedControl } from "@/components/common/SegmentedControl";
import { useI18n } from "@/i18n/context";
import type { Compare, MonthOption, RouteChange } from "@/types";
import { monthsAfter, monthsBefore, shortLabel } from "@/utils/months";
import { changeLabels } from "@/utils/routeChanges";
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

/** Picks the month to show, or two months and which routes changed between them. */
export const MonthControls = ({
  months,
  snapshot,
  setSnapshot,
  compare,
  setCompare,
  disabled,
}: MonthControlsProps) => {
  const { t } = useI18n();
  const earlier = snapshot ? monthsBefore(months, snapshot) : [];
  const labels = changeLabels(t);
  const showOptions = (Object.keys(labels) as RouteChange[]).map((value) => ({
    value,
    label: labels[value],
  }));

  return (
    <>
      <Checkbox
        label={t("Compare months")}
        checked={!!compare}
        disabled={disabled || !earlier.length}
        onChange={(on) => setCompare(on ? { from: earlier[0], show: "added" } : null)}
      />
      {!earlier.length && !compare && (
        <p className={styles.hint}>{t("Needs an earlier month of data to compare with.")}</p>
      )}
      {compare ? (
        <>
          <div className={styles.range}>
            <Combobox<MonthOption>
              label={t("From month")}
              size="sm"
              value={compare.from}
              onChange={(option) => option && setCompare({ ...compare, from: option })}
              options={earlier}
              isDisabled={disabled}
              getOptionLabel={shortLabel}
              getOptionValue={monthValue}
            />
            <span aria-hidden>{t("to")}</span>
            <Combobox<MonthOption>
              label={t("To month")}
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
            label={t("Show")}
            name="route-change"
            options={showOptions}
            value={compare.show}
            onChange={(show) => setCompare({ ...compare, show })}
            disabled={disabled}
          />
        </>
      ) : (
        <Combobox<MonthOption>
          label={t("Data snapshot month")}
          size="sm"
          value={snapshot}
          onChange={(option) => option && setSnapshot(option)}
          options={months}
          isDisabled={disabled}
          placeholder={t("Select a month")}
          getOptionLabel={(o) => o.label}
          getOptionValue={monthValue}
        />
      )}
    </>
  );
};
