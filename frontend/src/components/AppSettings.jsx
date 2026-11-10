import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";

const FALLBACK_SEASONS = [
  { key: "current", label: "Current kanna", display: "Current kanna" },
  { key: "future", label: "Future kanna", display: "Future kanna" },
];

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [seasonKey, setSeasonKey] = useState("current");
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    api
      .getMeta()
      .then((data) => {
        setMeta(data);
        setBackendError(false);
      })
      .catch(() => setBackendError(true));
  }, []);

  const seasons = meta?.seasons || FALLBACK_SEASONS;
  const selectedSeason = seasons.find((season) => season.key === seasonKey) || seasons[0];

  return (
    <AppSettingsContext.Provider value={{ meta, seasons, seasonKey, setSeasonKey, selectedSeason, backendError }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
