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
  doc.text("Palantir for Clinics", margin + 18, y);
  y += 12;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.clinic_name} \u2014 Autonomy Diagnostic Report`, margin, y);
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
  doc.text("Key metrics", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const metrics = [
    ["Revenue lift", formatPercent(data.metrics.revenue_lift_pct)],
    ["12\u2011month total savings", formatCurrency(data.metrics.total_savings)],
    ["Staff time reduction", formatPercent(data.metrics.staff_reduction_pct)],
    ["Projected payback", `${data.metrics.payback_months} months`],
    ["Staff hours saved/week", `${Math.round(data.metrics.staff_hours_saved_per_week)} hrs`],
    ["Recommended pilot", formatCurrency(data.metrics.recommended_pilot_value)],
  ];
  const labelWidth = 52;
  metrics.forEach(([label, value]) => {
    doc.text(`${label}: `, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, margin + labelWidth, y);
    doc.setFont("helvetica", "normal");
    y += 6;
  });
  y += 6;

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

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 130, 0);
    doc.text("Critical Operational Bottlenecks Identified", margin, y);
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
  doc.text("Executive summary", margin, y);
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
    "Ready to run on full ontology autonomy in 90 days?",
    margin,
    y
  );
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "Book a pilot call \u2014 typically $5,000\u2013$15,000 for a 90\u2011day pilot.",
    margin,
    y
  );

  doc.save(`Eve-Diagnostic-${data.clinic_name.replace(/\s+/g, "-")}.pdf`);
}
