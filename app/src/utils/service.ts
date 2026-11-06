import type { Service } from "@/types";

export const SERVICE_LABELS: Record<Service, string> = {
  s: "Seasonal",
  c: "Charter",
  sc: "Seasonal charter",
};

export const isService = (marker: string | undefined): marker is Service =>
  marker !== undefined && marker in SERVICE_LABELS;
