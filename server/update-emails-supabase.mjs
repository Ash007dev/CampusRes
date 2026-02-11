import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc1NjA3NCwiZXhwIjoyMDgzMzMyMDc0fQ.y5z5u4L-wwy6wpvisf3KEFqAMDDmR8Bls5dpIHOUYcM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateEmails() {
  try {
    console.log('Checking current users...\n');
    
    // Check current users
    const { data: currentUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, role')
      .in('email', ['admin@campus.edu', 'Student@campus.edu', 'Student2@campus.edu']);
    
    if (fetchError) throw fetchError;
    console.log('Current users:', JSON.stringify(currentUsers, null, 2));
    
    console.log('\nUpdating emails...\n');
    
    // Update admin@campus.edu to cb.sc.u4cse23209@cb.students.amrita.edu
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .update({ email: 'cb.sc.u4cse23209@cb.students.amrita.edu' })
      .eq('email', 'admin@campus.edu')
      .select();
    
    if (adminError) throw adminError;
    console.log(`✅ Updated admin: ${admin?.length || 0} record(s)`);
    
    // Update Student@campus.edu to cb.sc.u4cse23209@cb.students.amrita.edu
    const { data: student1, error: student1Error } = await supabase
      .from('users')
      .update({ email: 'cb.sc.u4cse23209@cb.students.amrita.edu' })
      .eq('email', 'Student@campus.edu')
      .select();
    
    if (student1Error) throw student1Error;
    console.log(`✅ Updated Student: ${student1?.length || 0} record(s)`);
    
    // Update Student2@campus.edu to cb.sc.u4cse23238@cb.students.amrita.edu
    const { data: student2, error: student2Error } = await supabase
      .from('users')
      .update({ email: 'cb.sc.u4cse23238@cb.students.amrita.edu' })
      .eq('email', 'Student2@campus.edu')
      .select();
    
    if (student2Error) throw student2Error;
    console.log(`✅ Updated Student2: ${student2?.length || 0} record(s)`);
    
    console.log('\nVerifying updates...\n');
    
    // Verify updates
    const { data: updatedUsers, error: verifyError } = await supabase
      .from('users')
      .select('id, email, role')
      .in('email', [
        'cb.sc.u4cse23209@cb.students.amrita.edu',
        'cb.sc.u4cse23238@cb.students.amrita.edu'
      ]);
    
    if (verifyError) throw verifyError;
    console.log('Updated users:', JSON.stringify(updatedUsers, null, 2));
    
    console.log('\n✅ All email updates complete!');
    
  } catch (error) {
    console.error('❌ Error updating emails:', error);
    process.exit(1);
  }
}

updateEmails();
