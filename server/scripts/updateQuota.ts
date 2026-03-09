import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🔄 Updating quota_limit_hours for students from 4 to 10...');

    // Update students who currently have quota_limit_hours = 4
    const { data, error } = await supabase
        .from('users')
        .update({ quota_limit_hours: 10 })
        .eq('role', 'STUDENT')
        .eq('quota_limit_hours', 4)
        .select();

    if (error) {
        console.error('❌ Failed to update quotas:', error.message);
        process.exit(1);
    }

    console.log(`✅ Successfully updated quotas for ${data?.length || 0} students.`);
    console.log('🎉 Done!');
}

main().catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
});
