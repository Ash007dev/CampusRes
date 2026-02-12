import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: bookings, error } = await supabase.from('bookings').select('*').limit(1);
    if (error) {
        console.error('Error fetching bookings:', error);
    } else {
        console.log('Booking sample:', JSON.stringify(bookings, null, 2));
    }
}

check();
