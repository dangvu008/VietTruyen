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
import type { Database } from './database_types';

const SUPABASE_URL = 'https://lplxgxiulgsufpvoadhi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbHhneGl1bGdzdWZwdm9hZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODQ2MDgsImV4cCI6MjA4OTc2MDYwOH0.WJl8qTOQc7XU_EgOzmDQ3AyFaEMU8Dx3ub8DS0Fr1eA';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
