/**
 * Test BOTH user accounts against the live API.
 * Each gets their own temp client for signIn.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

async function testUser(email: string, password: string) {
    console.log(`\n=== Testing ${email} ===`);

    // Get token via temp client
    const client = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
        console.log('FAIL: login failed:', error.message);
        return;
    }

    const token = signIn.session!.access_token;
    console.log('Token obtained, length:', token.length);

    // Test /auth/users
    try {
        const res = await fetch('http://localhost:3001/api/v1/auth/users?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const body = await res.json();
        console.log('/auth/users:', res.status, '| users:', body.data?.length, '| total:', body.meta?.total);
        if (body.error) console.log('  error:', body.error.message);
    } catch (e: any) {
        console.log('FAIL:', e.message);
    }

    // Test /bookings/calendar
    try {
        const res = await fetch('http://localhost:3001/api/v1/bookings/calendar', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const body = await res.json();
        console.log('/bookings/calendar:', res.status, '| bookings:', body.data?.length);
        if (body.error) console.log('  error:', body.error.message);
    } catch (e: any) {
        console.log('FAIL:', e.message);
    }

    // Test /bookings/my
    try {
        const res = await fetch('http://localhost:3001/api/v1/bookings/my', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const body = await res.json();
        console.log('/bookings/my:', res.status, '| bookings:', body.data?.length);
        if (body.error) console.log('  error:', body.error.message);
    } catch (e: any) {
        console.log('FAIL:', e.message);
    }
}

async function main() {
    // Test user 1
    await testUser('ashish007tup@gmail.com', 'Admin123!');
    // Test user 2
    await testUser('cb.sc.u4cse23206@cb.students.amrita.edu', 'Admin123!');
}

main().catch(console.error);
