import { useState } from "react";
import { IconButton } from "@/components/common/IconButton";
import { useI18n } from "@/i18n/context";
import { Panel } from "@/components/common/Panel";
import { AddIcon, RemoveIcon } from "@/icons";
import { DESTINATION_BINS, destinationColorToken } from "@/utils/destinations";
import styles from "./Legend.module.css";

export const Legend = () => {
  const { t, href } = useI18n();
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 40em)").matches);

  return (
    <Panel id="legend" className={styles.legend}>
      <div className={styles.header}>
        <h2 className={styles.title} id="legend-title">
          {t("Destinations")}
        </h2>
        <IconButton
          label={open ? t("Collapse legend") : t("Expand legend")}
          aria-expanded={open}
          aria-controls="legend-items"
          onClick={() => setOpen(!open)}
        >
          {open ? <RemoveIcon /> : <AddIcon />}
        </IconButton>
      </div>

      {open && (
        <ul id="legend-items" className={styles.items} aria-labelledby="legend-title">
          {DESTINATION_BINS.map((bin, i) => ({ ...bin, n: i + 1 }))
            .reverse()
            .map((bin) => (
              <li key={bin.label} className={styles.item}>
                <span
                  className={styles.swatch}
                  style={{ background: `var(${destinationColorToken(bin.n)})` }}
                  aria-hidden
                />
                {bin.max === Infinity ? t("Over 100") : bin.label}
              </li>
            ))}
          <li className={styles.item}>
            <span className={styles.dash} aria-hidden />
            {t("Seasonal or charter")}
          </li>
          <li className={styles.item}>
            <span
              className={styles.swatch}
              style={{ background: "var(--fa-map-unreadable)" }}
              aria-hidden
            />
            <a href={href("/errors")} className={styles.link}>
              {t("Routes unreadable")}
            </a>
          </li>
        </ul>
      )}
    </Panel>
  );
};
