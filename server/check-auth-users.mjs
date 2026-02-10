import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAuthUsers() {
  try {
    console.log('Checking public.users table...\n');

    // Check public.users table
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('id, email, role')
      .in('email', [
        'admin@campus.edu',
        'Student@campus.edu',
        'Student2@campus.edu',
        'cb.sc.u4cse23209@cb.students.amrita.edu',
        'cb.sc.u4cse23238@cb.students.amrita.edu'
      ]);

    if (publicError) throw publicError;
    console.log('public.users table:', JSON.stringify(publicUsers, null, 2));

    console.log('\n---\n');
    console.log('Checking Supabase Auth users...\n');

    // Check auth.users via Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    const relevantAuthUsers = authData.users.filter(u =>
      u.email?.includes('campus.edu') ||
      u.email?.includes('cb.students.amrita.edu')
    );

    console.log('auth.users (relevant):', JSON.stringify(relevantAuthUsers.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at
    })), null, 2));

    console.log('\n---\n');
    console.log('Checking for mismatches...\n');

    // Find users that need email updates in auth
    const oldEmails = ['admin@campus.edu', 'Student@campus.edu', 'Student2@campus.edu'];
    const usersToUpdate = authData.users.filter(u => oldEmails.includes(u.email));

    if (usersToUpdate.length > 0) {
      console.log(`Found ${usersToUpdate.length} user(s) in auth.users with old emails:`);
      usersToUpdate.forEach(u => console.log(`  - ${u.email} (ID: ${u.id})`));
      console.log('\nThese need to be updated in Supabase Auth.');
    } else {
      console.log('✅ All auth.users have updated emails!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAuthUsers();
