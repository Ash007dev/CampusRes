import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data: profiles } = await supabase.from('users').select('id, email, is_active');
    const { data: authUsers } = await supabase.auth.admin.listUsers();

    console.log("PROFILES:");
    console.table(profiles?.map(p => ({ email: p.email, id: p.id, active: p.is_active })));

    console.log("AUTH USERS:");
    console.table(authUsers?.users.map(u => ({ email: u.email, id: u.id })));
}
main();
