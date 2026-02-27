import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/lib/supabase";
import { runDiagnostic, getMockDiagnosticResult, type McpDiagnosticResult, type DeeperInput } from "@/lib/mcp";

const deeperSchema = z.object({
  staff_hourly_cost: z.number().min(0).optional(),
  monthly_marketing_spend: z.number().min(0).optional(),
  current_inventory_value: z.number().min(0).optional(),
  csv_row_count: z.number().int().min(0).optional(),
}).optional();

const bodySchema = z.object({
  clinic_name: z.string().min(1),
  monthly_revenue: z.number().min(1),
  staff_count: z.number().int().min(1),
  no_show_rate: z.number().min(0).max(100),
  avg_treatment_value: z.number().min(0),
  number_of_locations: z.number().int().min(1).default(1),
  deeperData: deeperSchema,
});

function fmtDollars(v: number): string {
  return "$" + Math.round(v).toLocaleString();
}

async function generateNarrative(
  clinicName: string,
  result: McpDiagnosticResult
): Promise<string> {
  const state = result.current_state;
  const utilization = (state.provider_utilization as number) ?? 70;
  const treatmentsPerMonth = (state.treatments_per_month as number) ?? 0;
  const adminHrsPerWeek = (state.admin_hours_per_week as number) ?? 0;
  const noShowRate = (state.no_show_rate as number) ?? 0;

  const bottleneckCount = result.bottlenecks.length;
  const totalMonthlyLeak = result.bottlenecks.reduce((s, b) => s + b.impactDollars, 0);
  const topBottleneck = result.bottlenecks[0];

  const fallback =
    `Executive Summary:\n\n` +
    `${clinicName} is currently operating at ${utilization}% provider utilization \u2014 ` +
    `well below the 85% benchmark that separates top-performing clinics from average ones.\n\n` +
    `Our analysis identified ${fmtDollars(totalMonthlyLeak)}/month in recoverable revenue ` +
    `across ${bottleneckCount} operational bottlenecks. ` +
    (topBottleneck
      ? `The largest constraint is ${topBottleneck.name}, costing an estimated ${fmtDollars(topBottleneck.impactDollars)}/month. `
      : "") +
    `At your current ${noShowRate}% no-show rate, you\u2019re permanently losing treatment slots ` +
    `every month \u2014 each one worth ${fmtDollars((state.avg_treatment_value as number) ?? 250)} in revenue that can never be recovered.\n\n` +
    `The compounding effect is significant: no-shows create schedule gaps that reduce staff utilization, ` +
    `which inflates your effective cost-per-treatment, which compresses margins on every patient you DO see. ` +
    `Meanwhile, your team burns ${adminHrsPerWeek} hours/week on admin work that a machine handles better.\n\n` +
    `Eve\u2019s autonomy engine breaks this cycle \u2014 predictive no-show intervention, real-time schedule optimization, ` +
    `and automated patient engagement running 24/7. ` +
    `With a ${fmtDollars(result.recommended_pilot_value)} investment, your projected 12-month return is ` +
    `${fmtDollars(result.total_savings)} \u2014 the math is straightforward: ` +
    `fix the constraint, and throughput increases without adding a single staff member.`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write executive diagnostic summaries for clinic owners. Use Factory Physics / Theory of Constraints framing. " +
              "Tone: trusted advisor revealing hidden losses, not salesperson. ~200 words. " +
              "Include specific numbers. Frame everything as opportunity cost. End with a clear ROI case.",
          },
          {
            role: "user",
            content:
              `Write an executive summary for ${clinicName}. ` +
              `Provider utilization: ${utilization}% (benchmark: 85%). ` +
              `${treatmentsPerMonth} treatments/month at $${(state.avg_treatment_value as number) ?? 250} avg. ` +
              `No-show rate: ${noShowRate}%. Admin overhead: ${adminHrsPerWeek} hrs/week. ` +
              `${bottleneckCount} bottlenecks identified totaling ${fmtDollars(totalMonthlyLeak)}/mo in recoverable revenue. ` +
              `Top bottleneck: ${topBottleneck?.name ?? "schedule inefficiency"} at ${fmtDollars(topBottleneck?.impactDollars ?? 0)}/mo. ` +
              `12-month projected savings: ${fmtDollars(result.total_savings)}. ` +
              `Revenue lift: ${result.revenue_lift}%. Staff admin reduction: ${result.staff_reduction_pct}%. ` +
              `Pilot investment: ${fmtDollars(result.recommended_pilot_value)}. ` +
              `Frame as: every month without fixing this, the clinic permanently loses this money.`,
          },
        ],
        max_tokens: 400,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return text;
  } catch (e) {
    console.warn("OpenAI narrative fallback:", e);
  }
  return fallback;
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { deeperData, ...input } = parsed.data;

    let result: McpDiagnosticResult;
    try {
      result = await runDiagnostic(input, deeperData as DeeperInput | undefined);
    } catch (mcpError) {
      console.warn("MCP diagnostic fallback:", mcpError);
      result = getMockDiagnosticResult(input, deeperData as DeeperInput | undefined);
    }

    const narrative = await generateNarrative(input.clinic_name, result);

    const supabase = createSupabaseClient();
    const row = {
      clinic_name: input.clinic_name,
      input_data: input as unknown as Record<string, unknown>,
      ontology_state: {
        ...(result.current_state as Record<string, unknown>),
        hidden_leaks: result.hidden_leaks,
      },
      projections: {
        "90_day": result["90_day_projection"],
        "12_month": result["12_month_projection"],
        staff_reduction_pct: result.staff_reduction_pct,
        revenue_lift: result.revenue_lift,
        total_savings: result.total_savings,
        recommended_pilot_value: result.recommended_pilot_value,
      } as Record<string, unknown>,
      narrative,
    };

    const { data: insertData, error } = await supabase
      .from("clinic_diagnostics")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        {
          success: true,
          id: null,
          projections: row.projections,
          narrative,
          hidden_leaks: result.hidden_leaks,
          bottlenecks: result.bottlenecks,
          message: "Diagnostic completed; result could not be stored. Use the data below.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      id: (insertData as { id: string })?.id ?? null,
      projections: row.projections,
      narrative,
      hidden_leaks: result.hidden_leaks,
      bottlenecks: result.bottlenecks,
    });
  } catch (e) {
    console.error("Diagnostic API error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
