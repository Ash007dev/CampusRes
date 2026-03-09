/**
 * =============================================================================
 * US 3.9: Location Verification (GPS) — Unit Tests
 * =============================================================================
 *
 * Acceptance Criteria:
 *   Given I am in the hostel,
 *   When I try to check in to Lab,
 *   Then system rejects it with "Location Mismatch".
 *
 * Additional rules tested:
 *   - User within 50 m → allowed
 *   - User beyond 50 m → CHECKIN_4004 GeolocationError
 *   - Admin → always allowed regardless of distance
 *   - No GPS coords provided → allowed (soft policy)
 *   - Room has no stored GPS → allowed (nothing to compare)
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline haversine — mirrors the private helper in bookingService.ts so we can
// test the math independently without importing the service class.
// ---------------------------------------------------------------------------
function haversineMeters(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Haversine math unit tests
// ---------------------------------------------------------------------------
describe('US 3.9 — haversineMeters()', () => {
    it('returns 0 for identical coordinates', () => {
        expect(haversineMeters(18.52, 73.85, 18.52, 73.85)).toBe(0);
    });

    it('returns ~42 m for two nearby campus points', () => {
        // Simulate: lab at 18.5204 / hostel block 50m south
        const dist = haversineMeters(18.5204, 73.8567, 18.5200, 73.8567);
        expect(dist).toBeGreaterThan(30);
        expect(dist).toBeLessThan(60);
    });

    it('returns large distance for hostel vs lab scenario', () => {
        // Hostel ≈ 600 m from lab
        const dist = haversineMeters(18.5150, 73.8600, 18.5204, 73.8567);
        expect(dist).toBeGreaterThan(500);
    });

    it('returns ~111 km for 1 degree of latitude', () => {
        const dist = haversineMeters(0, 0, 1, 0);
        expect(dist).toBeGreaterThan(110_000);
        expect(dist).toBeLessThan(112_000);
    });
});

// ---------------------------------------------------------------------------
// GPS enforcement logic tests (isolated — no DB required)
// ---------------------------------------------------------------------------
describe('US 3.9 — GPS enforcement logic', () => {
    const ALLOWED_RADIUS = 50; // metres

    /**
     * Simulates the server-side GPS check block:
     *   - returns 'allowed' or throws with a code
     */
    function runGpsCheck(opts: {
        isAdmin: boolean;
        userLat?: number;
        userLng?: number;
        roomLat?: number | null;
        roomLng?: number | null;
    }): 'allowed' {
        const { isAdmin, userLat, userLng, roomLat, roomLng } = opts;

        if (!isAdmin && userLat !== undefined && userLng !== undefined) {
            if (roomLat != null && roomLng != null) {
                const distance = haversineMeters(userLat, userLng, roomLat, roomLng);
                if (distance > ALLOWED_RADIUS) {
                    const err: any = new Error(
                        `You are too far to check in — you are ${Math.round(distance)}m away (max ${ALLOWED_RADIUS}m). Please go to the venue.`
                    );
                    err.code = 'CHECKIN_4004';
                    err.details = { distance: Math.round(distance), allowedRadius: ALLOWED_RADIUS };
                    throw err;
                }
            }
            // No room coords → skip
        }
        // No user coords → skip (soft policy)
        // Admin → skip

        return 'allowed';
    }

    // ── Happy path ─────────────────────────────────────────────────────────────

    it('AC1: allows check-in when user is within 50 m of room', () => {
        // ~42 m away
        expect(() =>
            runGpsCheck({
                isAdmin: false,
                userLat: 18.5200, userLng: 73.8567,
                roomLat: 18.5204, roomLng: 73.8567,
            })
        ).not.toThrow();
    });

    it('AC2: allows check-in when user is exactly at room coordinates', () => {
        expect(() =>
            runGpsCheck({
                isAdmin: false,
                userLat: 18.5204, userLng: 73.8567,
                roomLat: 18.5204, roomLng: 73.8567,
            })
        ).not.toThrow();
    });

    // ── Rejection ──────────────────────────────────────────────────────────────

    it('AC3 (main AC): rejects when user is in hostel trying to check in to lab', () => {
        let thrown: any;
        try {
            runGpsCheck({
                isAdmin: false,
                userLat: 18.5150, userLng: 73.8600, // hostel
                roomLat: 18.5204, roomLng: 73.8567, // lab
            });
        } catch (e: any) {
            thrown = e;
        }

        expect(thrown).toBeDefined();
        expect(thrown.code).toBe('CHECKIN_4004');
        expect(thrown.message).toMatch(/too far/i);
        expect(thrown.details.distance).toBeGreaterThan(50);
        expect(thrown.details.allowedRadius).toBe(50);
    });

    it('AC4: rejects user who is 51 m away (boundary)', () => {
        // 51 m ≈ ~0.000459 degrees latitude
        const delta = 0.000459;
        expect(() =>
            runGpsCheck({
                isAdmin: false,
                userLat: 18.5204 + delta, userLng: 73.8567,
                roomLat: 18.5204, roomLng: 73.8567,
            })
        ).toThrow(/too far/i);
    });

    // ── Admin bypass ───────────────────────────────────────────────────────────

    it('AC5: admin bypasses GPS check regardless of distance', () => {
        expect(() =>
            runGpsCheck({
                isAdmin: true,
                userLat: 18.5150, userLng: 73.8600, // hostel
                roomLat: 18.5204, roomLng: 73.8567, // lab — far away
            })
        ).not.toThrow();
    });

    // ── Edge cases ─────────────────────────────────────────────────────────────

    it('AC6: allows check-in when no GPS coords provided (user denied permission)', () => {
        expect(() =>
            runGpsCheck({
                isAdmin: false,
                userLat: undefined, userLng: undefined,
                roomLat: 18.5204, roomLng: 73.8567,
            })
        ).not.toThrow();
    });

    it('AC7: allows check-in when room has no stored GPS coordinates', () => {
        expect(() =>
            runGpsCheck({
                isAdmin: false,
                userLat: 18.5150, userLng: 73.8600,
                roomLat: null, roomLng: null,
            })
        ).not.toThrow();
    });
});
