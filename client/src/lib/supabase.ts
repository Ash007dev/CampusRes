/**
 * =============================================================================
 * Campus Resource Engine - Supabase Client (Browser)
 * =============================================================================
 * Supabase client for OAuth and authentication features
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NTYwNzQsImV4cCI6MjA4MzMzMjA3NH0.fJ8oNn5vZLPEzNr5k-jbJ_Kh6GiXHVFJrJgX2jK4_t0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  }
});
