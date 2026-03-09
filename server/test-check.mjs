import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const vars = {};
env.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i === -1) return;
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
});

const s = createClient(vars.SUPABASE_URL, vars.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Check active waitlist entries
const { data, error } = await s
    .from('waitlist')
    .select('id, user_id, room_id, is_active, notified_at, desired_start_time, desired_end_time')
    .eq('is_active', true)
    .limit(10);

console.log('Active waitlist entries:', data?.length ?? 0);
if (error) console.log('Error:', error.message);

if (data && data.length > 0) {
    data.forEach((e, i) => {
        console.log(`[${i + 1}] user_id: ${e.user_id}`);
        console.log(`     room_id: ${e.room_id}`);
        console.log(`     start: ${e.desired_start_time}`);
        console.log(`     end: ${e.desired_end_time}`);
        console.log(`     notified_at: ${e.notified_at || 'NOT YET'}`);
    });
} else {
    console.log('NO active waitlist entries. User must join waitlist first (click Notify Me button).');
}
