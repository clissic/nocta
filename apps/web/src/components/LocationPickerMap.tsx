import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapCoords = { lat: number; lng: number };

type LocationPickerMapProps = {
  center: MapCoords;
  value: MapCoords | null;
  onPick: (coords: MapCoords) => void;
  className?: string;
};

const noctaPinIcon = L.divIcon({
  className: "nocta-map-pin",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" aria-hidden="true">
    <path fill="#d6ff4b" stroke="#111" stroke-width="1.2" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"/>
    <circle cx="14" cy="14" r="5.2" fill="#111"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

export function LocationPickerMap({
  center,
  value,
  onPick,
  className,
}: LocationPickerMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const map = L.map(mapElement.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([center.lat, center.lng], 13);

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

    map.on("click", (event: L.LeafletMouseEvent) => {
      onPickRef.current({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    });

    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Solo montar una vez; center se aplica en el effect siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], map.getZoom() || 13, {
      animate: true,
    });
    requestAnimationFrame(() => map.invalidateSize());
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], {
        icon: noctaPinIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current.on("dragend", () => {
        const pos = markerRef.current?.getLatLng();
        if (!pos) return;
        onPickRef.current({ lat: pos.lat, lng: pos.lng });
      });
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
  }, [value?.lat, value?.lng]);

  return (
    <div className={className ?? "location-picker-map"}>
      <div
        ref={mapElement}
        className="location-picker-map-canvas"
        aria-label="Mapa para elegir la ubicación del espacio"
      />
      <p className="location-picker-hint mb-0">
        Tocá el mapa para marcar el punto. Después podés arrastrar el pin.
      </p>
    </div>
  );
}
