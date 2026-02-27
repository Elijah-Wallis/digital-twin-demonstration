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

function getMetricInsight(key: string, data: DiagnosticData): string {
  const m = data.metrics;
  const monthly = m.current_monthly_revenue;
  const liftDollars = Math.round(monthly * (m.revenue_lift_pct / 100));

  switch (key) {
    case "revenue_lift_pct":
      return `That\u2019s ${formatCurrency(liftDollars)}/mo sitting on the table right now \u2014 money your practice is earning but never collecting.`;
    case "staff_hours_saved_per_week":
      return `${Math.round(m.staff_hours_saved_per_week / 8)} full work-days every month your team spends on tasks a machine handles better, faster, and 24/7.`;
    case "payback_months":
      return m.payback_months <= 2
        ? "The investment pays for itself almost immediately \u2014 everything after is pure upside."
        : `In ${m.payback_months} months the system has paid for itself. Every month after is pure profit.`;
    case "total_savings":
      return `This isn\u2019t theoretical \u2014 it\u2019s the sum of every no-show recovered, every gap filled, and every hour of admin eliminated over 12 months.`;
    case "staff_reduction_pct":
      return "Not layoffs \u2014 liberation. Your team stops doing robot work and starts doing the high-value patient care they were hired for.";
    case "recommended_pilot_value": {
      const roi = m.roi_multiple ?? Math.round(m.total_savings / m.recommended_pilot_value);
      return `${roi}x projected return. For every dollar in, you get ${roi} back in recovered revenue and eliminated waste.`;
    }
    default:
      return "";
  }
}

const METRIC_CARDS: Array<{
  key: keyof DiagnosticData["metrics"];
  label: string;
  format: (v: number) => string;
  icon: React.ElementType;
}> = [
  {
    key: "revenue_lift_pct",
    label: "Revenue you\u2019re leaving on the table",
    format: (v) => formatPercent(v),
    icon: TrendingUp,
  },
  {
    key: "staff_hours_saved_per_week",
    label: "Staff hours freed per week",
    format: (v) => `${Math.round(v)} hrs`,
    icon: Clock,
  },
  {
    key: "payback_months",
    label: "Time to full payback",
    format: (v) => `${v} month${v !== 1 ? "s" : ""}`,
    icon: Target,
  },
  {
    key: "total_savings",
    label: "12\u2011month recovered value",
    format: formatCurrency,
    icon: DollarSign,
  },
  {
    key: "staff_reduction_pct",
    label: "Admin time eliminated",
    format: (v) => formatPercent(v),
    icon: Users,
  },
  {
    key: "recommended_pilot_value",
    label: "Pilot investment",
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
    { name: "With Eve", revenue: projected, fill: "hsl(var(--primary))" },
  ];

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const liftPerMonth = (projected - currentYear) / 12;
  const lineData = months.map((m) => ({
    month: `Month ${m}`,
    current: Math.round((currentYear / 12) * m),
    projected: Math.round((currentYear / 12) * m + liftPerMonth * m * (m / 12)),
  }));

  const staffManual = Math.max(0, 100 - Math.round(data.metrics.staff_reduction_pct));
  const staffFreed = Math.round(data.metrics.staff_reduction_pct);
  const pieData = [
    { name: "Manual (current)", value: staffManual, fill: "hsl(var(--muted-foreground) / 0.6)" },
    { name: "Freed by Eve", value: staffFreed, fill: "hsl(var(--primary))" },
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
      toast.success("Deeper analysis complete \u2014 projections refined with higher confidence");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeeperLoading(false);
    }
  }

  const bottlenecks = data.bottlenecks ?? [];
  const totalBottleneckMonthly = bottlenecks.reduce((s, b) => s + b.impactDollars, 0);

  return (
    <div ref={containerRef} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {data.clinic_name} \u2014 Diagnostic Report
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Eve Clinic Autonomy
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
          const insight = getMetricInsight(key, data);
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
                {insight && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {insight}
                  </p>
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
            <CardDescription>12\u2011month comparison \u2014 the gap is money you\u2019re currently losing</CardDescription>
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
            <CardTitle className="text-base">12\u2011month revenue trajectory</CardTitle>
            <CardDescription>Eve\u2019s impact compounds as automation scales</CardDescription>
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
                <Line type="monotone" dataKey="current" name="Current" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="projected" name="With Eve" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Staff Allocation Pie */}
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <CardTitle className="text-base">Where your team\u2019s time actually goes</CardTitle>
          <CardDescription>Admin vs. patient-facing \u2014 before and after Eve</CardDescription>
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
          <div className="flex flex-col gap-2">
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
            <p className="text-sm text-muted-foreground">
              Your practice is leaking an estimated <span className="text-accent font-semibold">{formatCurrency(totalBottleneckMonthly)}/mo</span> across {bottlenecks.length} identified bottlenecks.
              Each one is a specific, fixable problem \u2014 not a vague suggestion.
            </p>
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
                    Provide additional operational data for higher precision.
                    All fields are optional \u2014 more data means tighter confidence intervals and more specific bottleneck identification.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleDeeperSubmit} className="grid gap-4 mt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="staff_hourly_cost">Staff Hourly Cost ($)</Label>
                    <Input id="staff_hourly_cost" type="number" placeholder="e.g. 28" value={staffHourlyCost} onChange={(e) => setStaffHourlyCost(e.target.value)} className="bg-background/50" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="marketing_spend">Monthly Marketing Spend ($)</Label>
                    <Input id="marketing_spend" type="number" placeholder="e.g. 6000" value={marketingSpend} onChange={(e) => setMarketingSpend(e.target.value)} className="bg-background/50" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inventory_value">Current Inventory Value ($)</Label>
                    <Input id="inventory_value" type="number" placeholder="e.g. 12000" value={inventoryValue} onChange={(e) => setInventoryValue(e.target.value)} className="bg-background/50" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="csv_upload">Operational CSV (optional)</Label>
                    <Input id="csv_upload" type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="bg-background/50 file:text-primary file:font-medium" />
                    <p className="text-xs text-muted-foreground">Upload scheduling, revenue, or appointment data for deeper analysis.</p>
                  </div>
                  <Button type="submit" size="lg" className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90" disabled={deeperLoading}>
                    {deeperLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Running deeper analysis\u2026
                      </span>
                    ) : (
                      "Run Deeper Ontology Twin"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <p className="text-sm text-muted-foreground max-w-md">
              Provide more data \u2192 get higher-precision numbers and an exact fix plan for every bottleneck
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hidden Leaks */}
      {data.hidden_leaks.length > 0 && (
        <Card className="border-border/80 bg-card/95">
          <CardHeader>
            <CardTitle className="text-base">Where the money is going</CardTitle>
            <CardDescription>Operational leaks identified by the diagnostic</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              {data.hidden_leaks.map((leak, i) => (
                <li key={i} className="leading-relaxed">{leak}</li>
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
            Ready to Double the Money you make in less than 90 days?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
