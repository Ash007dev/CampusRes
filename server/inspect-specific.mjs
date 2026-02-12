import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .ilike('id', 'EA2890F8%')
        .single();

    if (error) {
        console.error('Error fetching booking:', error);
    } else {
        console.log('Booking details:', JSON.stringify(booking, null, 2));
    }
}

check();
