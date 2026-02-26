"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DiagnosticDashboard, type DiagnosticData } from "@/components/diagnostic-dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DiagnosticIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing id");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/diagnostic/${id}`);
        if (!res.ok) {
          if (res.status === 404) setError("Report not found");
          else setError("Failed to load report");
          return;
        }
        const json = (await res.json()) as {
          clinic_name: string;
          narrative: string;
          hidden_leaks: string[];
          metrics: DiagnosticData["metrics"];
          projections_90: Record<string, unknown>;
          projections_12: Record<string, unknown>;
        };
        if (cancelled) return;
        setData({
          clinic_name: json.clinic_name,
          narrative: json.narrative,
          hidden_leaks: json.hidden_leaks ?? [],
          metrics: json.metrics,
          projections_90: json.projections_90 ?? {},
          projections_12: json.projections_12 ?? {},
        });
      } catch {
        if (!cancelled) setError("Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">{error ?? "Report not found"}</p>
          <Link href="/diagnostic">
            <Button>Start new diagnostic</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      <div className="relative max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link href="/diagnostic">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              ← New diagnostic
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
