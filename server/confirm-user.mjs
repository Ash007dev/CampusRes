import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function confirmLastUser() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (users && users.length > 0) {
            const user = users[0];
            console.log(`Confirming email for user: ${user.email} (${user.id})`);

            const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
                email_confirm: true
            });

            if (updateError) throw updateError;
            console.log('✅ Successfully confirmed email.');
        } else {
            console.log('No users found in public.users table.');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

confirmLastUser();
