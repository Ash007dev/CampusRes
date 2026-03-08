/**
 * Test /auth/users endpoint response shape in detail
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

async function test() {
    const client = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // Get a valid token
    const { data: signIn } = await client.auth.signInWithPassword({
        email: 'cb.sc.u4cse23206@cb.students.amrita.edu',
        password: 'Admin123!',
    });

    const token = signIn.session!.access_token;

    // Test /auth/users with full response
    const res = await fetch('http://localhost:3001/api/v1/auth/users?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    const body = await res.json();
    console.log('Full response keys:', Object.keys(body));
    console.log('body.success:', body.success);
    console.log('body.data type:', typeof body.data, Array.isArray(body.data));
    console.log('body.data length:', body.data?.length);
    console.log('body.meta:', JSON.stringify(body.meta));

    if (body.data && body.data.length > 0) {
        console.log('\nFirst user:', JSON.stringify(body.data[0], null, 2));
    } else {
        console.log('\nNO USERS RETURNED!');
        console.log('Full body:', JSON.stringify(body, null, 2));
    }

    // Also directly query supabase
    console.log('\n--- Direct Supabase query ---');
    const { data: users, count, error } = await client
        .from('users')
        .select('id, email, role, first_name, last_name', { count: 'exact' })
        .limit(5);

    console.log('Direct query error:', error);
    console.log('Direct query count:', count);
    console.log('Direct query results:', users?.length);
    if (users && users.length > 0) {
        users.forEach(u => console.log(' -', u.email, u.role));
    }
}

test().catch(console.error);
