/** Destination-count bins for airport markers, smallest first. Bin n paints `--fa-map-destinations-n`. */
export const DESTINATION_BINS = [
  { max: 10, label: "1–10" },
  { max: 20, label: "11–20" },
  { max: 50, label: "21–50" },
  { max: 100, label: "51–100" },
  { max: Infinity, label: "Over 100" },
] as const;

export const destinationBin = (count: number): number =>
  DESTINATION_BINS.findIndex((bin) => count <= bin.max) + 1;

export const destinationColorToken = (bin: number) => `--fa-map-destinations-${bin}` as const;
