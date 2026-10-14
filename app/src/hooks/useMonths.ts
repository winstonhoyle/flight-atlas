import { useEffect, useState } from "react";
import { fetchMonths } from "@/services/api";
import type { MonthOption } from "@/types";

export const useMonths = () => {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonths()
      .then(setMonths)
      .catch((err: unknown) => {
        console.error("Failed to load months:", err);
        setError("Failed to load available months");
      })
      .finally(() => setLoading(false));
  }, []);

  return { months, loading, error };
};
