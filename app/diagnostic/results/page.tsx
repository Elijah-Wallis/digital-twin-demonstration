"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DiagnosticDashboard, type DiagnosticData } from "@/components/diagnostic-dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bottleneck } from "@/lib/mcp";

function normalizeStoredResult(raw: unknown): DiagnosticData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const projections = (o.projections as Record<string, unknown>) ?? {};
  const input = (o.input_data as Record<string, unknown>) ?? {};
  const monthly = (input.monthly_revenue as number) ?? (projections.monthly_revenue as number) ?? 0;
  const revLift = (projections.revenue_lift as number) ?? 0;
  const proj90 = (projections["90_day"] as Record<string, unknown>) ?? {};
  const proj12 = (projections["12_month"] as Record<string, unknown>) ?? {};
  return {
    clinic_name: (o.clinic_name as string) ?? "Your Clinic",
    narrative: (o.narrative as string) ?? "",
    hidden_leaks: Array.isArray(o.hidden_leaks) ? o.hidden_leaks : [],
    bottlenecks: Array.isArray(o.bottlenecks) ? (o.bottlenecks as Bottleneck[]) : [],
    input_data: input,
    metrics: {
      current_monthly_revenue: monthly,
      revenue_lift_pct: revLift,
      total_savings: (projections.total_savings as number) ?? 0,
      staff_reduction_pct: (projections.staff_reduction_pct as number) ?? 0,
      recommended_pilot_value: (projections.recommended_pilot_value as number) ?? 10000,
      projected_revenue_12mo: monthly * 12 * (1 + revLift / 100),
      payback_months: (proj90.payback_months as number) ?? 4,
      staff_hours_saved_per_week: (proj90.staff_hours_saved_per_week as number) ?? 0,
      no_show_reduction_pct: (proj90.no_show_reduction_pct as number) ?? 35,
      roi_multiple: (proj12.roi_multiple as number) ?? 3,
    },
    projections_90: proj90,
    projections_12: proj12,
  };
}

export default function DiagnosticResultsPage() {
  const router = useRouter();
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("eve-diagnostic-result");
    if (!stored) {
      router.replace("/diagnostic");
      return;
    }
    try {
      const parsed = JSON.parse(stored) as unknown;
      const normalized = normalizeStoredResult(parsed);
      setData(normalized);
    } catch {
      router.replace("/diagnostic");
    } finally {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      <div className="relative max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link href="/diagnostic">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              &larr; New diagnostic
            </Button>
          </Link>
        </div>
        <div className="animate-fade-in-up">
          <DiagnosticDashboard data={data} />
        </div>
      </div>
    </div>
  );
}
