/**
 * Minimal test: verify that getUser works correctly on a fresh temp client
 * WITHOUT calling signOut (which revokes the token).
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const EMAIL = 'cb.sc.u4cse23206@cb.students.amrita.edu';
const PASS = 'Admin123!';

async function test() {
    // Step 1: Sign in on client A
    const clientA = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn, error: signInErr } = await clientA.auth.signInWithPassword({ email: EMAIL, password: PASS });

    if (signInErr) {
        console.log('FAIL: signInWithPassword failed:', signInErr.message);
        return;
    }
    console.log('PASS: signInWithPassword OK, userId:', signIn.user?.id);
    console.log('      accessToken length:', signIn.session?.access_token?.length);

    const token = signIn.session!.access_token;

    // Step 2: getUser on client B (completely separate, fresh client) — NO signOut on A
    const clientB = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: userData, error: userErr } = await clientB.auth.getUser(token);

    if (userErr) {
        console.log('FAIL: getUser on fresh client B failed:', userErr.message);
    } else {
        console.log('PASS: getUser on fresh client B OK:', userData.user?.id, userData.user?.email);
    }

    // Step 3: Test the API server
    console.log('\n--- Testing API server ---');
    try {
        const res = await fetch('http://localhost:3001/api/v1/auth/users?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const body = await res.json();
        console.log('API status:', res.status);
        if (res.ok) {
            console.log('PASS: /auth/users returned', body.data?.length, 'users');
        } else {
            console.log('FAIL: /auth/users error:', JSON.stringify(body.error, null, 2));
        }
    } catch (e: any) {
        console.log('FAIL: fetch error:', e.message);
    }

    // Step 4: Test calendar
    try {
        const res = await fetch('http://localhost:3001/api/v1/bookings/calendar', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const body = await res.json();
        console.log('API status:', res.status);
        if (res.ok) {
            console.log('PASS: /bookings/calendar returned', body.data?.length, 'bookings');
        } else {
            console.log('FAIL: /bookings/calendar error:', JSON.stringify(body.error, null, 2));
        }
    } catch (e: any) {
        console.log('FAIL: fetch error:', e.message);
    }

    // Don't sign out! Just let it go.
}

test().catch(console.error);
