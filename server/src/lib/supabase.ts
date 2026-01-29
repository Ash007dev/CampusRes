/**
 * =============================================================================
 * Campus Resource Engine - Supabase Client
 * =============================================================================
 * Central Supabase client for all database operations
 * =============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../config/logger.js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
}

// Create Supabase client with service role key (bypasses RLS)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
    try {
        const { data, error } = await supabase.from('departments').select('id').limit(1);
        if (error) {
            logger.error({ error }, 'Supabase connection test failed');
            return false;
        }
        logger.info('✓ Supabase connected successfully');
        return true;
    } catch (error) {
        logger.error({ error }, 'Supabase connection error');
        return false;
    }
}

/**
 * Disconnect (no-op for Supabase, but kept for API compatibility)
 */
export async function disconnect(): Promise<void> {
    logger.debug('Supabase client cleanup');
}

export default supabase;
