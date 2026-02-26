export type DiagnosticInput = {
  clinic_name: string;
  monthly_revenue: number;
  staff_count: number;
  no_show_rate: number;
  avg_treatment_value: number;
  number_of_locations: number;
};

export type McpDiagnosticResult = {
  current_state: Record<string, unknown>;
  hidden_leaks: string[];
  "90_day_projection": Record<string, unknown>;
  "12_month_projection": Record<string, unknown>;
  staff_reduction_pct: number;
  revenue_lift: number;
  total_savings: number;
  recommended_pilot_value: number;
};

const MCP_ENDPOINT =
  process.env.MCP_ENDPOINT || process.env.NEXT_PUBLIC_MCP_ENDPOINT;

export async function runDiagnostic(
  input: DiagnosticInput
): Promise<McpDiagnosticResult> {
  const endpoint = MCP_ENDPOINT || "http://localhost:3001/api/mcp/diagnostic";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clinic_data: input,
      ontology: "L5_Medspa_IaC",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP diagnostic failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as McpDiagnosticResult;
  return data;
}

export function getMockDiagnosticResult(
  input: DiagnosticInput
): McpDiagnosticResult {
  const monthly = input.monthly_revenue;
  const staff = input.staff_count;
  const noShow = input.no_show_rate / 100;
  const revenueLift = Math.min(22, 8 + noShow * 40 + (input.number_of_locations > 1 ? 5 : 0));
  const staffReduction = Math.min(28, 12 + noShow * 25);
  const savings =
    monthly * (revenueLift / 100) * 12 +
    (staff * 4500 * (staffReduction / 100)) * 12;
  const pilotValue = input.number_of_locations === 1 ? 8000 : 12000;
  return {
    current_state: {
      monthly_revenue: monthly,
      staff_count: staff,
      no_show_rate: input.no_show_rate,
      avg_treatment_value: input.avg_treatment_value,
      locations: input.number_of_locations,
    },
    hidden_leaks: [
      "No-show rate is costing an estimated " +
        Math.round(monthly * noShow * 0.6).toLocaleString() +
        "/mo in lost revenue",
      "Front-desk manual scheduling consumes ~" +
        Math.round(staff * 8) +
        " hrs/week",
      "Missed recall and reactivation: ~15% of dormant patients recoverable",
      "Inefficient intake and eligibility checks add ~2.5 hrs FTE/week",
      "Scattered tools (EMR, phone, SMS) create handoff gaps and duplicate entry",
    ],
    "90_day_projection": {
      revenue_lift_pct: revenueLift * 0.4,
      staff_hours_saved_per_week: staff * 6,
      no_show_reduction_pct: 35,
      payback_months: 4,
    },
    "12_month_projection": {
      revenue_lift_pct: revenueLift,
      total_savings: savings,
      staff_reduction_pct: staffReduction,
      roi_multiple: 3.2,
    },
    staff_reduction_pct: staffReduction,
    revenue_lift: revenueLift,
    total_savings: savings,
    recommended_pilot_value: pilotValue,
  };
}
