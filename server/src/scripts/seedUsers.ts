
import { supabase } from '../lib/supabase.js';

const USERS = [
    {
        email: 'cb.sc.u4cse23206@cb.students.amrita.edu',
        password: 'Admin123!',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User'
    },
    {
        email: 'cb.sc.u4cse23209@cb.students.amrita.edu',
        password: 'Faculty123!',
        role: 'FACULTY',
        firstName: 'Faculty',
        lastName: 'User'
    },
    {
        email: 'cb.sc.u4cse23238@cb.students.amrita.edu',
        password: 'Student2@123',
        role: 'STUDENT',
        firstName: 'Student',
        lastName: 'One'
    },
    {
        email: 'cb.sc.u4cse23215@cb.students.amrita.edu',
        password: 'Student1@123',
        role: 'STUDENT',
        firstName: 'Student',
        lastName: 'Two'
    }
];

async function seedUsers() {
    console.log('Starting user seeding...');

    // Ensure config is loaded (dotenv might need explicit call if not auto-loaded)
    // Usually the imported supabase module relies on process.env being set.
    // If running with `node --env-file=.env` or similar, it works.
    // We'll trust the environment is set up or we can use dotenv flow.

    for (const user of USERS) {
        try {
            console.log(`Processing ${user.email}...`);

            // 1. Create or Get Auth User
            let authUserId: string | null = null;

            // Try creating
            const { data: createData, error: createError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: {
                    first_name: user.firstName,
                    last_name: user.lastName,
                    role: user.role // Determine if metadata role is used or just public table
                }
            });

            if (createError) {
                // If user exists, we need to find their ID
                if (createError.message.includes('already registered') || createError.message.includes('email_exists')) {
                    console.log(`  - User already exists in Auth. Fetching ID...`);
                    // List users to find this one (admin api)
                    // Note: listUsers is paginated, but we can search by email if strictly needed,
                    // or just cheat by trying to sign in? No, we have admin access.
                    // Unfortunately listUsers doesn't filter by email directly in v2 JS lib sometimes? 
                    // Actually strictly speaking we can't easily "get" a user by email via admin api without listing.
                    // But we can reset the password to ensure they can login with the requested credentials!

                    // Wait, supabase.auth.admin.listUsers() isn't great for single lookup.
                    // But we can try to update the user by email? No, update requires ID.

                    // We can just query `public.users` to get the ID, assuming integrity.
                    const { data: existingPublicUser } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', user.email)
                        .single();

                    if (existingPublicUser) {
                        authUserId = existingPublicUser.id;

                        // Update password for existing user to match request
                        const { error: updateAuthError } = await supabase.auth.admin.updateUserById(authUserId!, {
                            password: user.password,
                            user_metadata: {
                                first_name: user.firstName,
                                last_name: user.lastName,
                                role: user.role
                            }
                        });

                        if (updateAuthError) {
                            console.error(`  - Failed to update auth credentials: ${updateAuthError.message}`);
                        } else {
                            console.log(`  - Auth credentials updated.`);
                        }
                    } else {
                        console.error(`  - User exists in Auth but not in public.users? Manual intervention might be needed for ID retrieval to sync.`);
                        // We could implement a listUsers scan here if really needed, but let's assume public.users is in sync.
                        continue;
                    }

                } else {
                    console.error(`  - Failed to create auth user: ${createError.message}`);
                    continue;
                }
            } else {
                authUserId = createData.user.id;
                console.log(`  - Auth user created.`);
            }

            if (!authUserId) continue;

            // 2. Upsert into public.users
            const { error: upsertError } = await supabase
                .from('users')
                .upsert({
                    id: authUserId,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    role: user.role,
                    // Only update inactive fields if needed? No, upsert overwrites.
                    // Maintain existing created_at if possible?
                    // We can use updated_at
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (upsertError) {
                console.error(`  - Failed to update public profile: ${upsertError.message}`);
            } else {
                console.log(`  - Public profile synced (Role: ${user.role}).`);
            }

        } catch (err: any) {
            console.error(`  - Error processing ${user.email}:`, err.message);
        }
    }

    console.log('Seeding complete.');
}

seedUsers().catch(console.error);
