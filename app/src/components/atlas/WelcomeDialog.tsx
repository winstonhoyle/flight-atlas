import { Button } from "@/components/common/Button";
import { Dialog } from "@/components/common/Dialog";
import { ExternalLink } from "@/components/common/ExternalLink";
import styles from "./WelcomeDialog.module.css";

type WelcomeDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const WelcomeDialog = ({ open, onClose }: WelcomeDialogProps) => (
  <Dialog open={open} onClose={onClose} label="Welcome to Flight Atlas">
    <div className={styles.content}>
      <img src="/logo.svg" alt="" width={180} height={119} />
      <h2 className={styles.title}>Welcome to Flight Atlas</h2>
      <p>
        Explore direct flight routes between airports across the U.S., Canada and Mexico in a fast,
        interactive map. Built with React and serverless AWS services.
      </p>
      <p>
        Read the code on{" "}
        <ExternalLink href="https://github.com/winstonhoyle/flight-atlas">GitHub</ExternalLink> or
        use the data through the <ExternalLink href="/docs.html">API</ExternalLink>.
      </p>
      <p>
        Made by <ExternalLink href="https://winstonhoyle.com">Winston Hoyle</ExternalLink>.
      </p>
      <Button onClick={onClose} data-autofocus>
        Close
      </Button>
    </div>
  </Dialog>
);
