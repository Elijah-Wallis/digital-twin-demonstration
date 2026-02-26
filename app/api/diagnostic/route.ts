import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/lib/supabase";
import { runDiagnostic, getMockDiagnosticResult, type McpDiagnosticResult } from "@/lib/mcp";

const bodySchema = z.object({
  clinic_name: z.string().min(1),
  monthly_revenue: z.number().min(1),
  staff_count: z.number().int().min(1),
  no_show_rate: z.number().min(0).max(100),
  avg_treatment_value: z.number().min(0),
  number_of_locations: z.number().int().min(1).default(1),
});

async function generateNarrative(
  clinicName: string,
  result: McpDiagnosticResult
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return (
      `${clinicName} can unlock significant efficiency and revenue gains with Eve's ontology-driven autonomy. ` +
      `Our diagnostic shows a potential revenue lift of ${result.revenue_lift}% and staff time savings of ${result.staff_reduction_pct}%, ` +
      `with total projected savings of $${Math.round(result.total_savings).toLocaleString()} over 12 months. ` +
      `Hidden operational leaks—from no-shows to manual scheduling—are quantified and addressable through a structured 90-day pilot. ` +
      `We recommend a pilot investment of $${result.recommended_pilot_value.toLocaleString()} to $15,000 to deploy full autonomy and capture these gains.`
    );
  }
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
              "You write concise, professional B2B executive summaries for clinic owners. Exactly ~150 words. Tone: confident, data-driven, no fluff.",
          },
          {
            role: "user",
            content: `Write an executive narrative paragraph for this clinic diagnostic result. Clinic: ${clinicName}. Revenue lift: ${result.revenue_lift}%. Staff reduction potential: ${result.staff_reduction_pct}%. Total 12-month savings: $${Math.round(result.total_savings).toLocaleString()}. Recommended pilot: $${result.recommended_pilot_value.toLocaleString()}-15k. Mention hidden leaks (no-shows, manual scheduling, recall gaps) and 90-day autonomy vision. End with CTA for pilot call.`,
          },
        ],
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return text;
  } catch (e) {
    console.warn("OpenAI narrative fallback:", e);
  }
  return (
    `${clinicName} can unlock significant efficiency and revenue gains with Eve's ontology-driven autonomy. ` +
    `Our diagnostic shows a potential revenue lift of ${result.revenue_lift}% and staff time savings of ${result.staff_reduction_pct}%, ` +
    `with total projected savings of $${Math.round(result.total_savings).toLocaleString()} over 12 months. ` +
    `Hidden operational leaks—from no-shows to manual scheduling—are quantified and addressable through a structured 90-day pilot. ` +
    `We recommend a pilot investment of $${result.recommended_pilot_value.toLocaleString()} to $15,000 to deploy full autonomy and capture these gains.`
  );
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
    const input = parsed.data;

    let result: McpDiagnosticResult;
    try {
      result = await runDiagnostic(input);
    } catch (mcpError) {
      console.warn("MCP diagnostic fallback:", mcpError);
      result = getMockDiagnosticResult(input);
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
          message:
            "Diagnostic completed; result could not be stored. Use the data below.",
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
