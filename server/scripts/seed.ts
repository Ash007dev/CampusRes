/**
 * =============================================================================
 * Campus Resource Engine - Database Seeder (Supabase Auth)
 * =============================================================================
 * Seeds the database with test data using Supabase Auth for users
 * Users are created in both auth.users and public.users
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🌱 Starting database seed with Supabase Auth...');

    // ==========================================================================
    // Seed Departments
    // ==========================================================================
    console.log('📁 Seeding departments...');

    const departments = [
        { name: 'Computer Science & Engineering', code: 'CSE' },
        { name: 'Electronics & Communication Engineering', code: 'ECE' },
        { name: 'Electrical & Electronics Engineering', code: 'EEE' },
        { name: 'Mechanical Engineering', code: 'ME' },
        { name: 'Administration', code: 'ADMIN' },
    ];

    const deptResults: Record<string, string> = {};

    for (const dept of departments) {
        const { data: existing } = await supabase
            .from('departments')
            .select('id')
            .eq('code', dept.code)
            .single();

        if (existing) {
            deptResults[dept.code] = existing.id;
            continue;
        }

        const { data, error } = await supabase
            .from('departments')
            .insert(dept)
            .select('id')
            .single();

        if (error) {
            console.error(`Failed to create department ${dept.code}:`, error.message);
            continue;
        }
        deptResults[dept.code] = data.id;
    }

    console.log(`  ✓ Created ${Object.keys(deptResults).length} departments`);

    // ==========================================================================
    // Seed Users via Supabase Auth
    // ==========================================================================
    console.log('👤 Seeding users via Supabase Auth...');

    const users = [
        {
            email: 'admin@campus.edu',
            password: 'Admin123!',
            first_name: 'Admin',
            last_name: 'User',
            role: 'ADMIN',
            department_code: 'ADMIN',
            reputation_score: 100,
            credits_balance: 1000,
            quota_limit_hours: 20,
        },
        {
            email: 'faculty@campus.edu',
            password: 'Faculty123!',
            first_name: 'Prof.',
            last_name: 'Sharma',
            role: 'FACULTY',
            department_code: 'CSE',
            reputation_score: 100,
            credits_balance: 500,
            quota_limit_hours: 10,
        },
        {
            email: 'labadmin@campus.edu',
            password: 'LabAdmin123!',
            first_name: 'Lab',
            last_name: 'Coordinator',
            role: 'LAB_ADMIN',
            department_code: 'CSE',
            reputation_score: 100,
            credits_balance: 800,
            quota_limit_hours: 15,
        },
        {
            email: 'student@campus.edu',
            password: 'Student123!',
            first_name: 'Ashish',
            last_name: 'M',
            role: 'STUDENT',
            department_code: 'CSE',
            reputation_score: 95,
            credits_balance: 200,
            quota_limit_hours: 10,
        },
        {
            email: 'student2@campus.edu',
            password: 'Student123!',
            first_name: 'Priya',
            last_name: 'Raj',
            role: 'STUDENT',
            department_code: 'ECE',
            reputation_score: 88,
            credits_balance: 150,
            quota_limit_hours: 10,
        },
    ];

    let usersCreated = 0;

    for (const userData of users) {
        // Check if user already exists in public.users
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', userData.email)
            .single();

        if (existing) {
            console.log(`  ⏭️  User ${userData.email} already exists, skipping`);
            continue;
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                first_name: userData.first_name,
                last_name: userData.last_name,
            },
        });

        if (authError) {
            // If user exists in auth but not in public.users, try to get their ID
            if (authError.message.includes('already been registered')) {
                console.log(`  ⚠️  Auth user ${userData.email} exists, syncing to public.users...`);

                // List users to find existing auth user
                const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
                const existingAuthUser = authUsers?.find(u => u.email === userData.email);

                if (existingAuthUser) {
                    // Create public.users entry
                    const { error: syncError } = await supabase.from('users').insert({
                        id: existingAuthUser.id,
                        email: userData.email,
                        first_name: userData.first_name,
                        last_name: userData.last_name,
                        role: userData.role,
                        department_id: deptResults[userData.department_code],
                        reputation_score: userData.reputation_score,
                        credits_balance: userData.credits_balance,
                        quota_limit_hours: userData.quota_limit_hours,
                        is_active: true,
                        email_verified: true,
                        no_show_count: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                    if (!syncError) {
                        usersCreated++;
                        console.log(`  ✓ Synced ${userData.email} to public.users`);
                    } else {
                        console.error(`  ❌ Failed to sync ${userData.email}:`, syncError.message);
                    }
                }
                continue;
            }

            console.error(`  ❌ Failed to create auth user ${userData.email}:`, authError.message);
            continue;
        }

        if (!authData.user) {
            console.error(`  ❌ No user returned for ${userData.email}`);
            continue;
        }

        // Create corresponding entry in public.users
        const { error: userError } = await supabase.from('users').insert({
            id: authData.user.id, // Use same ID as auth.users
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            department_id: deptResults[userData.department_code],
            reputation_score: userData.reputation_score,
            credits_balance: userData.credits_balance,
            quota_limit_hours: userData.quota_limit_hours,
            is_active: true,
            email_verified: true,
            no_show_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        if (userError) {
            console.error(`  ❌ Failed to create public user ${userData.email}:`, userError.message);
            // Cleanup: delete auth user if public user creation fails
            await supabase.auth.admin.deleteUser(authData.user.id);
            continue;
        }

        usersCreated++;
        console.log(`  ✓ Created ${userData.email} (${userData.role})`);
    }

    console.log(`\n  📊 Created ${usersCreated} users in Supabase Auth + public.users`);
    console.log('\n  📧 Login credentials:');
    console.log('  ┌─────────────────────────────────────────────────┐');
    console.log('  │ Role       │ Email                │ Password    │');
    console.log('  ├─────────────────────────────────────────────────┤');
    console.log('  │ Admin      │ admin@campus.edu     │ Admin123!   │');
    console.log('  │ Faculty    │ faculty@campus.edu   │ Faculty123! │');
    console.log('  │ Lab Admin  │ labadmin@campus.edu  │ LabAdmin123!│');
    console.log('  │ Student    │ student@campus.edu   │ Student123! │');
    console.log('  │ Student 2  │ student2@campus.edu  │ Student123! │');
    console.log('  └─────────────────────────────────────────────────┘');

    // ==========================================================================
    // Seed Rooms
    // ==========================================================================
    console.log('\n🏢 Seeding rooms...');

    const operatingHours = {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: { open: '00:00', close: '00:00' },
    };

    const rooms = [
        {
            name: 'CPLAB-1',
            code: 'AB1-W102',
            description: 'Computer Lab - Ground Floor, W-102',
            room_type: 'lab',
            capacity: 60,
            floor: 0,
            building: 'AB1',
            amenities: { projector: true, wifi: true, ac: true, whiteboard: true, computers: true },
            operating_hours: operatingHours,
            department_id: deptResults['CSE'],
        },
        {
            name: 'CPLAB-2',
            code: 'AB1-W109',
            description: 'Computer Lab - Ground Floor, W-109',
            room_type: 'lab',
            capacity: 60,
            floor: 0,
            building: 'AB1',
            amenities: { projector: true, wifi: true, ac: true, whiteboard: true, computers: true },
            operating_hours: operatingHours,
            department_id: deptResults['CSE'],
        },
        {
            name: 'Study Room A',
            code: 'AB1-201',
            description: 'Quiet Study Room - Second Floor',
            room_type: 'study_room',
            capacity: 10,
            floor: 2,
            building: 'AB1',
            amenities: { wifi: true, ac: true, whiteboard: true },
            operating_hours: operatingHours,
            department_id: deptResults['CSE'],
        },
        {
            name: 'Conference Room 1',
            code: 'AB2-101',
            description: 'Main Conference Room',
            room_type: 'conference_room',
            capacity: 20,
            floor: 1,
            building: 'AB2',
            amenities: { projector: true, wifi: true, ac: true, whiteboard: true, videoConference: true },
            operating_hours: operatingHours,
            department_id: deptResults['ECE'],
        },
        {
            name: 'Auditorium',
            code: 'AB3-HALL',
            description: 'Main Auditorium',
            room_type: 'auditorium',
            capacity: 500,
            floor: 0,
            building: 'AB3',
            amenities: { projector: true, wifi: true, ac: true, microphone: true, stage: true },
            operating_hours: operatingHours,
            department_id: deptResults['ADMIN'],
        },
    ];

    let roomsCreated = 0;
    for (const room of rooms) {
        const { data: existing } = await supabase
            .from('rooms')
            .select('id')
            .eq('code', room.code)
            .single();

        if (existing) {
            console.log(`  ⏭️  Room ${room.code} already exists, skipping`);
            continue;
        }

        const { error } = await supabase.from('rooms').insert({
            id: randomUUID(),
            ...room,
            is_maintenance: false,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        if (error) {
            console.error(`  ❌ Failed to create room ${room.code}:`, error.message);
            continue;
        }
        roomsCreated++;
        console.log(`  ✓ Created room ${room.name} (${room.code})`);
    }

    console.log(`\n  📊 Created ${roomsCreated} rooms`);

    console.log('\n✨ Seed completed successfully!');
    console.log('\n👉 Check Supabase Dashboard → Authentication tab to see the users!');
}

main().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
