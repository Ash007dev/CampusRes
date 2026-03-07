import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncUserIds() {
  try {
    // Fetch all users from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    // For each auth user, update public.users id to match auth user id
    for (const authUser of authData.users) {
      const email = authUser.email;
      const authId = authUser.id;
      if (!email || !authId) continue;

      // Find user in public.users by email
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (publicError) {
        console.log(`❌ Error finding public user for ${email}:`, publicError.message);
        continue;
      }
      if (!publicUser) {
        console.log(`⚠️ No public user found for ${email}`);
        continue;
      }
      if (publicUser.id === authId) {
        console.log(`✅ User ${email} already synced.`);
        continue;
      }

      // Update public.users id to match auth user id
      const { error: updateError } = await supabase
        .from('users')
        .update({ id: authId })
        .eq('email', email);

      if (updateError) {
        console.log(`❌ Failed to update id for ${email}:`, updateError.message);
      } else {
        console.log(`🔄 Updated id for ${email} to ${authId}`);
      }
    }
    console.log('Sync complete.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncUserIds();
