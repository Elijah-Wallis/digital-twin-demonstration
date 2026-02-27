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

// ---------------------------------------------------------------------------
// Factory Physics / TOC / Opportunity-Cost Math Engine
// ---------------------------------------------------------------------------

const WORKING_DAYS = 22;
const WEEKS_PER_MONTH = 4.33;
const STAFF_HOURS_PER_DAY = 8;
const AVG_TREATMENT_DURATION_HRS = 0.75; // 45 min medspa average
const BEST_IN_CLASS_UTILIZATION = 0.85;
const PROVIDER_RATIO = 0.6; // 60% of staff are revenue-generating providers
const ADMIN_TIME_RATIO = 0.35; // 35% of staff time is non-revenue admin
const DEFAULT_HOURLY_COST = 30; // fully loaded avg for medspa staff

function deriveClinicMetrics(input: DiagnosticInput, deeper?: DeeperInput) {
  const monthly = input.monthly_revenue;
  const atv = input.avg_treatment_value;
  const staff = input.staff_count;
  const noShow = input.no_show_rate / 100;
  const locs = input.number_of_locations;
  const staffHourly = deeper?.staff_hourly_cost ?? DEFAULT_HOURLY_COST;

  // Little's Law derived throughput
  const treatmentsCompleted = Math.round(monthly / atv);
  const treatmentsPerDay = treatmentsCompleted / WORKING_DAYS;

  // Gross scheduled includes no-shows: completed = scheduled * (1 - noShowRate)
  const grossScheduled = Math.round(treatmentsCompleted / (1 - noShow));
  const noShowAppointments = grossScheduled - treatmentsCompleted;

  // Provider capacity (TOC constraint identification)
  const providers = Math.max(1, Math.round(staff * PROVIDER_RATIO));
  const providerHoursPerMonth = providers * STAFF_HOURS_PER_DAY * WORKING_DAYS;
  const capacityTreatments = Math.round(providerHoursPerMonth / AVG_TREATMENT_DURATION_HRS);
  const currentUtilization = Math.min(0.99, treatmentsCompleted / capacityTreatments);

  // Revenue per available provider hour — the key Factory Physics metric
  const revenuePerProviderHour = monthly / providerHoursPerMonth;

  // Admin burden
  const adminHoursPerWeek = Math.round(staff * ADMIN_TIME_RATIO * 40);
  const adminHoursPerMonth = Math.round(adminHoursPerWeek * WEEKS_PER_MONTH);

  // Schedule gap dead time (variability-induced idle per provider)
  const gapHoursPerProviderPerDay = noShow > 0.08 ? 1.8 : noShow > 0.04 ? 1.2 : 0.8;

  return {
    monthly, atv, staff, noShow, locs, staffHourly,
    treatmentsCompleted, treatmentsPerDay,
    grossScheduled, noShowAppointments,
    providers, providerHoursPerMonth, capacityTreatments,
    currentUtilization, revenuePerProviderHour,
    adminHoursPerWeek, adminHoursPerMonth,
    gapHoursPerProviderPerDay,
  };
}

function generateMockBottlenecks(
  input: DiagnosticInput,
  deeper?: DeeperInput
): Bottleneck[] {
  const m = deriveClinicMetrics(input, deeper);
  const isDeeper = !!deeper;
  const ciMult = isDeeper ? 0.05 : 0.12;
  const baseCi = isDeeper ? 93 : 85;

  // 1. No-Show Revenue Drain
  // Each no-show = an empty chair for ~45 min that can never be recovered.
  // With predictive outreach + waitlist backfill, Eve recovers 65% of lost slots.
  const noShowFullLoss = m.noShowAppointments * m.atv;
  const noShowRecovery = 0.65;
  const noShowImpact = Math.round(noShowFullLoss * noShowRecovery);

  // 2. Schedule Gaps & Dead Time (Little's Law: variability creates queues AND idle)
  // Manual scheduling creates avg 12-18 min gaps between appointments per provider.
  // Dead time per provider/day is driven by arrival variability (CV of no-shows).
  const deadTimeMonthly = m.providers * m.gapHoursPerProviderPerDay * WORKING_DAYS;
  const deadTimeRevenueLost = Math.round(deadTimeMonthly * m.revenuePerProviderHour);

  // 3. Admin & Scheduling Overhead
  // Staff spend 35% of time on non-revenue admin. Eve automates ~70%.
  const adminCostMonthly = Math.round(m.adminHoursPerMonth * m.staffHourly);
  const adminAutomatable = Math.round(adminCostMonthly * 0.70);

  // 4. Recall & Reactivation Gap
  // Industry: 30-40% of patients lapse within 6 months, clinics reactivate <5%.
  // Recoverable = ~15% of monthly patient base * avg treatment value * 80% conversion.
  const recoverablePatients = Math.round(m.treatmentsCompleted * 0.15);
  const recallRevenue = Math.round(recoverablePatients * m.atv * 0.80);

  // 5. Chair Utilization Gap (TOC: exploit the constraint)
  // Gap between current utilization and best-in-class 85%.
  const utilizationGap = Math.max(0, BEST_IN_CLASS_UTILIZATION - m.currentUtilization);
  const utilizationRevenue = Math.round(utilizationGap * m.capacityTreatments * m.atv);

  const bottlenecks: Bottleneck[] = [
    {
      name: "No-Show Revenue Drain",
      impactDollars: noShowImpact,
      impactPercent: Math.round((noShowImpact / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 7),
      ciLow: Math.round(noShowImpact * (1 - ciMult)),
      ciHigh: Math.round(noShowImpact * (1 + ciMult)),
      description: `You're scheduling ~${m.grossScheduled} appointments/month but only completing ${m.treatmentsCompleted}. Every empty chair is ${formatDollars(m.atv)} in revenue gone forever. Eve's predictive outreach and waitlist backfill recover 65% of those lost slots automatically.`,
    },
    {
      name: "Schedule Gap Dead Time",
      impactDollars: deadTimeRevenueLost,
      impactPercent: Math.round((deadTimeRevenueLost / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 4),
      ciLow: Math.round(deadTimeRevenueLost * (1 - ciMult)),
      ciHigh: Math.round(deadTimeRevenueLost * (1 + ciMult)),
      description: `Manual scheduling creates ~${m.gapHoursPerProviderPerDay} hrs/day of dead time per provider — chairs sitting empty between patients. That's ${Math.round(deadTimeMonthly)} lost provider-hours every month. Eve packs schedules intelligently with zero gaps.`,
    },
    {
      name: "Admin Overhead Burn",
      impactDollars: adminAutomatable,
      impactPercent: Math.round((adminAutomatable / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 3),
      ciLow: Math.round(adminAutomatable * (1 - ciMult)),
      ciHigh: Math.round(adminAutomatable * (1 + ciMult)),
      description: `Your team spends ~${m.adminHoursPerWeek} hrs/week on scheduling, confirmations, intake, and follow-ups — that's ${formatDollars(adminCostMonthly)}/mo in wages for work a machine handles better. Eve automates 70% of it instantly.`,
    },
    {
      name: "Dormant Patient Revenue",
      impactDollars: recallRevenue,
      impactPercent: Math.round((recallRevenue / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 1),
      ciLow: Math.round(recallRevenue * (1 - ciMult * 1.2)),
      ciHigh: Math.round(recallRevenue * (1 + ciMult * 1.2)),
      description: `~${recoverablePatients} patients/month should be rebooking but aren't. Each one is worth ${formatDollars(m.atv)} you've already paid to acquire. Eve's automated recall sequences bring them back before they drift to a competitor.`,
    },
  ];

  if (utilizationRevenue > 0) {
    bottlenecks.push({
      name: "Chair Utilization Gap",
      impactDollars: utilizationRevenue,
      impactPercent: Math.round((utilizationRevenue / m.monthly) * 100),
      confidence: Math.min(99, baseCi),
      ciLow: Math.round(utilizationRevenue * (1 - ciMult * 1.3)),
      ciHigh: Math.round(utilizationRevenue * (1 + ciMult * 1.3)),
      description: `Your providers run at ${Math.round(m.currentUtilization * 100)}% utilization — top clinics hit 85%. That ${Math.round(utilizationGap * 100)}% gap means ${Math.round(utilizationGap * m.capacityTreatments)} treatments/month you have the capacity for but aren't delivering. Eve closes this gap by eliminating the variability that causes it.`,
    });
  }

  if (isDeeper) {
    const staffHourly = deeper.staff_hourly_cost ?? DEFAULT_HOURLY_COST;
    const marketingSpend = deeper.monthly_marketing_spend ?? m.monthly * 0.08;
    const inventoryValue = deeper.current_inventory_value ?? m.monthly * 0.15;

    // 6. Staff idle wage burn (direct cost of paying people during dead time)
    const idleWageCost = Math.round(deadTimeMonthly * staffHourly);
    bottlenecks.push({
      name: "Staff Idle Wage Burn",
      impactDollars: idleWageCost,
      impactPercent: Math.round((idleWageCost / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 5),
      ciLow: Math.round(idleWageCost * (1 - ciMult)),
      ciHigh: Math.round(idleWageCost * (1 + ciMult)),
      description: `At $${staffHourly}/hr, you're paying ${formatDollars(idleWageCost)}/mo for staff to stand around during schedule gaps. This is pure waste — wages for zero output. Eve's real-time optimization eliminates idle time entirely.`,
    });

    // 7. Missed upsell / cross-sell
    const avgUpsellValue = Math.round(m.atv * 0.35);
    const upsellOpportunities = Math.round(m.treatmentsCompleted * 0.45);
    const missedUpsellRevenue = Math.round(upsellOpportunities * avgUpsellValue * 0.30);
    bottlenecks.push({
      name: "Missed Treatment Upsell",
      impactDollars: missedUpsellRevenue,
      impactPercent: Math.round((missedUpsellRevenue / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 2),
      ciLow: Math.round(missedUpsellRevenue * (1 - ciMult)),
      ciHigh: Math.round(missedUpsellRevenue * (1 + ciMult)),
      description: `~45% of your patients are candidates for add-on treatments worth ~${formatDollars(avgUpsellValue)} each, but without systematic prompting, 70% of those opportunities walk out the door. Eve surfaces the right recommendation at the right moment.`,
    });

    // 8. Inventory carrying & waste
    const inventoryWaste = Math.round(inventoryValue * 0.11);
    bottlenecks.push({
      name: "Inventory Waste & Carrying Cost",
      impactDollars: inventoryWaste,
      impactPercent: Math.round((inventoryWaste / m.monthly) * 100),
      confidence: Math.min(99, baseCi + 1),
      ciLow: Math.round(inventoryWaste * (1 - ciMult * 1.1)),
      ciHigh: Math.round(inventoryWaste * (1 + ciMult * 1.1)),
      description: `${formatDollars(inventoryValue)} in inventory is losing ~11% to expiry, over-ordering, and carrying cost. That's product sitting on shelves depreciating while cash is tied up. Eve's demand-curve forecasting matches stock to actual usage patterns.`,
    });

    // 9. Marketing attribution gap
    if (marketingSpend > 0) {
      const costPerAcquisition = Math.round(marketingSpend / (m.treatmentsCompleted * 0.3));
      const wastedMarketing = Math.round(marketingSpend * 0.28);
      bottlenecks.push({
        name: "Marketing Spend Blind Spot",
        impactDollars: wastedMarketing,
        impactPercent: Math.round((wastedMarketing / m.monthly) * 100),
        confidence: Math.min(99, baseCi - 1),
        ciLow: Math.round(wastedMarketing * (1 - ciMult * 1.2)),
        ciHigh: Math.round(wastedMarketing * (1 + ciMult * 1.2)),
        description: `Your estimated cost-per-acquisition is ~${formatDollars(costPerAcquisition)}, but ~28% of your ${formatDollars(marketingSpend)}/mo spend has no clear attribution. You're flying blind on which channels actually drive revenue. Eve closes the loop from ad click to completed treatment.`,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.impactDollars - a.impactDollars);
}

function formatDollars(v: number): string {
  return "$" + v.toLocaleString();
}

export function getMockDiagnosticResult(
  input: DiagnosticInput,
  deeperData?: DeeperInput
): McpDiagnosticResult {
  const m = deriveClinicMetrics(input, deeperData);
  const isDeeper = !!deeperData;
  const bottlenecks = generateMockBottlenecks(input, deeperData);

  // Total addressable loss = sum of all bottleneck impacts
  const totalBottleneckImpactMonthly = bottlenecks.reduce((sum, b) => sum + b.impactDollars, 0);

  // Revenue lift = what % of current revenue the bottleneck recovery represents
  // Conservative: assume Eve captures 60% of identified bottleneck value (basic), 72% (deeper)
  const captureRate = isDeeper ? 0.72 : 0.60;
  const recoverableMonthly = Math.round(totalBottleneckImpactMonthly * captureRate);
  const revenueLift = Math.round((recoverableMonthly / m.monthly) * 1000) / 10; // 1 decimal

  // Staff time reduction: admin automation (70% of 35% admin time)
  const adminAutomationPct = 0.70 * ADMIN_TIME_RATIO;
  const staffReduction = Math.round(adminAutomationPct * 1000) / 10; // ~24.5%

  // Hours saved per week
  const hoursSavedPerWeek = Math.round(m.staff * 40 * adminAutomationPct);

  // 12-month savings = recoverable monthly * 12
  const totalSavings12mo = recoverableMonthly * 12;

  // ROI calculation
  const pilotValue = m.locs === 1 ? 8000 : 12000;
  const roiMultiple = Math.round((totalSavings12mo / pilotValue) * 10) / 10;

  // Payback: months to recover pilot cost
  const paybackMonths = Math.max(1, Math.ceil(pilotValue / recoverableMonthly));

  // No-show reduction achievable
  const noShowReduction = isDeeper ? 55 : 42;

  return {
    current_state: {
      monthly_revenue: m.monthly,
      staff_count: m.staff,
      no_show_rate: input.no_show_rate,
      avg_treatment_value: m.atv,
      locations: m.locs,
      treatments_per_month: m.treatmentsCompleted,
      provider_utilization: Math.round(m.currentUtilization * 100),
      admin_hours_per_week: m.adminHoursPerWeek,
    },
    hidden_leaks: [
      `${m.noShowAppointments} appointments/month lost to no-shows → ${formatDollars(m.noShowAppointments * m.atv)} in permanently lost revenue`,
      `${m.adminHoursPerWeek} hrs/week of staff time burned on manual admin that should be automated`,
      `Provider utilization at ${Math.round(m.currentUtilization * 100)}% — top clinics run at 85%+, meaning you have unused capacity sitting idle`,
      `~${Math.round(m.treatmentsCompleted * 0.15)} patients/month should be rebooking but are drifting to competitors`,
      `Every hour of schedule gap costs you ${formatDollars(Math.round(m.revenuePerProviderHour))} in lost throughput — and you can never get that hour back`,
    ],
    bottlenecks,
    "90_day_projection": {
      revenue_lift_pct: Math.round(revenueLift * 0.45 * 10) / 10,
      staff_hours_saved_per_week: hoursSavedPerWeek,
      no_show_reduction_pct: noShowReduction,
      payback_months: paybackMonths,
    },
    "12_month_projection": {
      revenue_lift_pct: revenueLift,
      total_savings: totalSavings12mo,
      staff_reduction_pct: staffReduction,
      roi_multiple: roiMultiple,
    },
    staff_reduction_pct: staffReduction,
    revenue_lift: revenueLift,
    total_savings: totalSavings12mo,
    recommended_pilot_value: pilotValue,
  };
}
