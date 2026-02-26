"use client";

import { useRef, useCallback, useState } from "react";
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
import {
  Activity,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Target,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { generatePdfReport } from "@/lib/pdf-report";
import type { Bottleneck } from "@/lib/mcp";

export type DiagnosticData = {
  clinic_name: string;
  narrative: string;
  hidden_leaks: string[];
  bottlenecks?: Bottleneck[];
  input_data?: Record<string, unknown>;
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
    label: "12\u2011mo total savings",
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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 95
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : confidence >= 90
        ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
        : "bg-amber-500/15 text-amber-400 border-amber-500/30";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {confidence}% CI
    </span>
  );
}

function CiRangeBar({
  ciLow,
  ciHigh,
  value,
}: {
  ciLow: number;
  ciHigh: number;
  value: number;
}) {
  const range = ciHigh - ciLow;
  const pos = range > 0 ? ((value - ciLow) / range) * 100 : 50;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>${(ciLow / 1000).toFixed(1)}k</span>
        <span>${(ciHigh / 1000).toFixed(1)}k</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60"
          style={{ left: "0%", width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent border-2 border-accent-foreground shadow-md"
          style={{ left: `${Math.max(0, Math.min(100, pos))}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
    </div>
  );
}

function BottleneckCard({ bottleneck }: { bottleneck: Bottleneck }) {
  return (
    <Card className="border-border/80 bg-card/95 overflow-hidden animate-fade-in-up">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
            <h4 className="font-semibold text-sm text-foreground">
              {bottleneck.name}
            </h4>
          </div>
          <ConfidenceBadge confidence={bottleneck.confidence} />
        </div>

        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-2xl font-bold text-accent">
            ${(bottleneck.impactDollars / 1000).toFixed(1)}k
            <span className="text-base font-normal text-muted-foreground">/mo</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {bottleneck.impactPercent}% of revenue
          </span>
        </div>

        <CiRangeBar
          ciLow={bottleneck.ciLow}
          ciHigh={bottleneck.ciHigh}
          value={bottleneck.impactDollars}
        />

        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          {bottleneck.description}
        </p>
      </CardContent>
    </Card>
  );
}

export function DiagnosticDashboard({ data: initialData }: { data: DiagnosticData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DiagnosticData>(initialData);
  const [deeperOpen, setDeeperOpen] = useState(false);
  const [deeperLoading, setDeeperLoading] = useState(false);
  const [isDeeperRun, setIsDeeperRun] = useState(false);

  const [staffHourlyCost, setStaffHourlyCost] = useState("");
  const [marketingSpend, setMarketingSpend] = useState("");
  const [inventoryValue, setInventoryValue] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

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

  async function handleDeeperSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDeeperLoading(true);

    try {
      const inputData = data.input_data ?? {};
      let csvRowCount = 0;
      if (csvFile) {
        const text = await csvFile.text();
        csvRowCount = text.split("\n").filter((l) => l.trim()).length - 1;
      }

      const deeperData: Record<string, unknown> = {};
      if (staffHourlyCost) deeperData.staff_hourly_cost = parseFloat(staffHourlyCost);
      if (marketingSpend) deeperData.monthly_marketing_spend = parseFloat(marketingSpend);
      if (inventoryValue) deeperData.current_inventory_value = parseFloat(inventoryValue);
      if (csvRowCount > 0) deeperData.csv_row_count = csvRowCount;

      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_name: inputData.clinic_name ?? data.clinic_name,
          monthly_revenue: inputData.monthly_revenue ?? monthly,
          staff_count: inputData.staff_count ?? 8,
          no_show_rate: inputData.no_show_rate ?? 12,
          avg_treatment_value: inputData.avg_treatment_value ?? 250,
          number_of_locations: inputData.number_of_locations ?? 1,
          deeperData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json?.error ?? "Deeper diagnostic failed");
        return;
      }

      const projections = json.projections ?? {};
      const proj90 = (projections["90_day"] as Record<string, unknown>) ?? {};
      const proj12 = (projections["12_month"] as Record<string, unknown>) ?? {};
      const newRevLift = (projections.revenue_lift as number) ?? revLift;

      setData({
        ...data,
        narrative: json.narrative ?? data.narrative,
        hidden_leaks: json.hidden_leaks ?? data.hidden_leaks,
        bottlenecks: json.bottlenecks ?? data.bottlenecks,
        metrics: {
          ...data.metrics,
          revenue_lift_pct: newRevLift,
          total_savings: (projections.total_savings as number) ?? data.metrics.total_savings,
          staff_reduction_pct: (projections.staff_reduction_pct as number) ?? data.metrics.staff_reduction_pct,
          recommended_pilot_value: (projections.recommended_pilot_value as number) ?? data.metrics.recommended_pilot_value,
          projected_revenue_12mo: monthly * 12 * (1 + newRevLift / 100),
          payback_months: (proj90.payback_months as number) ?? data.metrics.payback_months,
          staff_hours_saved_per_week: (proj90.staff_hours_saved_per_week as number) ?? data.metrics.staff_hours_saved_per_week,
          no_show_reduction_pct: (proj90.no_show_reduction_pct as number) ?? data.metrics.no_show_reduction_pct,
          roi_multiple: (proj12.roi_multiple as number) ?? data.metrics.roi_multiple,
        },
      });

      setIsDeeperRun(true);
      setDeeperOpen(false);
      toast.success("Deeper ontology twin complete — projections refined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeeperLoading(false);
    }
  }

  const bottlenecks = data.bottlenecks ?? [];

  return (
    <div ref={containerRef} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {data.clinic_name} — Diagnostic Report
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eve Clinic Autonomy &bull; Palantir for Clinics
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

      {/* KPI Metric Cards */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">Current vs projected revenue</CardTitle>
            <CardDescription>12\u2011month comparison</CardDescription>
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
            <CardTitle className="text-base">12\u2011month trajectory</CardTitle>
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

      {/* Staff Allocation Pie */}
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

      {/* Critical Operational Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-bold text-accent">
              Critical Operational Bottlenecks Identified
            </h2>
            {isDeeperRun && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />
                Deep Ontology
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bottlenecks.map((b, i) => (
              <BottleneckCard key={`${b.name}-${i}`} bottleneck={b} />
            ))}
          </div>
        </div>
      )}

      {/* Deeper Ontology Twin CTA */}
      {!isDeeperRun && (
        <Card className="border-primary/30 bg-primary/5 overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <Dialog open={deeperOpen} onOpenChange={setDeeperOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Unlock Deeper Ontology Twin (Free Upgrade)
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-accent">
                    Deeper Ontology Twin Analysis
                  </DialogTitle>
                  <DialogDescription>
                    Provide additional operational data for Palantir-level precision.
                    All fields are optional — more data means tighter confidence intervals.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleDeeperSubmit} className="grid gap-4 mt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="staff_hourly_cost">Staff Hourly Cost ($)</Label>
                    <Input
                      id="staff_hourly_cost"
                      type="number"
                      placeholder="e.g. 28"
                      value={staffHourlyCost}
                      onChange={(e) => setStaffHourlyCost(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="marketing_spend">Monthly Marketing Spend ($)</Label>
                    <Input
                      id="marketing_spend"
                      type="number"
                      placeholder="e.g. 6000"
                      value={marketingSpend}
                      onChange={(e) => setMarketingSpend(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inventory_value">Current Inventory Value ($)</Label>
                    <Input
                      id="inventory_value"
                      type="number"
                      placeholder="e.g. 12000"
                      value={inventoryValue}
                      onChange={(e) => setInventoryValue(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="csv_upload">Operational CSV (optional)</Label>
                    <Input
                      id="csv_upload"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                      className="bg-background/50 file:text-primary file:font-medium"
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload scheduling, revenue, or appointment data for deeper analysis.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={deeperLoading}
                  >
                    {deeperLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running deeper analysis…
                      </span>
                    ) : (
                      "Run Deeper Ontology Twin"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <p className="text-sm text-muted-foreground max-w-md">
              Provide more data &rarr; get Palantir-level precision and exact fix plan
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hidden Leaks */}
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

      {/* Executive Summary */}
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
            $5,000–$15,000 for a 90\u2011day pilot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
