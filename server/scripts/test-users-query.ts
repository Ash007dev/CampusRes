/**
 * Test: Query the users table directly via the shared supabase import
 * to check if it's an RLS issue on the users table.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

async function test() {
    // Clean service role client (should bypass RLS)
    const client = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // Query 1: Simple users query
    const { data: users1, count: count1, error: err1 } = await client
        .from('users')
        .select('*', { count: 'exact' });
    console.log('Simple users query:', { count: count1, rows: users1?.length, error: err1?.message });

    // Query 2: Same query as getAllUsers (with departments join)
    const { data: users2, count: count2, error: err2 } = await client
        .from('users')
        .select('*, departments(name)', { count: 'exact' });
    console.log('Users + departments join:', { count: count2, rows: users2?.length, error: err2?.message });

    // Query 3: Bookings (for comparison)
    const { data: bookings, count: count3, error: err3 } = await client
        .from('bookings')
        .select('*', { count: 'exact' })
        .limit(5);
    console.log('Bookings query:', { count: count3, rows: bookings?.length, error: err3?.message });

    // Query 4: Rooms (for comparison)
    const { data: rooms, count: count4, error: err4 } = await client
        .from('rooms')
        .select('*', { count: 'exact' })
        .limit(5);
    console.log('Rooms query:', { count: count4, rows: rooms?.length, error: err4?.message });

    // Print first user if found
    if (users1 && users1.length > 0) {
        console.log('\nFirst user:', users1[0].email, users1[0].role);
    }

    // Check if using SUPABASE_KEY (anon key) vs SUPABASE_SERVICE_KEY
    console.log('\nKey check:');
    console.log('  SUPABASE_SERVICE_KEY starts with:', KEY?.substring(0, 20));
    console.log('  SUPABASE_KEY (anon) starts with:', process.env.SUPABASE_KEY?.substring(0, 20));
}

test().catch(console.error);
