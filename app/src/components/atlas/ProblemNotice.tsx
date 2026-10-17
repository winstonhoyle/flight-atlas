import styles from "./ProblemNotice.module.css";

type ProblemNoticeProps = {
  text: string;
  href: string;
};

export const ProblemNotice = ({ text, href }: ProblemNoticeProps) => (
  <p className={styles.notice}>
    {text}{" "}
    <a href={href} className={styles.link}>
      Details
    </a>
  </p>
);
