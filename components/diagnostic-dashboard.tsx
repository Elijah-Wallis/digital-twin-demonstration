"use client";

import { useRef, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, TrendingUp, DollarSign, Users, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { generatePdfReport } from "@/lib/pdf-report";

export type DiagnosticData = {
  clinic_name: string;
  narrative: string;
  hidden_leaks: string[];
  metrics: {
    current_monthly_revenue: number;
    revenue_lift_pct: number;
    total_savings: number;
    staff_reduction_pct: number;
    recommended_pilot_value: number;
    projected_revenue_12mo: number;
    payback_months: number;
    staff_hours_saved_per_week: number;
    no_show_reduction_pct: number;
    roi_multiple?: number;
  };
  projections_90: Record<string, unknown>;
  projections_12: Record<string, unknown>;
};

const METRIC_CARDS: Array<{
  key: keyof DiagnosticData["metrics"];
  label: string;
  format: (v: number) => string;
  changeKey?: keyof DiagnosticData["metrics"];
  icon: React.ElementType;
}> = [
  {
    key: "revenue_lift_pct",
    label: "Revenue lift",
    format: (v) => formatPercent(v),
    icon: TrendingUp,
  },
  {
    key: "staff_hours_saved_per_week",
    label: "Staff hours saved/week",
    format: (v) => `${Math.round(v)} hrs`,
    icon: Clock,
  },
  {
    key: "payback_months",
    label: "Projected payback",
    format: (v) => `${v} months`,
    icon: Target,
  },
  {
    key: "total_savings",
    label: "12‑mo total savings",
    format: formatCurrency,
    icon: DollarSign,
  },
  {
    key: "staff_reduction_pct",
    label: "Staff time reduction",
    format: (v) => formatPercent(v),
    icon: Users,
  },
  {
    key: "recommended_pilot_value",
    label: "Recommended pilot",
    format: formatCurrency,
    icon: Activity,
  },
];

export function DiagnosticDashboard({
  data,
}: {
  data: DiagnosticData;
  chartRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const monthly = data.metrics.current_monthly_revenue;
  const revLift = data.metrics.revenue_lift_pct;
  const projected = data.metrics.projected_revenue_12mo ?? monthly * 12 * (1 + revLift / 100);
  const currentYear = monthly * 12;

  const barData = [
    { name: "Current", revenue: currentYear, fill: "hsl(var(--muted-foreground) / 0.5)" },
    { name: "Projected", revenue: projected, fill: "hsl(var(--primary))" },
  ];

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const lineData = months.map((m) => ({
    month: `Month ${m}`,
    current: Math.round((currentYear / 12) * m),
    projected: Math.round((projected / 12) * m),
  }));

  const staffManual = Math.max(0, 100 - data.metrics.staff_reduction_pct);
  const staffFreed = data.metrics.staff_reduction_pct;
  const pieData = [
    { name: "Manual (current)", value: staffManual, fill: "hsl(var(--muted-foreground) / 0.6)" },
    { name: "Freed by autonomy", value: staffFreed, fill: "hsl(var(--primary))" },
  ];

  const handleDownloadPdf = useCallback(() => {
    generatePdfReport(data, containerRef.current ?? undefined);
  }, [data]);

  return (
    <div ref={containerRef} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {data.clinic_name} — Diagnostic Report
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eve Clinic Autonomy • Palantir for Clinics
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleDownloadPdf}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          Download Branded PDF Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRIC_CARDS.map(({ key, label, format, icon: Icon }) => {
          const value = data.metrics[key];
          const num = typeof value === "number" ? value : 0;
          return (
            <Card
              key={key}
              className="border-border/80 bg-card/95 overflow-hidden animate-fade-in-up"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{format(num)}</p>
                {(key === "revenue_lift_pct" || key === "total_savings" || key === "staff_reduction_pct") && (
                  <p className="text-xs text-primary mt-1">vs. current state</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">Current vs projected revenue</CardTitle>
            <CardDescription>12‑month comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={55} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">12‑month trajectory</CardTitle>
            <CardDescription>Cumulative revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), ""]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="current"
                  name="Current"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projected"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle className="text-base">Staff allocation</CardTitle>
          <CardDescription>Before vs after autonomy</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.hidden_leaks.length > 0 && (
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">Hidden leaks (ontology)</CardTitle>
            <CardDescription>Identified inefficiencies</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              {data.hidden_leaks.map((leak, i) => (
                <li key={i} className="leading-relaxed">
                  {leak}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle className="text-base">Executive summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
            {data.narrative}
          </p>
          <p className="mt-4 text-sm text-primary font-medium">
            Ready to run on full ontology autonomy in 90 days? Book a pilot call — typically
            $5,000–$15,000 for a 90‑day pilot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
