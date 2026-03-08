/**
 * Diagnostic script to check the state of a specific user account
 * and test the auth flow end-to-end.
 * 
 * Usage: npx tsx scripts/diagnose-user.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const EMAIL = 'cb.sc.u4cse23206@cb.students.amrita.edu';
const PASSWORD = 'Admin123!';

async function diagnose() {
    console.log('=== DIAGNOSING USER ACCOUNT ===');
    console.log(`Email: ${EMAIL}`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log();

    // 1. Create a fresh client (not the shared one)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // 2. Check if user exists in public.users table
    console.log('--- Step 1: Check public.users table ---');
    const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('email', EMAIL)
        .single();

    if (publicError) {
        console.error('ERROR: User NOT found in public.users:', publicError.message);
    } else {
        console.log('OK: User found in public.users:');
        console.log({
            id: publicUser.id,
            email: publicUser.email,
            role: publicUser.role,
            firstName: publicUser.first_name,
            lastName: publicUser.last_name,
            isActive: publicUser.is_active,
            blockedUntil: publicUser.blocked_until,
            departmentId: publicUser.department_id,
            creditsBalance: publicUser.credits_balance,
            ghostCount: publicUser.ghost_count,
        });
    }
    console.log();

    // 3. Check if user exists in Supabase Auth
    console.log('--- Step 2: Check Supabase Auth ---');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('ERROR listing auth users:', authError.message);
    } else {
        const authUser = authUsers.users.find(u => u.email === EMAIL);
        if (!authUser) {
            console.error('ERROR: User NOT found in Supabase Auth!');
            console.log('This means the user cannot authenticate at all.');
        } else {
            console.log('OK: User found in Supabase Auth:');
            console.log({
                id: authUser.id,
                email: authUser.email,
                confirmedAt: authUser.confirmed_at,
                createdAt: authUser.created_at,
                lastSignInAt: authUser.last_sign_in_at,
            });

            // Check if IDs match
            if (publicUser && authUser.id !== publicUser.id) {
                console.error('!!! ID MISMATCH !!! Auth ID:', authUser.id, 'Public ID:', publicUser.id);
            } else if (publicUser) {
                console.log('OK: Auth ID matches public.users ID');
            }
        }
    }
    console.log();

    // 4. Test sign-in with password
    console.log('--- Step 3: Test signInWithPassword ---');
    const tempClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
    });

    if (signInError) {
        console.error('ERROR: signInWithPassword FAILED:', signInError.message);
        console.log('The user cannot log in with the configured password.');
    } else {
        console.log('OK: signInWithPassword succeeded');
        console.log({
            userId: signInData.user?.id,
            hasAccessToken: !!signInData.session?.access_token,
            hasRefreshToken: !!signInData.session?.refresh_token,
        });

        // Clean up
        await tempClient.auth.signOut();

        // 5. Test getUser with the token
        console.log();
        console.log('--- Step 4: Test getUser with access token ---');
        const freshClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: getUserData, error: getUserError } = await freshClient.auth.getUser(
            signInData.session!.access_token
        );

        if (getUserError) {
            console.error('ERROR: getUser FAILED:', getUserError.message);
        } else {
            console.log('OK: getUser succeeded:', getUserData.user?.id);
        }

        // 6. Test the /auth/users endpoint using the access token
        console.log();
        console.log('--- Step 5: Test /auth/users API call ---');
        try {
            const response = await fetch('http://localhost:3001/api/v1/auth/users?limit=100', {
                headers: {
                    'Authorization': `Bearer ${signInData.session!.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            const body = await response.json();
            console.log('Response status:', response.status);

            if (response.ok) {
                console.log('OK: API returned', body.data?.length || 0, 'users');
                if (body.data && body.data.length > 0) {
                    console.log('First user:', body.data[0]);
                }
            } else {
                console.error('ERROR: API returned error:', body.error || body);
            }
        } catch (fetchError: any) {
            console.error('ERROR: Could not reach API server:', fetchError.message);
            console.log('Is the server running on localhost:3001?');
        }

        // 7. Test calendar bookings
        console.log();
        console.log('--- Step 6: Test /bookings/calendar API call ---');
        try {
            const response = await fetch('http://localhost:3001/api/v1/bookings/calendar', {
                headers: {
                    'Authorization': `Bearer ${signInData.session!.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            const body = await response.json();
            console.log('Response status:', response.status);

            if (response.ok) {
                console.log('OK: Calendar returned', body.data?.length || 0, 'bookings');
            } else {
                console.error('ERROR: Calendar API returned error:', body.error || body);
            }
        } catch (fetchError: any) {
            console.error('ERROR: Could not reach API server:', fetchError.message);
        }
    }

    // 8. Count total users in public.users
    console.log();
    console.log('--- Step 7: Count total users in public.users ---');
    const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('ERROR counting users:', countError.message);
    } else {
        console.log('Total users in public.users:', count);
    }

    console.log();
    console.log('=== DIAGNOSIS COMPLETE ===');
}

diagnose().catch(console.error);
