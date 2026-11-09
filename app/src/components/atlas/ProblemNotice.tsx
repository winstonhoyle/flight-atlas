import { useI18n } from "@/i18n/context";
import styles from "./ProblemNotice.module.css";

type ProblemNoticeProps = {
  text: string;
  href: string;
};

export const ProblemNotice = ({ text, href }: ProblemNoticeProps) => {
  const { t } = useI18n();
  return (
    <p className={styles.notice}>
      {text}{" "}
      <a href={href} className={styles.link}>
        {t("Details")}
      </a>
    </p>
  );
};
