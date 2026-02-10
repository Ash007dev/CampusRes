import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc1NjA3NCwiZXhwIjoyMDgzMzMyMDc0fQ.y5z5u4L-wwy6wpvisf3KEFqAMDDmR8Bls5dpIHOUYcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const sql = fs.readFileSync('./migrations/002_otp_sessions.sql', 'utf8');
    
    console.log('Running OTP sessions migration...\n');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      
      // Try direct table creation
      console.log('\nTrying direct table creation...');
      
      const { error: createError } = await supabase
        .from('otp_sessions')
        .select('*')
        .limit(1);
      
      if (createError && createError.code === '42P01') {
        console.log('Table does not exist, creating via SQL...');
        console.log('Please run this SQL manually in Supabase SQL Editor:\n');
        console.log(sql);
      } else {
        console.log('✅ Table already exists or accessible');
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Fallback: show SQL for manual execution
    const sql = fs.readFileSync('./migrations/002_otp_sessions.sql', 'utf8');
    console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:\n');
    console.log('Go to: https://supabase.com/dashboard/project/arxsyeioxxjrukonnzwm/sql/new\n');
    console.log(sql);
  }
}

runMigration();
