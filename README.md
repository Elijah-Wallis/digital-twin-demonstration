# Eve Digital Twin Demonstration

## Overview

The flagship B2B lead magnet for Eve L5_Medspa_IaC. Clinic owners input 5 KPIs and instantly receive a live "Digital Twin" of their practice running under full autonomous ontology — revenue projections, staff reduction, hidden leaks, and a downloadable branded PDF report.

This is the business-version of the "free tire plug" story that turned $0 visitors into $384 customers.

## Purpose

- Demonstrate the power of event-state ontology autonomy to decision-makers
- Generate high-quality, qualified leads for long-term Eve ontology contracts ($75k–$250k+ ACV)
- Collect real clinic data that seeds the cross-clinic hive mind
- Convert 25–40% of demos into paid 90-day pilots

## Sales Flow

### Stage 1 — Instant Diagnostic (5 KPIs)
1. Clinic owner enters: clinic name, monthly revenue, staff count, no-show rate, avg treatment value, locations.
2. Eve runs the diagnostic (MCP ontology engine or mock fallback).
3. Dashboard displays: KPI cards, revenue/trajectory charts, staff allocation pie, **5–7 critical bottlenecks** with dollar impact and confidence intervals, hidden leaks, executive narrative.
4. PDF report downloadable immediately.

### Stage 2 — Deeper Ontology Twin (Free Upgrade)
1. User clicks "Unlock Deeper Ontology Twin (Free Upgrade)" button on the dashboard.
2. Modal collects optional deeper data: staff hourly cost, monthly marketing spend, inventory value, and optional CSV upload.
3. Eve re-runs with tighter confidence intervals (92–99% CI) and identifies 2–4 additional bottlenecks: staff idle time, missed upsell, inventory waste, marketing attribution leakage.
4. Dashboard updates in-place with refined projections, new bottleneck cards, and "Deep Ontology" badge.

### Conversion
- Bottleneck cards with CI ranges build trust and urgency — each one is a quantified problem the pilot solves.
- Two-stage flow keeps friction low while collecting progressively richer data.
- PDF includes full bottleneck analysis with CI ranges for stakeholder sharing.

## Tech Stack & Purpose

| Tool | Purpose |
|-------------------------|---------|
| Next.js 15 App Router | Fast, server-rendered frontend + API routes |
| Supabase | Postgres DB for persisting diagnostics and seeding real ontology states |
| MCP Agents | Core Eve hive-mind ontology engine that performs state shifts and projections |
| shadcn/ui + Tailwind | Premium cyber-medical UI (teal/gold dark theme) |
| Recharts | Interactive before/after revenue, staff, and trajectory charts |
| jsPDF + html2canvas | Generate beautiful branded PDF reports with embedded charts |
| Zod + React Hook Form | Type-safe, robust form validation |
| Lucide React | Clean, consistent icons |
| Vercel | Instant global deployment and hosting |

## How to Run

```bash
npm run demo  # or: npm run dev
```
