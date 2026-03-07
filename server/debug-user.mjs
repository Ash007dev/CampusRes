import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(email) {
    try {
        console.log(`Checking user: ${email}`);

        // Check public.users
        const { data: publicUser, error: publicError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (publicError) {
            console.log('❌ public.users error:', publicError.message);
        } else {
            console.log('✅ public.users profile found:', {
                id: publicUser.id,
                role: publicUser.role,
                is_active: publicUser.is_active
            });
        }

        // Check auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        const authUser = authData.users.find(u => u.email === email);
        if (!authUser) {
            console.log('❌ User not found in auth.users!');
        } else {
            console.log('✅ auth.users found:', {
                id: authUser.id,
                email_confirmed_at: authUser.email_confirmed_at,
                last_sign_in_at: authUser.last_sign_in_at
            });

            if (!authUser.email_confirmed_at) {
                console.log('⚠️ Email is NOT confirmed. Confirming now...');
                const { error: confirmError } = await supabase.auth.admin.updateUserById(authUser.id, {
                    email_confirm: true
                });
                if (confirmError) console.error('Confirm error:', confirmError);
                else console.log('✅ Email confirmed.');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkUser('darun291105@gmail.com');
