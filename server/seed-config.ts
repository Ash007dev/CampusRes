import { supabase } from './src/lib/supabase';

async function seed() {
    const configs = [
        { key: 'email_notifications_enabled', value: 'true', data_type: 'boolean', category: 'notification', description: 'Enable system-wide email notifications', is_public: false },
        { key: 'sms_notifications_enabled', value: 'false', data_type: 'boolean', category: 'notification', description: 'Enable system-wide SMS notifications', is_public: false },
        { key: 'password_min_length', value: '8', data_type: 'number', category: 'security', description: 'Minimum password length required', is_public: true },
        { key: 'session_timeout_minutes', value: '60', data_type: 'number', category: 'security', description: 'User session timeout in minutes', is_public: false },
        { key: 'max_failed_logins', value: '5', data_type: 'number', category: 'security', description: 'Maximum failed login attempts before lockout', is_public: false }
    ];

    for (const c of configs) {
        const { data: existing } = await supabase.from('system_config').select('id').eq('key', c.key).maybeSingle();
        if (!existing) {
            const { error } = await supabase.from('system_config').insert([c]);
            if (error) {
                console.error(`Failed to insert ${c.key}:`, error);
            } else {
                console.log(`Inserted ${c.key}`);
            }
        } else {
            console.log(`${c.key} already exists`);
        }
    }
}

seed().catch(console.error);
