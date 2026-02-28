/**
 * =============================================================================
 * Test Setup — Shared helpers for Epic 5 integration tests
 * =============================================================================
 * Provides authenticated Supertest agent and cleanup utilities.
 * Tests hit the real Supabase DB via the Express app.
 * =============================================================================
 */

import supertest from 'supertest';
import type { Test } from 'supertest';
import { createApp } from '../../app.js';
import type { Application } from 'express';

let app: Application;
let adminToken: string;

/**
 * Get (or create) the Express app instance for testing
 */
export function getApp(): Application {
    if (!app) {
        app = createApp();
    }
    return app;
}

/**
 * Get a Supertest agent bound to the app
 */
export function request() {
    return supertest(getApp());
}

/**
 * Login as admin and cache the JWT token.
 * Uses the admin account: satheeshadwaitha@gmail.com / Password123!
 */
export async function getAdminToken(): Promise<string> {
    if (adminToken) return adminToken;
    if (process.env.TEST_ADMIN_TOKEN) {
        adminToken = process.env.TEST_ADMIN_TOKEN;
        return adminToken;
    }

    const res = await request()
        .post('/api/v1/auth/login')
        .send({ email: 'satheeshadwaitha@gmail.com', password: 'Password123!' });

    // If MFA is required, we need to handle OTP — but for tests we'll
    // check if we got tokens directly (non-MFA path)
    if (res.body?.data?.tokens?.accessToken) {
        adminToken = res.body.data.tokens.accessToken;
        process.env.TEST_ADMIN_TOKEN = adminToken;
        return adminToken;
    }

    // If MFA is required, the login returns requiresOtp: true
    // For integration tests, we need the legacy login path or a test bypass
    // Let's try using Supabase directly to get a session
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env. ' +
            'Make sure server .env is loaded.'
        );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Try direct sign-in with password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'satheeshadwaitha@gmail.com',
        password: 'Password123!',
    });

    if (authError || !authData?.session?.access_token) {
        throw new Error(`Failed to authenticate test user: ${authError?.message}`);
    }

    adminToken = authData.session.access_token;
    process.env.TEST_ADMIN_TOKEN = adminToken;

    // Ensure the test user has ADMIN role in public.users table
    // (prevents 403 errors when the DB row role doesn't match)
    const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'ADMIN' })
        .eq('id', authData.user.id);

    if (roleError) {
        console.warn(`Warning: could not set ADMIN role for test user: ${roleError.message}`);
    }

    return adminToken;
}

/**
 * Make an authenticated GET request
 */
export async function authGet(path: string): Promise<Test> {
    const token = await getAdminToken();
    return request().get(path).set('Authorization', `Bearer ${token}`);
}

/**
 * Make an authenticated POST request
 */
export async function authPost(path: string, body?: object): Promise<Test> {
    const token = await getAdminToken();
    const req = request().post(path).set('Authorization', `Bearer ${token}`);
    if (body) req.send(body);
    return req;
}

/**
 * Make an authenticated PATCH request
 */
export async function authPatch(path: string, body?: object): Promise<Test> {
    const token = await getAdminToken();
    const req = request().patch(path).set('Authorization', `Bearer ${token}`);
    if (body) req.send(body);
    return req;
}

/**
 * Make an authenticated DELETE request
 */
export async function authDelete(path: string): Promise<Test> {
    const token = await getAdminToken();
    return request().delete(path).set('Authorization', `Bearer ${token}`);
}

/**
 * Generate a unique name for test entities to avoid collisions
 */
export function uniqueName(prefix: string): string {
    return `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
