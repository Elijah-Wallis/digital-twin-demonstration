"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Activity, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

const diagnosticSchema = z.object({
  clinic_name: z.string().min(1, "Clinic name is required"),
  monthly_revenue: z.coerce.number().min(1, "Enter monthly revenue"),
  staff_count: z.coerce.number().int().min(1, "Enter staff count"),
  no_show_rate: z.coerce.number().min(0).max(100, "0–100%"),
  avg_treatment_value: z.coerce.number().min(0, "Enter avg treatment value"),
  number_of_locations: z.coerce.number().int().min(1).default(1),
});

type DiagnosticFormValues = z.infer<typeof diagnosticSchema>;

export default function DiagnosticPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DiagnosticFormValues>({
    resolver: zodResolver(diagnosticSchema),
    defaultValues: {
      clinic_name: "",
      monthly_revenue: undefined,
      staff_count: undefined,
      no_show_rate: undefined,
      avg_treatment_value: undefined,
      number_of_locations: 1,
    },
  });

  async function onSubmit(values: DiagnosticFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Diagnostic failed");
        return;
      }
      if (data.success && data.id) {
        toast.success("Diagnostic complete");
        router.push(`/diagnostic/${data.id}`);
      } else if (data.success && (data.projections || data.narrative)) {
        sessionStorage.setItem(
          "eve-diagnostic-result",
          JSON.stringify({
            clinic_name: values.clinic_name || "Your Clinic",
            narrative: data.narrative,
            hidden_leaks: data.hidden_leaks ?? [],
            projections: data.projections ?? {},
            input_data: values,
          })
        );
        router.push("/diagnostic/results");
      } else {
        toast.error("Invalid response from server");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        <div className="relative mx-auto max-w-2xl px-4 py-12 sm:py-20">
          <header className="text-center mb-10 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
              <Activity className="h-4 w-4" />
              <span>Palantir for Clinics</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
              Free Eve Clinic Autonomy Diagnostic
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              See your practice running on full ontology autonomy in 90 days.
            </p>
          </header>

          <Card className="border-border/80 bg-card/95 backdrop-blur animate-fade-in-up shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">Practice snapshot</CardTitle>
              <CardDescription>
                Enter a few metrics. We’ll run your free diagnostic and show
                projected revenue and efficiency gains.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-6"
              >
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="clinic_name">Clinic Name</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your practice or business name</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="clinic_name"
                    placeholder="e.g. Serenity Med Spa"
                    {...form.register("clinic_name")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.clinic_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.clinic_name.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="monthly_revenue">Monthly Revenue ($)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total monthly revenue (all locations)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="monthly_revenue"
                    type="number"
                    placeholder="e.g. 85000"
                    {...form.register("monthly_revenue")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.monthly_revenue && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.monthly_revenue.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="staff_count">Staff Count</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Full-time equivalent staff (front + back)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="staff_count"
                    type="number"
                    placeholder="e.g. 8"
                    {...form.register("staff_count")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.staff_count && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.staff_count.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="no_show_rate">No-Show Rate (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Estimated % of appointments that no-show</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="no_show_rate"
                    type="number"
                    placeholder="e.g. 12"
                    {...form.register("no_show_rate")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.no_show_rate && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.no_show_rate.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="avg_treatment_value">Avg Treatment Value ($)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average revenue per visit/treatment</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="avg_treatment_value"
                    type="number"
                    placeholder="e.g. 250"
                    {...form.register("avg_treatment_value")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.avg_treatment_value && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.avg_treatment_value.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="number_of_locations">Number of Locations</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total practice locations</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="number_of_locations"
                    type="number"
                    placeholder="1"
                    {...form.register("number_of_locations")}
                    className="bg-background/50"
                  />
                  {form.formState.errors.number_of_locations && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.number_of_locations.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      Running diagnostic…
                    </span>
                  ) : (
                    "Run My Free Diagnostic"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-8">
            No credit card. Results in under a minute.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
