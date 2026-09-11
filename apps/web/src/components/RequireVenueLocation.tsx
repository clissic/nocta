import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { NoctaLoading } from "./NoctaLoading";
import { LocationRequiredPage } from "../pages/LocationRequiredPage";
import {
  resolveEffectiveVenueCity,
  type EffectiveVenueCity,
} from "../lib/venueCity";

const VenueCityContext = createContext<EffectiveVenueCity | null>(null);

export function useVenueCity() {
  const value = useContext(VenueCityContext);
  if (!value) {
    throw new Error("useVenueCity debe usarse dentro de RequireVenueLocation");
  }
  return value;
}

export function RequireVenueLocation({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [city, setCity] = useState<EffectiveVenueCity | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "denied">(
    "loading"
  );
  const [reason, setReason] = useState<"gps" | "teleport">("gps");
  const [busy, setBusy] = useState(false);

  const resolve = useCallback(
    async (forceGps = false) => {
      setBusy(true);
      setStatus("loading");
      try {
        const next = await resolveEffectiveVenueCity(user, { forceGps });
        setCity(next);
        setStatus("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setCity(null);
        setReason(message === "TELEPORT_NEEDS_CITY" ? "teleport" : "gps");
        setStatus("denied");
      } finally {
        setBusy(false);
      }
    },
    [user]
  );

  useEffect(() => {
    void resolve();
  }, [resolve]);

  if (status === "loading" && !city) {
    return (
      <div className="page-pad">
        <NoctaLoading variant="block" />
      </div>
    );
  }

  if (status === "denied" || !city) {
    return (
      <LocationRequiredPage
        reason={reason}
        busy={busy}
        onRetry={() => void resolve(true)}
      />
    );
  }

  return (
    <VenueCityContext.Provider value={city}>{children}</VenueCityContext.Provider>
  );
}
