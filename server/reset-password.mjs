import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetUserPassword(email, newPassword) {
    try {
        console.log(`Resetting password for: ${email}`);

        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        const authUser = authData.users.find(u => u.email === email);
        if (!authUser) {
            console.log('❌ User not found in auth.users!');
            return;
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
            password: newPassword
        });

        if (updateError) throw updateError;
        console.log(`✅ Password successfully reset to: ${newPassword}`);
        console.log(`Please use this password to login.`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

resetUserPassword('darun291105@gmail.com', 'Password123!');
