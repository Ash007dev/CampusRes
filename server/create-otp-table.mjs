import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzYxNzAxNiwiZXhwIjoyMDUzMTkzMDE2fQ.jQ6oEewjVQUPy3rI6JJC-l50P9dxY0nMFgmjMNwgIU0';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  device_fingerprint TEXT,
  ip_address VARCHAR(45),
  is_verified BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_user_id ON otp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires_at ON otp_sessions(expires_at);
`;

(async () => {
  console.log('Creating otp_sessions table...');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    console.log('❌ RPC exec_sql not available, trying direct query...');
    
    // Try creating table directly
    const queries = sql.split(';').filter(q => q.trim());
    
    for (const query of queries) {
      const trimmed = query.trim();
      if (!trimmed) continue;
      
      console.log('Executing:', trimmed.substring(0, 50) + '...');
      const { error: queryError } = await supabase.from('_sql').insert({ query: trimmed });
      if (queryError) {
        console.log('Error:', queryError.message);
      }
    }
    
    // Check if table exists
    const { data: checkData, error: checkError } = await supabase
      .from('otp_sessions')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.log('❌ Table does not exist:', checkError.message);
      console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
      console.log(sql);
    } else {
      console.log('✅ otp_sessions table exists and is accessible!');
    }
  } else {
    console.log('✅ Table created successfully!');
  }
})();
