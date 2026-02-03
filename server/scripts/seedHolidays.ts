/**
 * =============================================================================
 * Campus Resource Engine - Holiday Seeder
 * =============================================================================
 * Seeds the holidays table with academic calendar data
 * Run with: npx tsx scripts/seedHolidays.ts
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Academic Calendar 2025-2026
const holidays = [
    // Named Holidays 2025
    { date: '2025-06-07', name: 'Bakrid', type: 'HOLIDAY' },
    { date: '2025-07-06', name: 'Muharam', type: 'HOLIDAY' },
    { date: '2025-08-15', name: 'Independence Day', type: 'HOLIDAY' },
    { date: '2025-08-27', name: 'Ganesh Chaturthi', type: 'HOLIDAY' },
    { date: '2025-08-30', name: 'Nimanjanam', type: 'HOLIDAY' },
    { date: '2025-09-05', name: 'Onam / Miladi Nabi', type: 'HOLIDAY' },
    { date: '2025-09-27', name: "Amma's Jayanthi", type: 'HOLIDAY' },
    { date: '2025-10-01', name: 'Mahanavami', type: 'HOLIDAY' },
    { date: '2025-10-02', name: 'Vijayadashami / Gandhi Jayanti', type: 'HOLIDAY' },
    { date: '2025-10-19', name: 'Diwali Eve', type: 'HOLIDAY' },
    { date: '2025-10-20', name: 'Diwali', type: 'HOLIDAY' },
    { date: '2025-10-21', name: 'Holiday (Post-Diwali)', type: 'HOLIDAY' },
    { date: '2025-11-08', name: 'Sanskrit Conference', type: 'HOLIDAY' },
    { date: '2025-11-09', name: 'Sanskrit Conference', type: 'HOLIDAY' },
    { date: '2025-12-25', name: 'Christmas', type: 'HOLIDAY' },

    // Named Holidays 2026
    { date: '2026-01-01', name: 'New Year', type: 'HOLIDAY' },
    { date: '2026-01-14', name: 'Pongal', type: 'HOLIDAY' },
    { date: '2026-01-15', name: 'Pongal', type: 'HOLIDAY' },
    { date: '2026-01-16', name: 'Pongal', type: 'HOLIDAY' },
    { date: '2026-01-26', name: 'Republic Day', type: 'HOLIDAY' },
    { date: '2026-02-01', name: 'Thai Poosam', type: 'HOLIDAY' },
    { date: '2026-02-15', name: 'Maha Shivaratri', type: 'HOLIDAY' },
    { date: '2026-03-19', name: 'Ugadi', type: 'HOLIDAY' },
    { date: '2026-03-31', name: 'Mahavir Jayanthi', type: 'HOLIDAY' },
    { date: '2026-04-03', name: 'Good Friday', type: 'HOLIDAY' },
    { date: '2026-04-14', name: 'Tamil New Year / Ambedkar Jayanthi', type: 'HOLIDAY' },
    { date: '2026-04-15', name: 'Vishu', type: 'HOLIDAY' },
    { date: '2026-05-01', name: 'May Day', type: 'HOLIDAY' },
    { date: '2026-05-27', name: 'Bakrid', type: 'HOLIDAY' },
    { date: '2026-06-26', name: 'Muharam', type: 'HOLIDAY' },

    // Weekend/Off days - June 2025
    { date: '2025-06-01', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-06-08', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-06-15', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-06-22', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-06-29', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - July 2025
    { date: '2025-07-12', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-07-13', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-07-20', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-07-26', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-07-27', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - August 2025
    { date: '2025-08-03', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-08-09', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-08-10', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-08-17', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-08-24', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-08-31', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - September 2025
    { date: '2025-09-06', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-09-07', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-09-14', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-09-21', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-09-28', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - October 2025
    { date: '2025-10-05', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-10-12', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-10-18', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-10-26', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - November 2025
    { date: '2025-11-02', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-11-16', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-11-22', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-11-23', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-11-30', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - December 2025
    { date: '2025-12-07', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-12-13', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-12-14', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-12-21', name: 'Weekend', type: 'WEEKEND' },
    { date: '2025-12-28', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - January 2026
    { date: '2026-01-10', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-01-11', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-01-17', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-01-18', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-01-25', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - February 2026
    { date: '2026-02-08', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-02-14', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-02-22', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-02-28', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - March 2026
    { date: '2026-03-01', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-08', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-14', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-15', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-22', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-28', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-03-29', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - April 2026
    { date: '2026-04-04', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-04-05', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-04-12', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-04-19', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-04-25', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-04-26', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - May 2026
    { date: '2026-05-03', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-09', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-10', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-17', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-23', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-24', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-05-31', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - June 2026
    { date: '2026-06-07', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-06-13', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-06-14', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-06-21', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-06-27', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-06-28', name: 'Weekend', type: 'WEEKEND' },

    // Weekend/Off days - July 2026
    { date: '2026-07-05', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-07-11', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-07-12', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-07-19', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-07-25', name: 'Weekend', type: 'WEEKEND' },
    { date: '2026-07-26', name: 'Weekend', type: 'WEEKEND' },
];

async function createHolidaysTable() {
    console.log('📅 Creating holidays table...');
    
    // First check if table exists by trying to select from it
    const { error: checkError } = await supabase
        .from('holidays')
        .select('id')
        .limit(1);
    
    if (checkError && checkError.code === '42P01') {
        // Table doesn't exist, create it using raw SQL
        console.log('  Creating holidays table via SQL...');
        
        const { error: createError } = await supabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS holidays (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    date DATE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL DEFAULT 'HOLIDAY',
                    description TEXT,
                    is_recurring BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(date, name)
                );
                
                CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
                CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(type);
            `
        });
        
        if (createError) {
            console.log('  Note: Could not create table via RPC. Please create the table manually in Supabase.');
            console.log('  SQL to run in Supabase SQL Editor:');
            console.log(`
CREATE TABLE IF NOT EXISTS holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'HOLIDAY',
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, name)
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(type);
            `);
            return false;
        }
    }
    
    console.log('  ✓ Holidays table ready');
    return true;
}

async function seedHolidays() {
    console.log('🌱 Seeding holidays...');
    
    let inserted = 0;
    let skipped = 0;
    
    for (const holiday of holidays) {
        const { error } = await supabase
            .from('holidays')
            .upsert({
                date: holiday.date,
                name: holiday.name,
                type: holiday.type,
            }, {
                onConflict: 'date,name',
                ignoreDuplicates: true,
            });
        
        if (error) {
            if (error.code === '23505') { // Unique violation
                skipped++;
            } else {
                console.error(`  ✗ Failed to insert ${holiday.name} on ${holiday.date}:`, error.message);
            }
        } else {
            inserted++;
        }
    }
    
    console.log(`  ✓ Inserted ${inserted} holidays, skipped ${skipped} duplicates`);
}

async function main() {
    console.log('🎓 Campus Resource Engine - Holiday Seeder');
    console.log('==========================================\n');
    
    const tableReady = await createHolidaysTable();
    
    if (tableReady) {
        await seedHolidays();
    } else {
        // Try seeding anyway in case table exists
        await seedHolidays();
    }
    
    // Show count
    const { count } = await supabase
        .from('holidays')
        .select('*', { count: 'exact', head: true });
    
    console.log(`\n✅ Total holidays in database: ${count || 0}`);
    console.log('\nDone!');
}

main().catch(console.error);
