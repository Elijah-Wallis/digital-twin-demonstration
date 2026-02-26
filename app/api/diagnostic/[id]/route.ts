import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Missing diagnostic id" },
      { status: 400 }
    );
  }
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("clinic_diagnostics")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Diagnostic not found" },
        { status: 404 }
      );
    }

    const row = data as {
      id: string;
      clinic_name: string;
      input_data: Record<string, unknown>;
      ontology_state: Record<string, unknown> | null;
      projections: Record<string, unknown> | null;
      narrative: string | null;
      created_at: string;
    };

    const projections = (row.projections ?? {}) as Record<string, unknown>;
    const ontology = (row.ontology_state ?? {}) as Record<string, unknown>;
    const current = (row.input_data ?? {}) as Record<string, unknown>;
    const monthly = (current.monthly_revenue as number) ?? (ontology.monthly_revenue as number) ?? 0;
    const revLift = (projections.revenue_lift as number) ?? 0;
    const savings = (projections.total_savings as number) ?? 0;
    const staffReduction = (projections.staff_reduction_pct as number) ?? 0;
    const pilotValue = (projections.recommended_pilot_value as number) ?? 10000;
    const proj90 = (projections["90_day"] as Record<string, unknown>) ?? {};
    const proj12 = (projections["12_month"] as Record<string, unknown>) ?? {};
    const hiddenLeaks = (ontology.hidden_leaks as string[]) ?? [];

    return NextResponse.json({
      id: row.id,
      clinic_name: row.clinic_name,
      narrative: row.narrative ?? "",
      created_at: row.created_at,
      input_data: row.input_data,
      metrics: {
        current_monthly_revenue: monthly,
        revenue_lift_pct: revLift,
        total_savings: savings,
        staff_reduction_pct: staffReduction,
        recommended_pilot_value: pilotValue,
        projected_revenue_12mo: monthly * 12 * (1 + revLift / 100),
        payback_months: proj90.payback_months ?? 4,
        staff_hours_saved_per_week: proj90.staff_hours_saved_per_week ?? 0,
        no_show_reduction_pct: proj90.no_show_reduction_pct ?? 35,
        roi_multiple: proj12.roi_multiple ?? 3,
      },
      hidden_leaks: hiddenLeaks,
      projections_90: proj90,
      projections_12: proj12,
    });
  } catch (e) {
    console.error("GET diagnostic error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
