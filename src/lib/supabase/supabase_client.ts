/**
 * File: supabase_client.ts
 * Purpose: Singleton Supabase client instance
 * Layer: Infrastructure
 * Domain: Auth + Data → [all Supabase operations]
 *
 * Data Contract:
 * - Output: Supabase client singleton
 * - Allowed Deps: @supabase/supabase-js ONLY
 */

import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from './database_types';

export const SUPABASE_URL = 'https://lplxgxiulgsufpvoadhi.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbHhneGl1bGdzdWZwdm9hZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODQ2MDgsImV4cCI6MjA4OTc2MDYwOH0.WJl8qTOQc7XU_EgOzmDQ3AyFaEMU8Dx3ub8DS0Fr1eA';

/**
 * The checked-in generated types predate migration
 * `20260815014500_add_narrative_era_register.sql`. Keep the client type aligned with
 * the deployed schema until `database_types.ts` is regenerated from Supabase.
 */
type GeneratedProjects = Database['public']['Tables']['projects'];
type ProjectsWithNarrativeEraRegister = {
  Row: GeneratedProjects['Row'] & { narrative_era_register: Json | null };
  Insert: GeneratedProjects['Insert'] & { narrative_era_register?: Json | null };
  Update: GeneratedProjects['Update'] & { narrative_era_register?: Json | null };
  Relationships: GeneratedProjects['Relationships'];
};

type DatabaseWithNarrativeEraRegister = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'projects'> & {
      projects: ProjectsWithNarrativeEraRegister;
    };
  };
};

export const supabase = createClient<DatabaseWithNarrativeEraRegister>(SUPABASE_URL, SUPABASE_ANON_KEY);
