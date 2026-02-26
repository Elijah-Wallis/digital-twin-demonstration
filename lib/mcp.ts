export type DiagnosticInput = {
  clinic_name: string;
  monthly_revenue: number;
  staff_count: number;
  no_show_rate: number;
  avg_treatment_value: number;
  number_of_locations: number;
};

export type DeeperInput = {
  staff_hourly_cost?: number;
  monthly_marketing_spend?: number;
  current_inventory_value?: number;
  csv_row_count?: number;
};

export type Bottleneck = {
  name: string;
  impactDollars: number;
  impactPercent: number;
  confidence: number;
  ciLow: number;
  ciHigh: number;
  description: string;
};

export type McpDiagnosticResult = {
  current_state: Record<string, unknown>;
  hidden_leaks: string[];
  bottlenecks: Bottleneck[];
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
  input: DiagnosticInput,
  deeperData?: DeeperInput
): Promise<McpDiagnosticResult> {
  const endpoint = MCP_ENDPOINT || "http://localhost:3001/api/mcp/diagnostic";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clinic_data: input,
      deeper_data: deeperData,
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

function generateMockBottlenecks(
  input: DiagnosticInput,
  deeper?: DeeperInput
): Bottleneck[] {
  const monthly = input.monthly_revenue;
  const noShow = input.no_show_rate / 100;
  const staff = input.staff_count;
  const isDeeper = !!deeper;

  const ciMultiplier = isDeeper ? 0.04 : 0.1;
  const baseConfidence = isDeeper ? 94 : 86;

  const noShowLeak = Math.round(monthly * noShow * 0.6);
  const schedulingCost = Math.round(staff * 22 * 8 * 4.3);
  const recallGap = Math.round(monthly * 0.08);
  const intakeLeak = Math.round(monthly * 0.03);
  const toolFragmentation = Math.round(monthly * 0.045);

  const bottlenecks: Bottleneck[] = [
    {
      name: "No-Show Leakage",
      impactDollars: noShowLeak,
      impactPercent: Math.round((noShowLeak / monthly) * 100),
      confidence: Math.min(99, baseConfidence + 6),
      ciLow: Math.round(noShowLeak * (1 - ciMultiplier)),
      ciHigh: Math.round(noShowLeak * (1 + ciMultiplier)),
      description: `Appointment no-shows at ${input.no_show_rate}% are hemorrhaging revenue. Ontology-driven predictive outreach and dynamic rebooking recover 60–80% of lost slots.`,
    },
    {
      name: "Manual Scheduling Overhead",
      impactDollars: schedulingCost,
      impactPercent: Math.round((schedulingCost / monthly) * 100),
      confidence: Math.min(99, baseConfidence + 2),
      ciLow: Math.round(schedulingCost * (1 - ciMultiplier)),
      ciHigh: Math.round(schedulingCost * (1 + ciMultiplier)),
      description: `Front-desk staff spend ~${Math.round(staff * 8)} hrs/week on manual scheduling. Full autonomy reclaims this as patient-facing time or FTE reduction.`,
    },
    {
      name: "Recall & Reactivation Gap",
      impactDollars: recallGap,
      impactPercent: Math.round((recallGap / monthly) * 100),
      confidence: Math.min(99, baseConfidence + 1),
      ciLow: Math.round(recallGap * (1 - ciMultiplier)),
      ciHigh: Math.round(recallGap * (1 + ciMultiplier)),
      description: "Dormant patients (~15% recoverable) are not being systematically re-engaged. Automated recall sequences reactivate high-LTV patients.",
    },
    {
      name: "Intake & Eligibility Friction",
      impactDollars: intakeLeak,
      impactPercent: Math.round((intakeLeak / monthly) * 100),
      confidence: Math.min(99, baseConfidence),
      ciLow: Math.round(intakeLeak * (1 - ciMultiplier * 1.2)),
      ciHigh: Math.round(intakeLeak * (1 + ciMultiplier * 1.2)),
      description: "Manual eligibility checks and paper intake add ~2.5 hrs FTE/week and delay patient throughput by 8–12 minutes per visit.",
    },
    {
      name: "Tool Fragmentation Tax",
      impactDollars: toolFragmentation,
      impactPercent: Math.round((toolFragmentation / monthly) * 100),
      confidence: Math.min(99, baseConfidence - 1),
      ciLow: Math.round(toolFragmentation * (1 - ciMultiplier * 1.3)),
      ciHigh: Math.round(toolFragmentation * (1 + ciMultiplier * 1.3)),
      description: "Scattered EMR, phone, and SMS systems create handoff gaps, duplicate data entry, and missed follow-ups across the patient journey.",
    },
  ];

  if (isDeeper) {
    const staffHourly = deeper.staff_hourly_cost ?? 28;
    const marketingSpend = deeper.monthly_marketing_spend ?? monthly * 0.08;
    const inventoryValue = deeper.current_inventory_value ?? monthly * 0.15;

    const staffIdleCost = Math.round(staffHourly * staff * 3.5 * 4.3);
    const missedUpsell = Math.round(monthly * 0.065);
    const inventoryWaste = Math.round(inventoryValue * 0.12);
    const marketingLeakage = Math.round(marketingSpend * 0.22);

    bottlenecks.push(
      {
        name: "Staff Idle Time Burn",
        impactDollars: staffIdleCost,
        impactPercent: Math.round((staffIdleCost / monthly) * 100),
        confidence: Math.min(99, baseConfidence + 3),
        ciLow: Math.round(staffIdleCost * (1 - ciMultiplier)),
        ciHigh: Math.round(staffIdleCost * (1 + ciMultiplier)),
        description: `At $${staffHourly}/hr, ~3.5 hrs/week per staff member is lost to idle gaps between appointments. Ontology scheduling eliminates dead time.`,
      },
      {
        name: "Missed Upsell & Cross-Sell",
        impactDollars: missedUpsell,
        impactPercent: Math.round((missedUpsell / monthly) * 100),
        confidence: Math.min(99, baseConfidence + 1),
        ciLow: Math.round(missedUpsell * (1 - ciMultiplier)),
        ciHigh: Math.round(missedUpsell * (1 + ciMultiplier)),
        description: "Treatment recommendations are not systematically surfaced at point-of-care. AI-driven prompts capture 40–60% of missed upsell opportunities.",
      },
      {
        name: "Inventory Waste & Expiry",
        impactDollars: inventoryWaste,
        impactPercent: Math.round((inventoryWaste / monthly) * 100),
        confidence: Math.min(99, baseConfidence),
        ciLow: Math.round(inventoryWaste * (1 - ciMultiplier * 1.1)),
        ciHigh: Math.round(inventoryWaste * (1 + ciMultiplier * 1.1)),
        description: `Current inventory ($${inventoryValue.toLocaleString()}) has ~12% waste from expiry and over-ordering. Predictive procurement aligns stock to demand curves.`,
      }
    );

    if (marketingSpend > 0) {
      bottlenecks.push({
        name: "Marketing Attribution Leakage",
        impactDollars: marketingLeakage,
        impactPercent: Math.round((marketingLeakage / monthly) * 100),
        confidence: Math.min(99, baseConfidence - 1),
        ciLow: Math.round(marketingLeakage * (1 - ciMultiplier * 1.2)),
        ciHigh: Math.round(marketingLeakage * (1 + ciMultiplier * 1.2)),
        description: `$${marketingSpend.toLocaleString()}/mo marketing spend has ~22% unattributed ROI. Ontology closes the loop from ad click to treatment completion.`,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.impactDollars - a.impactDollars);
}

export function getMockDiagnosticResult(
  input: DiagnosticInput,
  deeperData?: DeeperInput
): McpDiagnosticResult {
  const monthly = input.monthly_revenue;
  const staff = input.staff_count;
  const noShow = input.no_show_rate / 100;
  const isDeeper = !!deeperData;

  const baseLift = 8 + noShow * 40 + (input.number_of_locations > 1 ? 5 : 0);
  const revenueLift = Math.min(22, isDeeper ? baseLift * 1.15 : baseLift);
  const baseReduction = 12 + noShow * 25;
  const staffReduction = Math.min(28, isDeeper ? baseReduction * 1.1 : baseReduction);

  const savings =
    monthly * (revenueLift / 100) * 12 +
    (staff * 4500 * (staffReduction / 100)) * 12;
  const pilotValue = input.number_of_locations === 1 ? 8000 : 12000;

  const bottlenecks = generateMockBottlenecks(input, deeperData);

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
    bottlenecks,
    "90_day_projection": {
      revenue_lift_pct: revenueLift * 0.4,
      staff_hours_saved_per_week: staff * 6,
      no_show_reduction_pct: 35,
      payback_months: isDeeper ? 3 : 4,
    },
    "12_month_projection": {
      revenue_lift_pct: revenueLift,
      total_savings: savings,
      staff_reduction_pct: staffReduction,
      roi_multiple: isDeeper ? 3.8 : 3.2,
    },
    staff_reduction_pct: staffReduction,
    revenue_lift: revenueLift,
    total_savings: savings,
    recommended_pilot_value: pilotValue,
  };
}
