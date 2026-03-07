/**
 * Definitive test: use TWO separate clients to prove RLS is the issue.
 * Client A: creates token via signInWithPassword
 * Client B: fresh service role client queries users (never called signIn)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

async function test() {
    // Client A: only for auth (will be "tainted" by signInWithPassword)
    const authClient = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn } = await authClient.auth.signInWithPassword({
        email: 'cb.sc.u4cse23206@cb.students.amrita.edu',
        password: 'Admin123!',
    });
    const token = signIn!.session!.access_token;

    // Test 1: Query users on the TAINTED auth client
    const { data: usersA, count: countA } = await authClient
        .from('users')
        .select('id, email', { count: 'exact' })
        .limit(3);
    console.log('Tainted client (called signIn): users found:', countA, '| rows:', usersA?.length);

    // Client B: CLEAN service role client (never called signIn)
    const cleanClient = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: usersB, count: countB } = await cleanClient
        .from('users')
        .select('id, email', { count: 'exact' })
        .limit(3);
    console.log('Clean client (no signIn):      users found:', countB, '| rows:', usersB?.length);
    if (usersB) usersB.forEach(u => console.log('  -', u.email));

    // Test 3: API server with the token (server should use its own clean shared client for DB queries)
    console.log('\n--- API test ---');
    const res = await fetch('http://localhost:3001/api/v1/auth/users?limit=5', {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const body = await res.json();
    console.log('API /auth/users status:', res.status, '| users:', body.data?.length, '| total:', body.meta?.total);
}

test().catch(console.error);
