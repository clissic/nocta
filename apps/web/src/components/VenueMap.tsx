import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { NoctaLoading } from "./NoctaLoading";

type Coords = { lat: number; lon: number };

type VenueMapProps = {
  name: string;
  address: string;
  city: string;
  location?: { lat: number; lng: number } | null;
};

const noctaPinIcon = L.divIcon({
  className: "nocta-map-pin",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
    <path fill="#d6ff4b" stroke="#111" stroke-width="1.2" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"/>
    <circle cx="14" cy="14" r="5.2" fill="#111"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
});

async function geocodeAddress(query: string): Promise<Coords | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function fromApiLocation(
  location?: { lat: number; lng: number } | null
): Coords | null {
  if (
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    return null;
  }
  return { lat: location.lat, lon: location.lng };
}

export function VenueMap({
  name,
  address,
  city,
  location,
}: VenueMapProps) {
  const initialCoords = fromApiLocation(location);
  const [coords, setCoords] = useState<Coords | null>(initialCoords);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    initialCoords ? "ready" : "loading"
  );
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const query = [address, city].filter(Boolean).join(", ");

  useEffect(() => {
    const apiCoords = fromApiLocation(location);
    if (apiCoords) {
      setCoords(apiCoords);
      setStatus("ready");
      return;
    }

    let alive = true;
    setCoords(null);
    setStatus("loading");

    void geocodeAddress(query)
      .then((found) => {
        if (!alive) return;
        if (!found) {
          setStatus("error");
          return;
        }
        setCoords(found);
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [query, location?.lat, location?.lng]);

  useEffect(() => {
    if (status !== "ready" || !coords || !mapElement.current) return;

    if (mapRef.current) {
      mapRef.current.setView([coords.lat, coords.lon], 16);
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) mapRef.current?.removeLayer(layer);
      });
      L.marker([coords.lat, coords.lon], { icon: noctaPinIcon })
        .addTo(mapRef.current)
        .bindPopup(name);
      return;
    }

    const map = L.map(mapElement.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([coords.lat, coords.lon], 16);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);
    L.marker([coords.lat, coords.lon], { icon: noctaPinIcon })
      .addTo(map)
      .bindPopup(name);

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 200);

    const ro =
      typeof ResizeObserver !== "undefined" && mapElement.current
        ? new ResizeObserver(() => {
            map.invalidateSize();
          })
        : null;
    if (ro && mapElement.current) ro.observe(mapElement.current);

    return () => {
      window.clearTimeout(resizeTimer);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [coords, name, status]);

  const externalUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    query
  )}`;

  return (
    <div className="venue-detail-map">
      {status === "loading" && (
        <div className="venue-detail-map-fallback text-secondary small">
          <NoctaLoading variant="inline" />
        </div>
      )}
      {status === "error" && (
        <div className="venue-detail-map-fallback">
          <p className="text-secondary small mb-2">No se pudo ubicar el mapa.</p>
          <a
            className="btn btn-sm btn-outline-light"
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver en OpenStreetMap
          </a>
        </div>
      )}
      <div
        ref={mapElement}
        className={`venue-detail-map-canvas${
          status === "ready" ? " is-ready" : ""
        }`}
        aria-label={`Mapa de ${name}`}
        hidden={status !== "ready"}
      />
    </div>
  );
}
