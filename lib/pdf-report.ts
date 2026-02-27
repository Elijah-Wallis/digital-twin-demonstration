"use client";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { DiagnosticData } from "@/components/diagnostic-dashboard";
import { formatCurrency, formatPercent } from "@/lib/utils";

export async function generatePdfReport(
  data: DiagnosticData,
  chartContainer?: HTMLElement | null
): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 18;
  let y = 20;

  function ensureSpace(needed: number) {
    if (y + needed > 270) {
      doc.addPage();
      y = 20;
    }
  }

  // Header
  doc.setTextColor(13, 148, 136);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Eve", margin, y);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Eve Clinic Autonomy", margin + 18, y);
  y += 12;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.clinic_name} \u2014 Diagnostic Report`, margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" })}`,
    margin,
    y
  );
  y += 14;

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Key Metrics
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Key Metrics", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const m = data.metrics;
  const liftDollars = Math.round(m.current_monthly_revenue * (m.revenue_lift_pct / 100));
  const roi = m.roi_multiple ?? Math.round(m.total_savings / m.recommended_pilot_value);

  const metrics: [string, string, string][] = [
    ["Revenue on the table", formatPercent(m.revenue_lift_pct), `${formatCurrency(liftDollars)}/mo currently uncaptured`],
    ["12-month recovered value", formatCurrency(m.total_savings), "Sum of all bottlenecks fixed over 12 months"],
    ["Admin time eliminated", formatPercent(m.staff_reduction_pct), `${Math.round(m.staff_hours_saved_per_week)} hrs/week freed from manual work`],
    ["Time to payback", `${m.payback_months} month${m.payback_months !== 1 ? "s" : ""}`, "Investment pays for itself, then pure upside"],
    ["Pilot investment", formatCurrency(m.recommended_pilot_value), `${roi}x projected return`],
  ];

  metrics.forEach(([label, value, detail]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}: ${value}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(detail, margin + 2, y + 4);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    y += 10;
  });
  y += 4;

  // Charts snapshot
  if (chartContainer) {
    try {
      const canvas = await html2canvas(chartContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#0f1419",
      });
      const img = canvas.toDataURL("image/png");
      const imgW = pageW - 2 * margin;
      const imgH = (canvas.height * imgW) / canvas.width;
      ensureSpace(Math.min(imgH, 120));
      doc.addImage(img, "PNG", margin, y, imgW, Math.min(imgH, 120));
      y += Math.min(imgH, 120) + 8;
    } catch {
      // skip charts if capture fails
    }
  }

  // Bottlenecks
  const bottlenecks = data.bottlenecks ?? [];
  if (bottlenecks.length > 0) {
    ensureSpace(20);
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const totalLeak = bottlenecks.reduce((s, b) => s + b.impactDollars, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0);
    doc.text("Critical Operational Bottlenecks", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`${bottlenecks.length} bottlenecks identified totaling ${formatCurrency(totalLeak)}/month in recoverable revenue`, margin, y);
    y += 8;

    doc.setTextColor(0, 0, 0);
    bottlenecks.forEach((b) => {
      ensureSpace(28);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(b.name, margin, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const impactStr = `$${(b.impactDollars / 1000).toFixed(1)}k/mo (${b.impactPercent}% of revenue)`;
      const ciStr = `${b.confidence}% CI: $${(b.ciLow / 1000).toFixed(1)}k\u2013$${(b.ciHigh / 1000).toFixed(1)}k`;
      doc.text(`Impact: ${impactStr}  |  ${ciStr}`, margin + 2, y);
      y += 5;

      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(b.description, pageW - 2 * margin - 4);
      descLines.forEach((line: string) => {
        ensureSpace(5);
        doc.text(line, margin + 2, y);
        y += 4.5;
      });
      doc.setTextColor(0, 0, 0);
      y += 4;
    });
    y += 4;
  }

  // Executive summary
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Executive Summary", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const split = doc.splitTextToSize(data.narrative, pageW - 2 * margin);
  split.forEach((line: string) => {
    ensureSpace(5);
    doc.text(line, margin, y);
    y += 5;
  });
  y += 8;

  // CTA footer
  ensureSpace(20);
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(
    "Ready to Double the Money you make in less than 90 days?",
    margin,
    y
  );

  doc.save(`Eve-Diagnostic-${data.clinic_name.replace(/\s+/g, "-")}.pdf`);
}
