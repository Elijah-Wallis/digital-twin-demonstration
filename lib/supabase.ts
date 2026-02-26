import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export type ClinicDiagnosticRow = {
  id: string;
  clinic_name: string;
  input_data: Record<string, unknown>;
  ontology_state: Record<string, unknown> | null;
  projections: Record<string, unknown> | null;
  narrative: string | null;
  created_at: string;
};
