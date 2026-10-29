export type Selection = {
  airport: string;
  destination: string;
  airline: string;
};

export const EMPTY_SELECTION: Selection = { airport: "", destination: "", airline: "" };

const AIRPORT = /^[A-Z]{3}$/;
const AIRLINE = /^[A-Z0-9]{2,3}$/;

export const parseSelectionPath = (pathname: string): Selection => {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((p) => p.toUpperCase());

  if (parts.length === 2 && parts[0] === "AIRLINE" && AIRLINE.test(parts[1])) {
    return { ...EMPTY_SELECTION, airline: parts[1] };
  }
  if (parts.length === 1 && AIRPORT.test(parts[0])) {
    return { ...EMPTY_SELECTION, airport: parts[0] };
  }
  if (parts.length === 2 && AIRPORT.test(parts[0]) && AIRPORT.test(parts[1])) {
    return { ...EMPTY_SELECTION, airport: parts[0], destination: parts[1] };
  }
  if (
    parts.length === 3 &&
    AIRPORT.test(parts[0]) &&
    parts[1] === "AIRLINE" &&
    AIRLINE.test(parts[2])
  ) {
    return { ...EMPTY_SELECTION, airport: parts[0], airline: parts[2] };
  }
  return EMPTY_SELECTION;
};

export const buildSelectionPath = ({ airport, destination, airline }: Selection): string => {
  if (airport && destination) return `/${airport}/${destination}`;
  if (airport && airline) return `/${airport}/airline/${airline}`;
  if (airport) return `/${airport}`;
  if (airline) return `/airline/${airline}`;
  return "/";
};

export const selectionTitle = (
  { airport, destination, airline }: Selection,
  airlineName?: string,
): string => {
  const suffix = "Flight Atlas";
  if (airport && destination) return `${airport} to ${destination} direct flights | ${suffix}`;
  if (airport && airline)
    return `${airport} direct flights on ${airlineName ?? airline} | ${suffix}`;
  if (airport) return `${airport} direct flights | ${suffix}`;
  if (airline) return `${airlineName ?? airline} routes | ${suffix}`;
  return `${suffix}: direct flight route map of North America`;
};
