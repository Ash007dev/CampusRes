import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: depts } = await supabase.from('departments').select('id, name, code');
    console.log('Departments:', JSON.stringify(depts, null, 2));

    const { data: users } = await supabase.from('users').select('id, email, first_name, department_id').limit(5);
    console.log('Users sample:', JSON.stringify(users, null, 2));
}

check();
