# Epic 3: Testing Documentation

## Overview
For Epic 3 (Real-Time Utilization & Ghost Booking Prevention), we have implemented **Integration Tests** following **Pattern 2** (Supertest). These tests verify the API endpoints, middleware (authentication/validation), and business logic by making actual HTTP requests to the running Express application.

## Test Suite
The following test files have been created in `server/src/__tests__/epic3/`:

| User Story | Feature | Test File | Description |
| :--- | :--- | :--- | :--- |
| **US 3.1** | **QR Code Check-In** | `us3.1-checkin.test.ts` | Tests `POST /bookings/:id/check-in`. Verifies authentication, validation of room code/QR, and successful check-in flow. |
| **US 3.2** | **Ghost Bookings** | `us3.2-ghost-bookings.test.ts` | Tests `POST /bookings/:id/running-late` and verifies system handling of `NO_SHOW` and `LATE` statuses. |
| **US 3.3** | **Live Occupancy** | `us3.3-live-occupancy.test.ts` | Tests `GET /rooms/available-now` and `GET /bookings/availability`. Confirms real-time status fields are returned correctly. |
| **US 3.4** | **Early Checkout** | `us3.4-early-checkout.test.ts` | Tests `POST /bookings/:id/early-checkout`. Verifies credit refund calculations and status updates to `COMPLETED`. |
| **US 3.5** | **Extend Meeting** | `us3.5-extend-meeting.test.ts` | Tests `POST /bookings/:id/extend`. Verifies conflict detection, credit checking, and time extension logic. |
| **US 3.7** | **Waitlist** | `us3.7-waitlist.test.ts` | Tests full CRUD: `POST /waitlist` (join), `GET /waitlist/my` (list), `DELETE /waitlist/:id` (leave), and position checks. |
| **US 3.8** | **Check-In Reminder** | `us3.8-checkin-reminder.test.ts` | Verifies that booking data (start_time, user_id) conforms to requirements for the notification scheduler. |

## Running Tests

To run the full Epic 3 test suite:
```bash
npm run test:epic3
```

To run a specific test file:
```bash
npx vitest run src/__tests__/epic3/us3.1-checkin.test.ts
```

## Important Notes
- **Authentication:** Tests use a shared `getAdminToken()` helper. If running tests in parallel (`--fileParallelism=true`), you may encounter authentication race conditions. It is recommended to run them sequentially if this occurs.
- **Database:** These tests run against the **connected Supabase instance**. They read real data but do not delete existing production data (they only clean up their own test data where applicable).
- **Validation vs. Business Logic:** Some tests may return "Business Logic Errors" (e.g., "Check-in window has expired") instead of 200 OK if the test data condition isn't met (e.g., trying to check in to a booking that isn't starting *right now*). This is expected behavior and confirms the business logic is active.
