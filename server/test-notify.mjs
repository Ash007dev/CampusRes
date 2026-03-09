/**
 * Test: Trigger waitlist notification manually
 * This simulates what happens when a booking is cancelled/early-checked-out
 * Run: node test-notify.mjs <roomId> <userId>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';

const env = readFileSync('.env', 'utf8');
const vars = {};
env.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    vars[k] = v;
});

const supabase = createClient(vars.SUPABASE_URL, vars.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// 1. Check SMTP config
console.log('\n--- SMTP Config ---');
console.log('Host:', vars.SMTP_HOST);
console.log('Port:', vars.SMTP_PORT);
console.log('User:', vars.SMTP_USER ? `${vars.SMTP_USER.substring(0, 5)}...` : 'NOT SET');
console.log('Password:', vars.SMTP_PASSWORD ? `${vars.SMTP_PASSWORD.substring(0, 4)}...` : 'NOT SET');

// 2. Test SMTP connection
console.log('\n--- Testing SMTP Connection ---');
const transporter = nodemailer.createTransport({
    host: vars.SMTP_HOST,
    port: parseInt(vars.SMTP_PORT),
    secure: parseInt(vars.SMTP_PORT) === 465,
    auth: {
        user: vars.SMTP_USER,
        pass: vars.SMTP_PASSWORD,
    },
});

try {
    await transporter.verify();
    console.log('✅ SMTP connection OK!');
} catch (err) {
    console.error('❌ SMTP connection FAILED:', err.message);
}

// 3. Check if there are waitlist entries
console.log('\n--- Checking waitlist entries ---');
const { data: entries, error } = await supabase
    .from('waitlist')
    .select(`
    id, user_id, room_id, desired_start_time, desired_end_time,
    is_active, notified_at,
    users:user_id(email, first_name, last_name),
    rooms:room_id(name)
  `)
    .eq('is_active', true)
    .limit(5);

if (error) {
    console.error('❌ Error fetching waitlist:', error.message);
} else if (!entries || entries.length === 0) {
    console.log('⚠️  No active waitlist entries found.');
    console.log('   → The user needs to click "Notify Me" first to join the waitlist.');
    console.log('   → Then someone ends a meeting early → THEN the email fires.');
} else {
    console.log(`✅ Found ${entries.length} active waitlist entries:`);
    entries.forEach((e, i) => {
        console.log(`  [${i + 1}] User: ${e.users?.email}, Room: ${e.rooms?.name}`);
        console.log(`       Slot: ${e.desired_start_time} → ${e.desired_end_time}`);
        console.log(`       Notified: ${e.notified_at || 'not yet'}`);
    });

    // 4. Send a test notification email to the first entry
    const first = entries[0];
    if (first.users?.email) {
        console.log(`\n--- Sending test email to ${first.users.email} ---`);
        try {
            await transporter.sendMail({
                from: `"Campus Resource Engine" <${vars.SMTP_USER}>`,
                to: first.users.email,
                subject: `🔔 TEST: Room Available! ${first.rooms?.name}`,
                text: `Hello ${first.users.first_name || 'User'},\n\nThis is a TEST notification. Your waitlisted room ${first.rooms?.name} would be available now.\n\n- Campus Resource Engine`,
            });
            console.log('✅ Test email sent successfully!');
        } catch (err) {
            console.error('❌ Email send FAILED:', err.message);
        }
    }
}
