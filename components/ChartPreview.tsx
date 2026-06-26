"use client";

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ChartType } from "@/lib/types";

interface Props {
  data: { x: any; y: any }[];
  chartType: ChartType;
  color: string;
  xField: string;
  yField: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "12px",
};

const PIE_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a855f7", "#ec4899", "#14b8a6"];

export function ChartPreview({ data, chartType, color, xField, yField }: Props) {
  const formatted = data.map((d) => ({
    x: typeof d.x === "string" && d.x.length > 10 ? d.x.slice(0, 10) : d.x,
    y: typeof d.y === "number" ? Math.round(d.y * 1000) / 1000 : d.y,
  }));

  const axisStyle = { fill: "#64748b", fontSize: 11 };
  const gridStyle = { stroke: "rgba(255,255,255,0.05)" };

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="x" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, yField]} labelFormatter={(l) => `${xField}: ${l}`} />
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="x" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, yField]} labelFormatter={(l) => `${xField}: ${l}`} />
          <Bar dataKey="y" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Pie: aggregate by x value
  const aggregated = Object.entries(
    formatted.reduce((acc: Record<string, number>, d) => {
      const key = String(d.x);
      acc[key] = (acc[key] || 0) + (Number(d.y) || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={aggregated} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
          {aggregated.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
}
