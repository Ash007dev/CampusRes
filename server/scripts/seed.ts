/**
 * =============================================================================
 * Campus Resource Engine - Database Seeder (Supabase)
 * =============================================================================
 * Seeds the database with test data using Supabase client
 * Uses snake_case table and column names
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🌱 Starting database seed...');

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
        // Check if exists
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
    // Seed Users
    // ==========================================================================
    console.log('👤 Seeding users...');

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    const users = [
        {
            email: 'admin@amrita.edu',
            password_hash: hashedPassword,
            first_name: 'Admin',
            last_name: 'User',
            role: 'ADMIN',
            department_id: deptResults['ADMIN'],
            reputation_score: 100,
            credits_balance: 1000,
            quota_limit_hours: 20,
        },
        {
            email: 'faculty@amrita.edu',
            password_hash: hashedPassword,
            first_name: 'Prof.',
            last_name: 'Sharma',
            role: 'FACULTY',
            department_id: deptResults['CSE'],
            reputation_score: 100,
            credits_balance: 500,
            quota_limit_hours: 10,
        },
        {
            email: 'labadmin@amrita.edu',
            password_hash: hashedPassword,
            first_name: 'Lab',
            last_name: 'Coordinator',
            role: 'LAB_ADMIN',
            department_id: deptResults['CSE'],
            reputation_score: 100,
            credits_balance: 800,
            quota_limit_hours: 15,
        },
        {
            email: 'student@amrita.edu',
            password_hash: hashedPassword,
            first_name: 'Ashish',
            last_name: 'M',
            role: 'STUDENT',
            department_id: deptResults['CSE'],
            reputation_score: 95,
            credits_balance: 200,
            quota_limit_hours: 4,
        },
        {
            email: 'student2@amrita.edu',
            password_hash: hashedPassword,
            first_name: 'Priya',
            last_name: 'Raj',
            role: 'STUDENT',
            department_id: deptResults['ECE'],
            reputation_score: 88,
            credits_balance: 150,
            quota_limit_hours: 4,
        },
    ];

    let usersCreated = 0;
    for (const user of users) {
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single();

        if (existing) {
            continue;
        }

        const { error } = await supabase.from('users').insert(user);

        if (error) {
            console.error(`Failed to create user ${user.email}:`, error.message);
            continue;
        }
        usersCreated++;
    }

    console.log(`  ✓ Created ${usersCreated} users`);
    console.log('  📧 Login credentials (password for all: Password123!):');
    console.log('     Admin: admin@amrita.edu');
    console.log('     Faculty: faculty@amrita.edu');
    console.log('     Student: student@amrita.edu');

    // ==========================================================================
    // Seed Rooms
    // ==========================================================================
    console.log('🏢 Seeding rooms...');

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
            continue;
        }

        const { error } = await supabase.from('rooms').insert(room);

        if (error) {
            console.error(`Failed to create room ${room.code}:`, error.message);
            continue;
        }
        roomsCreated++;
    }

    console.log(`  ✓ Created ${roomsCreated} rooms`);

    console.log('\n✨ Seed completed successfully!');
}

main().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
