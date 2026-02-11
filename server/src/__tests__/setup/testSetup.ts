/**
 * =============================================================================
 * Test Setup — Shared helpers for Epic 5 integration tests
 * =============================================================================
 * Provides authenticated Supertest agent and cleanup utilities.
 * Tests hit the real Supabase DB via the Express app.
 * =============================================================================
 */

import supertest from 'supertest';
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
 * Uses the admin account: ashish007tup@gmail.com / Admin123!
 */
export async function getAdminToken(): Promise<string> {
    if (adminToken) return adminToken;
    if (process.env.TEST_ADMIN_TOKEN) {
        adminToken = process.env.TEST_ADMIN_TOKEN;
        return adminToken;
    }

    const res = await request()
        .post('/api/v1/auth/login')
        .send({ email: 'ashish007tup@gmail.com', password: 'Admin123!' });

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

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate a magic link and exchange it for a session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: 'ashish007tup@gmail.com',
    });

    if (linkError || !linkData?.properties?.hashed_token) {
        throw new Error(`Failed to generate test auth token: ${linkError?.message}`);
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
    });

    if (verifyError || !verifyData?.session?.access_token) {
        throw new Error(`Failed to verify test auth token: ${verifyError?.message}`);
    }

    adminToken = verifyData.session.access_token;
    process.env.TEST_ADMIN_TOKEN = adminToken;
    return adminToken;
}

/**
 * Make an authenticated GET request
 */
export async function authGet(path: string) {
    const token = await getAdminToken();
    return request().get(path).set('Authorization', `Bearer ${token}`);
}

/**
 * Make an authenticated POST request
 */
export async function authPost(path: string, body?: object) {
    const token = await getAdminToken();
    const req = request().post(path).set('Authorization', `Bearer ${token}`);
    if (body) req.send(body);
    return req;
}

/**
 * Make an authenticated PATCH request
 */
export async function authPatch(path: string, body?: object) {
    const token = await getAdminToken();
    const req = request().patch(path).set('Authorization', `Bearer ${token}`);
    if (body) req.send(body);
    return req;
}

/**
 * Make an authenticated DELETE request
 */
export async function authDelete(path: string) {
    const token = await getAdminToken();
    return request().delete(path).set('Authorization', `Bearer ${token}`);
}

/**
 * Generate a unique name for test entities to avoid collisions
 */
export function uniqueName(prefix: string): string {
    return `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
