import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function fixRoomNames() {
    console.log('Fetching rooms...');
    const { data: rooms, error } = await supabase.from('rooms').select('id, name, code, room_type, capacity, building, floor');

    if (error) {
        console.error('Error fetching rooms:', error);
        return;
    }

    console.log(`Found ${rooms.length} rooms:`);
    rooms.forEach(r => console.log(`  - ${r.name} (code: ${r.code}, type: ${r.room_type}, capacity: ${r.capacity}, building: ${r.building}, floor: ${r.floor})`));

    // Generate proper names based on room type and existing info
    const roomTypeNames = {
        'CLASSROOM': 'Classroom',
        'LAB': 'Computer Lab',
        'MEETING': 'Meeting Room',
        'LECTURE_HALL': 'Lecture Hall',
        'CONFERENCE': 'Conference Room',
        'SEMINAR': 'Seminar Hall',
        'AUDITORIUM': 'Auditorium',
        'LIBRARY': 'Library Room',
    };

    let updateCount = 0;
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        // Check if the name looks auto-generated (contains random codes)
        const hasRandomCode = /[A-Z][a-z]+\s[A-Z][a-z]*[0-9a-z]{3,}/.test(room.name) ||
            /[A-Z]{2}[a-z0-9]{4,}/.test(room.name);

        if (hasRandomCode || room.name.includes('Default') || room.name.includes('Getable')) {
            const typeName = roomTypeNames[room.room_type] || 'Room';
            const building = room.building || 'Main Block';
            const floor = room.floor || (i + 1);
            const newName = `${typeName} ${String(i + 1).padStart(3, '0')} - ${building}`;

            console.log(`  Renaming: "${room.name}" -> "${newName}"`);

            const { error: updateError } = await supabase
                .from('rooms')
                .update({ name: newName })
                .eq('id', room.id);

            if (updateError) {
                console.error(`  Error updating room ${room.id}:`, updateError);
            } else {
                updateCount++;
            }
        }
    }

    console.log(`\nUpdated ${updateCount} room names.`);
}

fixRoomNames().catch(console.error);
