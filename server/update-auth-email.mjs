import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc1NjA3NCwiZXhwIjoyMDgzMzMyMDc0fQ.y5z5u4L-wwy6wpvisf3KEFqAMDDmR8Bls5dpIHOUYcM';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateAuthEmail() {
  try {
    const userId = '0d442eb3-c1e9-49bd-b111-87cf03aa8968';
    const newEmail = 'cb.sc.u4cse23209@cb.students.amrita.edu';
    
    console.log(`Updating auth.users email for user ${userId}...`);
    console.log(`Old email: admin@campus.edu`);
    console.log(`New email: ${newEmail}\n`);
    
    // Update email in Supabase Auth
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { email: newEmail }
    );
    
    if (error) throw error;
    
    console.log('✅ Successfully updated auth.users!');
    console.log('\nUpdated user:', JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at
    }, null, 2));
    
    console.log('\n---\n');
    console.log('Verifying update...\n');
    
    // Verify the update
    const { data: userData, error: verifyError } = await supabase.auth.admin.getUserById(userId);
    
    if (verifyError) throw verifyError;
    
    console.log('Verified user:', JSON.stringify({
      id: userData.user.id,
      email: userData.user.email
    }, null, 2));
    
    console.log('\n✅ Email successfully updated in Supabase Authentication!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateAuthEmail();
