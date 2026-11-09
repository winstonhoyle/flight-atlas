import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { useI18n } from "@/i18n/context";
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, withLocale } from "@/i18n/translate";
import styles from "./LanguageDialog.module.css";

type LanguageDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The current page without its language prefix, such as `/ATL/airline/DL`. */
  path: string;
};

/** Each language is a link to the same page there, so the choice is a normal page load. */
export const LanguageDialog = ({ open, onClose, path }: LanguageDialogProps) => {
  const { t, locale } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} label={t("Language")}>
      <div className={styles.content}>
        <h2 className={styles.title}>{t("Language")}</h2>
        <ul className={styles.list}>
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={withLocale(path, l)}
                hrefLang={LOCALE_TAGS[l]}
                lang={LOCALE_TAGS[l]}
                aria-current={l === locale ? "true" : undefined}
                className={[styles.item, l === locale && styles.current].filter(Boolean).join(" ")}
              >
                {LOCALE_NAMES[l]}
              </a>
            </li>
          ))}
        </ul>
        <Button onClick={onClose} data-autofocus>
          {t("Close")}
        </Button>
      </div>
    </Dialog>
  );
};
