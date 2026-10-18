import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { NoctaLoading } from "./NoctaLoading";
import { colors, fonts, radii, spacing } from "../theme/tokens";

type Coords = { lat: number; lon: number };

type VenueMapProps = {
  name: string;
  address: string;
  city: string;
  country?: string;
  location?: { lat: number; lng: number } | null;
};

const cartoApiKey =
  process.env.EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY?.trim() ?? "";
const CARTO_TILE =
  `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png` +
  (cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : "");
const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

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

async function geocodeAddress(query: string): Promise<Coords | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "NoctaMobile/0.1 (venue-map)",
    },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function buildMapHtml(coords: Coords, name: string): string {
  const lat = coords.lat;
  const lon = coords.lon;
  const title = JSON.stringify(name);
  const tileUrl = JSON.stringify(CARTO_TILE);
  const attribution = JSON.stringify(CARTO_ATTR);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #121214; }
    .nocta-map-pin { background: transparent !important; border: none !important; }
    .leaflet-control-attribution {
      background: rgba(10,10,11,0.82) !important;
      color: rgba(242,240,235,0.55);
      font-size: 10px;
      border-radius: 6px 0 0 0;
    }
    .leaflet-control-attribution a { color: rgba(214,255,75,0.85); }
    .leaflet-control-zoom a {
      background: #18181b !important;
      color: #f2f0eb !important;
      border-color: rgba(242,240,235,0.12) !important;
      width: 32px;
      height: 32px;
      line-height: 32px;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false
    }).setView([${lat}, ${lon}], 16);
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(${tileUrl}, {
      attribution: ${attribution},
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    var icon = L.divIcon({
      className: 'nocta-map-pin',
      html: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path fill="#d6ff4b" stroke="#111" stroke-width="1.2" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="5.2" fill="#111"/></svg>',
      iconSize: [28, 40],
      iconAnchor: [14, 40],
      popupAnchor: [0, -36]
    });
    L.marker([${lat}, ${lon}], { icon: icon }).addTo(map).bindPopup(${title});
    setTimeout(function () { map.invalidateSize(); }, 80);
  </script>
</body>
</html>`;
}

export function VenueMap({
  name,
  address,
  city,
  country,
  location,
}: VenueMapProps) {
  const { width } = useWindowDimensions();
  const mapHeight = Math.round((width * 10) / 16);
  const initialCoords = fromApiLocation(location);
  const [coords, setCoords] = useState<Coords | null>(initialCoords);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    initialCoords ? "ready" : "loading"
  );
  const query = [address, city, country].filter(Boolean).join(", ");
  const externalUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    query
  )}`;

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

  const html = useMemo(
    () => (coords ? buildMapHtml(coords, name) : ""),
    [coords, name]
  );

  return (
    <View style={[styles.root, { height: mapHeight }]}>
      {status === "loading" ? (
        <View style={styles.fallback}>
          <NoctaLoading variant="inline" />
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.fallback}>
          <Text style={styles.errorText}>No se pudo ubicar el mapa.</Text>
          <Pressable
            onPress={() => void Linking.openURL(externalUrl)}
            style={styles.fallbackBtn}
          >
            <Ionicons name="map-outline" size={16} color={colors.primary} />
            <Text style={styles.fallbackBtnText}>Ver en OpenStreetMap</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" && html ? (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          nestedScrollEnabled
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          allowsInlineMediaPlayback
          accessibilityLabel={`Mapa de ${name}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    marginTop: spacing.lg,
    backgroundColor: colors.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: colors.panel,
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.panel,
  },
  errorText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  fallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(214,255,75,0.35)",
  },
  fallbackBtnText: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
});
