import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { ExternalLink } from "@/components/common/ExternalLink";
import { useI18n } from "@/i18n/context";
import { rich } from "@/i18n/rich";
import styles from "./WelcomeDialog.module.css";

type WelcomeDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const WelcomeDialog = ({ open, onClose }: WelcomeDialogProps) => {
  const { t, href } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} label={t("Welcome to Flight Atlas")}>
      <div className={styles.content}>
        <img src="/logo.svg" alt="" width={180} height={119} />
        <h2 className={styles.title}>{t("Welcome to Flight Atlas")}</h2>
        <p>
          {t(
            "Explore direct flight routes between airports across the Americas in a fast, interactive map. Built with React and serverless AWS services.",
          )}
        </p>
        <p>
          {rich(t("Read the code on {github} or use the data through the {api}."), {
            github: (
              <ExternalLink href="https://github.com/winstonhoyle/flight-atlas">
                GitHub
              </ExternalLink>
            ),
            api: <ExternalLink href="/docs">API</ExternalLink>,
          })}
        </p>
        <p>
          {rich(
            t(
              "Routes come from Wikipedia. Gray airports have pages the scraper couldn’t read; see the {problems}.",
            ),
            { problems: <a href={href("/errors")}>{t("data problems")}</a> },
          )}
        </p>
        <p>
          {rich(t("Made by {author}."), {
            author: <ExternalLink href="https://winstonhoyle.com">Winston Hoyle</ExternalLink>,
          })}
        </p>
        <Button onClick={onClose} data-autofocus>
          {t("Close")}
        </Button>
      </div>
    </Dialog>
  );
};
