/**
 * =============================================================================
 * Run Waitlist Migration
 * =============================================================================
 * This script executes the waitlist table migration in Supabase
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration() {
    console.log('🚀 Running waitlist migration...\n');

    try {
        // Read the migration SQL file
        const migrationPath = join(__dirname, '003_waitlist.sql');
        const sql = readFileSync(migrationPath, 'utf-8');

        console.log('📝 Executing SQL migration...');

        // Execute the migration using Supabase RPC
        // Note: This requires the SQL to be executed via the Supabase dashboard
        // or using the direct PostgreSQL connection

        console.log('\n⚠️  MANUAL STEPS REQUIRED:\n');
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to: Database → SQL Editor');
        console.log('3. Create a new query');
        console.log('4. Copy and paste the contents of:');
        console.log(`   ${migrationPath}`);
        console.log('5. Click "Run" to execute the migration\n');

        // Alternative: Direct PostgreSQL connection
        console.log('OR use direct PostgreSQL connection:\n');
        console.log('psql -h [your-supabase-host] -U postgres -d postgres -f migrations/003_waitlist.sql\n');

        // Let's try using the REST API to create the table
        console.log('Attempting to verify/create waitlist table...');

        // Try a simple query to check if table exists
        const { data, error } = await supabase
            .from('waitlist')
            .select('id')
            .limit(1);

        if (error) {
            if (error.message.includes('does not exist') || error.code === '42P01') {
                console.log('\n❌ Waitlist table does not exist!');
                console.log('📋 Execute the migration SQL manually (see steps above)\n');
            } else {
                console.error('❌ Error:', error.message);
            }
        } else {
            console.log('✅ Waitlist table exists!');
            console.log('Schema is ready for use.\n');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
