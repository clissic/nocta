import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, fonts, radii, spacing } from "../theme/tokens";

export type MapCoords = { lat: number; lng: number };

type Props = {
  center: MapCoords;
  value: MapCoords | null;
  onPick: (coords: MapCoords) => void;
};

const cartoApiKey =
  process.env.EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY?.trim() ?? "";
const CARTO_TILE =
  `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png` +
  (cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : "");
const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function buildHtml(center: MapCoords) {
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
    }
    .leaflet-control-attribution a { color: rgba(214,255,75,0.85); }
    .leaflet-control-zoom a {
      background: #18181b !important;
      color: #f2f0eb !important;
      border-color: rgba(242,240,235,0.12) !important;
      width: 32px;
      height: 32px;
      line-height: 32px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${center.lat}, ${center.lng}], 13);
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(${tileUrl}, { attribution: ${attribution}, subdomains: 'abcd', maxZoom: 20 }).addTo(map);
    var icon = L.divIcon({
      className: 'nocta-map-pin',
      html: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path fill="#d6ff4b" stroke="#111" stroke-width="1.2" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"/><circle cx="14" cy="14" r="5.2" fill="#111"/></svg>',
      iconSize: [28, 40],
      iconAnchor: [14, 40]
    });
    var marker = null;
    function post(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
      }
    }
    function place(lat, lng, silent) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: icon, draggable: true }).addTo(map);
        marker.on('dragend', function () {
          var pos = marker.getLatLng();
          post(pos.lat, pos.lng);
        });
      } else {
        marker.setLatLng([lat, lng]);
      }
      try {
        if (silent && !map.getBounds().contains([lat, lng])) map.panTo([lat, lng]);
      } catch (e) {}
      if (!silent) post(lat, lng);
    }
    window.noctaSetView = function (lat, lng) {
      map.setView([lat, lng], map.getZoom() || 13);
      setTimeout(function () { map.invalidateSize(); }, 60);
    };
    window.noctaSetPin = function (lat, lng) { place(lat, lng, true); };
    window.noctaClearPin = function () {
      if (marker) { map.removeLayer(marker); marker = null; }
    };
    map.on('click', function (event) { place(event.latlng.lat, event.latlng.lng, false); });
    setTimeout(function () { map.invalidateSize(); }, 80);
  </script>
</body>
</html>`;
}

export function LocationPickerMap({ center, value, onPick }: Props) {
  const webRef = useRef<WebView>(null);
  const ready = useRef(false);
  const onPickRef = useRef(onPick);
  const centerRef = useRef(center);
  const valueRef = useRef(value);
  onPickRef.current = onPick;
  centerRef.current = center;
  valueRef.current = value;

  const initial = useRef(center);
  const html = useMemo(() => buildHtml(initial.current), []);
  const lastCenter = useRef("");

  function sync() {
    const nextCenter = centerRef.current;
    const key = `${nextCenter.lat},${nextCenter.lng}`;
    const pin = valueRef.current;
    const move =
      lastCenter.current === key
        ? ""
        : `window.noctaSetView(${nextCenter.lat},${nextCenter.lng});`;
    lastCenter.current = key;
    const pinJs = pin
      ? `window.noctaSetPin(${pin.lat},${pin.lng});`
      : "window.noctaClearPin();";
    webRef.current?.injectJavaScript(`${move}${pinJs} true;`);
  }

  useEffect(() => {
    if (!ready.current) return;
    sync();
  }, [center.lat, center.lng, value?.lat, value?.lng]);

  return (
    <View style={styles.wrap}>
      <View style={styles.mapFrame}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.map}
        originWhitelist={["*"]}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          ready.current = true;
          sync();
        }}
        onMessage={(event) => {
          try {
            const coords = JSON.parse(event.nativeEvent.data) as MapCoords;
            if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
            onPickRef.current(coords);
          } catch {
            /* mensaje inválido */
          }
        }}
      />
      </View>
      <Text style={styles.hint}>
        Tocá el mapa para marcar el punto. Después podés arrastrar el pin.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  mapFrame: {
    height: 280,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.panel,
  },
  map: { flex: 1, backgroundColor: colors.panel },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
