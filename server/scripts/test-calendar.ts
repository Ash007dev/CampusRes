/**
 * Check all bookings for March 5-6 and what the calendar API returns.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

async function test() {
    const client = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1. Get ALL bookings
    console.log('=== ALL bookings in database ===');
    const { data: allBookings, count } = await client
        .from('bookings')
        .select('id, title, status, start_time, end_time, user_id, room_id', { count: 'exact' })
        .order('start_time', { ascending: true });

    console.log('Total bookings:', count);
    allBookings?.forEach(b => {
        console.log(`  [${b.status}] ${b.start_time} → ${b.end_time} | user: ${b.user_id?.substring(0, 8)} | room: ${b.room_id?.substring(0, 8)} | ${b.title || 'no title'}`);
    });

    // 2. Bookings specifically on March 5-6
    console.log('\n=== Bookings on March 5-7, 2026 ===');
    const { data: marchBookings } = await client
        .from('bookings')
        .select('id, title, status, start_time, end_time, user_id, room_id')
        .gte('start_time', '2026-03-05T00:00:00Z')
        .lte('start_time', '2026-03-07T23:59:59Z')
        .order('start_time', { ascending: true });

    console.log('Found:', marchBookings?.length);
    marchBookings?.forEach(b => {
        console.log(`  [${b.status}] ${b.start_time} → ${b.end_time} | user: ${b.user_id} | ${b.title || 'no title'}`);
    });

    // 3. Check bookings for the specific admin user
    console.log('\n=== Bookings for cb.sc.u4cse23206 (368d33f2...) ===');
    const { data: userBookings } = await client
        .from('bookings')
        .select('id, title, status, start_time, end_time, room_id')
        .eq('user_id', '368d33f2-dbd5-4b5a-b7d7-8c32b321e9d4')
        .order('start_time', { ascending: true });

    console.log('Found:', userBookings?.length);
    userBookings?.forEach(b => {
        console.log(`  [${b.status}] ${b.start_time} → ${b.end_time} | ${b.title || 'no title'}`);
    });

    // 4. Test the calendar API endpoint
    console.log('\n=== Calendar API test ===');
    const tempClient = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: signIn } = await tempClient.auth.signInWithPassword({
        email: 'cb.sc.u4cse23206@cb.students.amrita.edu',
        password: 'Admin123!',
    });
    const token = signIn!.session!.access_token;

    const res = await fetch('http://localhost:3001/api/v1/bookings/calendar?startDate=2026-03-01&endDate=2026-03-31', {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const body = await res.json();
    console.log('Calendar API status:', res.status, '| count:', body.data?.length);
    body.data?.forEach((b: any) => {
        console.log(`  [${b.status}] ${b.startTime} → ${b.endTime} | room: ${b.room?.name || b.roomId} | ${b.title || 'no title'}`);
    });
}

test().catch(console.error);
