"use client";

import { useId } from "react";

const CHART_COLORS = ["#1d6846", "#d69a35", "#51799c", "#9a5f82", "#70a07c", "#b45d55"];

export function TrendChart({
  points,
  formatValue,
}: {
  points: Array<{ label: string; value: number }>;
  formatValue: (value: number) => string;
}) {
  const gradientId = useId().replaceAll(":", "");
  const width = 720;
  const height = 250;
  const paddingX = 28;
  const paddingTop = 22;
  const paddingBottom = 38;
  const maximum = Math.max(...points.map((point) => point.value), 0);
  const scaleMaximum = Math.max(maximum, 1);
  const drawableHeight = height - paddingTop - paddingBottom;
  const drawableWidth = width - paddingX * 2;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: paddingX + (points.length <= 1 ? 0 : (index / (points.length - 1)) * drawableWidth),
    y: paddingTop + drawableHeight - (point.value / scaleMaximum) * drawableHeight,
  }));
  const line = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = coordinates.length ? `${line} L${coordinates.at(-1)!.x},${height - paddingBottom} L${coordinates[0]!.x},${height - paddingBottom} Z` : "";
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="trend-chart">
      <div className="trend-chart-summary"><span>Pic de la période</span><strong>{formatValue(maximum)}</strong></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution du chiffre d’affaires">
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d6846" stopOpacity=".2" /><stop offset="1" stopColor="#1d6846" stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map((ratio) => {
          const y = paddingTop + drawableHeight * ratio;
          return <line key={ratio} x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="chart-grid-line" />;
        })}
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} className="chart-line" />}
        {coordinates.map((point, index) => (
          <g key={`${point.label}:${index}`}>
            <circle cx={point.x} cy={point.y} r="3.5" className="chart-point"><title>{point.label} : {formatValue(point.value)}</title></circle>
            {(index % labelEvery === 0 || index === coordinates.length - 1) && <text x={point.x} y={height - 12} textAnchor="middle" className="chart-axis-label">{point.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DonutChart({ data, emptyLabel }: { data: Array<{ label: string; value: number }>; emptyLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const segments = data.map((item, index) => ({
    ...item,
    percentage: (item.value / total) * 100,
    offset: data.slice(0, index).reduce((sum, previous) => sum + (previous.value / total) * 100, 0),
  }));

  if (!total) return <div className="chart-empty">{emptyLabel}</div>;

  return (
    <div className="donut-chart">
      <div className="donut-visual">
        <svg viewBox="0 0 42 42" role="img" aria-label={`${total} éléments répartis par état`}>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#edf1ef" strokeWidth="5" />
          {segments.map((item, index) => <circle key={item.label} cx="21" cy="21" r="15.9155" fill="none" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth="5" strokeDasharray={`${item.percentage} ${100 - item.percentage}`} strokeDashoffset={-item.offset} strokeLinecap="butt"><title>{item.label} : {item.value}</title></circle>)}
        </svg>
        <div><strong>{total}</strong><span>Total</span></div>
      </div>
      <ul className="donut-legend">
        {data.map((item, index) => <li key={item.label}><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span>{item.label}</span><strong>{item.value}</strong></li>)}
      </ul>
    </div>
  );
}
