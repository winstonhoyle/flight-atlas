import type { Translate } from "@/i18n/translate";
import type { Service } from "@/types";

export const serviceLabels = (t: Translate): Record<Service, string> => ({
  s: t("Seasonal"),
  c: t("Charter"),
  sc: t("Seasonal charter"),
});

export const isService = (marker: string | undefined): marker is Service =>
  marker === "s" || marker === "c" || marker === "sc";
