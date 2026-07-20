import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "../../domain/types";
import { formatCompactCurrency, formatCurrency } from "../../utils/format";

interface PerformanceChartProps {
  trend: TrendPoint[];
  reportingPeriod: string;
  reportingDate: string;
  scopeLabel: string;
}

interface TooltipPayloadItem {
  color: string;
  dataKey: "pv" | "ev" | "ac";
  value: number;
}

const seriesName = {
  pv: "Planned value",
  ev: "Earned value",
  ac: "Actual cost",
};

function PerformanceTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <strong>Period {label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey} style={{ color: item.color }}>
          {seriesName[item.dataKey]}: {formatCurrency(item.value)}
        </span>
      ))}
    </div>
  );
}

export function PerformanceChart({
  trend,
  reportingPeriod,
  reportingDate,
  scopeLabel,
}: PerformanceChartProps) {
  const chartData = trend.map((point) => ({
    ...point,
    ev: point.period <= reportingDate ? point.ev : null,
    ac: point.period <= reportingDate ? point.ac : null,
  }));

  return (
    <section className="panel performance-panel" aria-labelledby="performance-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Cumulative performance</p>
          <h2 id="performance-title">Planned, earned and actual</h2>
          <p className="panel__description">
            {scopeLabel} curve across {trend.length} validated reporting {trend.length === 1 ? "period" : "periods"}.
          </p>
        </div>
        <span className="reporting-period">Status point: {reportingPeriod}</span>
      </div>

      <div className="chart" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 800, height: 340 }}
        >
          <LineChart
            accessibilityLayer={false}
            data={chartData}
            margin={{ top: 10, right: 18, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#d8e3e8" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={formatCompactCurrency}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip content={<PerformanceTooltip />} />
            <Legend iconType="line" />
            <Line
              type="monotone"
              dataKey="pv"
              name="Planned value"
              stroke="#4f6f83"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ev"
              name="Earned value"
              stroke="#0f8b8d"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ac"
              name="Actual cost"
              stroke="#c25b45"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="chart-data">
        <summary>View chart data as a table</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Cumulative planned value, earned value and actual cost by week
            </caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Planned value</th>
                <th scope="col">Earned value</th>
                <th scope="col">Actual cost</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{point.label}</th>
                  <td>{formatCurrency(point.pv)}</td>
                  <td>
                    {point.period <= reportingDate
                      ? formatCurrency(point.ev)
                      : "Not reported"}
                  </td>
                  <td>
                    {point.period <= reportingDate
                      ? formatCurrency(point.ac)
                      : "Not reported"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
