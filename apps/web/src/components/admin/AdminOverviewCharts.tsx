import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const AXIS = "rgba(242, 240, 235, 0.45)";
const GRID = "rgba(242, 240, 235, 0.08)";
const TOOLTIP_BG = "#121214";
const TOOLTIP_BORDER = "rgba(214, 255, 75, 0.25)";

export type OverviewChartSeries = {
  key: string;
  label: string;
  color: string;
};

export function formatOverviewMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return date.toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function buildOverviewChartRows(
  months: string[],
  series: Array<{ key: string; values: number[] }>
): Array<Record<string, string | number>> {
  return months.map((month, index) => {
    const row: Record<string, string | number> = {
      month,
      label: formatOverviewMonthLabel(month),
    };
    for (const s of series) {
      row[s.key] = s.values[index] ?? 0;
    }
    return row;
  });
}

type ChartShellProps = {
  title: string;
  children: React.ReactNode;
};

export function AdminOverviewChartPanel({ title, children }: ChartShellProps) {
  return (
    <div className="admin-overview-chart">
      <h3 className="admin-overview-chart-title">{title}</h3>
      <div className="admin-overview-chart-canvas">{children}</div>
    </div>
  );
}

type BaseChartProps = {
  data: Array<Record<string, string | number>>;
  series: OverviewChartSeries[];
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="admin-overview-tooltip">
      <strong>{label}</strong>
      <ul>
        {payload.map((entry) => (
          <li key={entry.name} style={{ color: entry.color }}>
            {entry.name}:{" "}
            {typeof entry.value === "number"
              ? entry.value.toLocaleString("es-AR")
              : entry.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminOverviewLineChart({ data, series }: BaseChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ stroke: TOOLTIP_BORDER }}
        />
        {series.length > 1 ? (
          <Legend wrapperStyle={{ color: AXIS, fontSize: 12 }} />
        ) : null}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AdminOverviewBarChart({
  data,
  series,
  stacked = false,
}: BaseChartProps & { stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "rgba(214, 255, 75, 0.06)" }}
          wrapperStyle={{ outline: "none" }}
        />
        {series.length > 1 ? (
          <Legend wrapperStyle={{ color: AXIS, fontSize: 12 }} />
        ) : null}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? "stack" : undefined}
            radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const OVERVIEW_CHART_COLORS = {
  primary: "#d6ff4b",
  secondary: "#7dd3c7",
  tertiary: "#f2f0eb",
  muted: "rgba(214, 255, 75, 0.45)",
} as const;

// silence unused TOOLTIP_BG if tree-shaken oddly
void TOOLTIP_BG;
