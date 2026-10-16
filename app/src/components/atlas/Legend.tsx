import { useState } from "react";
import { IconButton } from "@/components/common/IconButton";
import { Panel } from "@/components/common/Panel";
import { AddIcon, RemoveIcon } from "@/icons";
import { DESTINATION_BINS, destinationColorToken } from "@/utils/destinations";
import styles from "./Legend.module.css";

export const Legend = () => {
  const [open, setOpen] = useState(() => !window.matchMedia("(max-width: 40em)").matches);

  return (
    <Panel id="legend" className={styles.legend}>
      <div className={styles.header}>
        <h2 className={styles.title} id="legend-title">
          Destinations
        </h2>
        <IconButton
          label={open ? "Collapse legend" : "Expand legend"}
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
                {bin.label}
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
};
