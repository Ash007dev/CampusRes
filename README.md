# Campus Resource Engine - Intelligent Study Room Booking

## Project Overview

Campus Resource Engine (CRE) is a comprehensive resource management application designed to optimize the allocation and utilization of shared campus spaces (study rooms, labs, equipment) through intelligent scheduling and integrity checks. The platform connects students and faculty with available resources using a real-time availability engine that prioritizes fair access, significantly reducing "ghost bookings" and waste.

Unlike traditional booking calendars, CRE integrates **active integrity enforcement** (Ghost Killer system), **real-time waitlist automation**, and **reputation tracking** directly into the core user experience. The system is built on a responsive, event-driven architecture that ensures seamless synchronization between all users without manual refreshing.

## Core Value Proposition

What sets CRE apart is its dedicated focus on "operational integrity" combined with robust technical execution of fair allocation:

1.  **Ghost Killer Integrity System**: Our proprietary cron-based logic identifies "ghost bookings" (no-shows) using QR code check-in validation. It automatically cancels abandoned slots after 15 minutes and penalizes the user's reputation score.
2.  **Smart Waitlist Automation**: When a slot opens up (via cancellation or ghost-kill), the system instantly promotes the next eligible user from the waitlist based on priority rules, sending immediate notifications via WebSocket and Email.
3.  **Credit-Based Fairness**: Resources are distributed equitably using a strict weekly credit quota system (e.g., 15 hours/week), preventing monopoly by power users while allowing flexibility for genuine needs.
4.  **Real-Time Data Sync**: Utilizing Socket.io technology, resource availability (Booked, Available, Maintenance) is synchronized instantly across all connected clients, eliminating double-booking conflicts.

## Technology Stack

The project utilizes a modern, type-safe architecture with specific enhancements for real-time capabilities and reliability.

### Frontend
-   **Framework**: Next.js 14 (React 18)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS + Radix UI for accessible, utility-first design
-   **State Management**: Zustand (Global Store) + React Query (Server State)
-   **Real-Time**: Socket.io Client for live events
-   **Visualization**: Recharts for admin analytics

### Backend (Server)
-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: PostgreSQL (via Supabase)
-   **Real-Time Communication**: Socket.io Server for bidirectional event handling
-   **Authentication**: Supabase Auth (JWT + RBAC Middleware)
-   **Job Processing**: BullMQ / Node-Cron for scheduled integrity checks

### DevOps & Tools
-   **Version Control**: Git
-   **Package Management**: npm
-   **Validation**: Zod (Schema Validation)

### Testing Frameworks
We employ a comprehensive testing strategy to ensure reliability:
-   **Unit Testing**: Vitest (for core logic modules like credit calculation and reputation penalties)
-   **Integration Testing**: Supertest (for validating API endpoints and controller-service interactions)
-   **Environment**: Cloud-based Supabase instance for realistic DB testing

## Key Features & User Stories (Epics)

The development of CRE was organized into five major Epics, each addressing specific user needs:

### Epic 1: Secure Foundation & Identity
-   **As a user**, I can securely log in using Supabase Auth so that my identity is protected.
-   **As a system**, I enforce Role-Based Access Control (RBAC) to ensure only authorized users (Admins) can modify system configurations.
-   **As a student**, I can view my profile with my current credit balance and reputation score.

### Epic 2: Seamless Discovery
-   **As a student**, I can filter rooms by capacity, amenities (Whiteboard, TV), and date to find the perfect study space.
-   **As a student**, I can view real-time availability grids that update instantly without refreshing the page.
-   **As a system**, I prevent double-bookings by locking slots the moment they are reserved.

### Epic 3: Fair Access & Allocation
-   **As a student**, I can join a waitlist for a fully booked room and get notified if it becomes available.
-   **As a system**, I enforce a weekly booking limit (e.g., 15 credits) to ensure fair usage for all students.
-   **As a student**, I am automatically promoted from the waitlist when a slot opens up.

### Epic 4: Insight & Control (Admin)
-   **As an admin**, I can view comprehensive analytics on room utilization, peak hours, and cancellation rates.
-   **As an admin**, I can manage user accounts, manually adjust credits, or ban users for repeated policy violations.
-   **As a system**, I log every critical action (Booking, Cancellation, Check-in) to an immutable audit log for transparency.

### Epic 5: Operational Integrity (Ghost Killer)
-   **As a system**, I automatically mark bookings as "User Checked In" when they scan the room's QR code.
-   **As a system**, I run a background job every 5 minutes to identify "Ghost Bookings" (past start time with no check-in).
-   **As a system**, I automatically cancel ghost bookings and deduct reputation points to discourage waste.
-   **As a user**, my booking is protected for the first 15 minutes before being released to others.

## Execution Strategy

The project execution followed an agile methodology with iterative development and rigorous testing:

1.  **Architecture Design**: Established a clear separation of concerns. The Frontend handles UI/UX and optimistic updates, while the Backend enforces business rules and data integrity.
2.  **Real-Time Implementation**: Implemented a WebSocket layer (`socket.ts`) to broadcast critical events (`SLOT_UPDATE`, `BOOKING_CONFIRMED`) to all connected clients, ensuring the schedule grid is always accurate.
3.  **Integrity Logic**: Developed the "Ghost Killer" cron job (`ghostKiller.ts`) which queries the database for stale bookings and processes cancellations transactionally.
4.  **State Recovery**: Engineered robust error handling in the frontend to gracefully handle network failures and retry failed requests.
5.  **Quality Assurance**: Integrated `vitest` and `supertest` to validate 100% of the critical path logic (Booking, Waitlist Promotion, Ghost Killing) before deployment.

## Installation & Setup

### Prerequisites
-   Node.js (v18 or higher)
-   npm (v9 or higher)
-   Supabase Project (PostgreSQL)

### Steps
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Ash007dev/CampusRes.git
    cd CampusRes
    ```

2.  **Install Dependencies**
    Frontend:
    ```bash
    cd client
    npm install
    ```
    Backend:
    ```bash
    cd ../server
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in **server** directory:
    ```
    PORT=3001
    SUPABASE_URL=your_supabase_url
    SUPABASE_SERVICE_KEY=your_supabase_service_key
    ```
    Create a `.env.local` file in **client** directory:
    ```
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
    NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
    ```

4.  **Running the Application**
    Start the Backend (from `server` directory):
    ```bash
    npm run dev
    ```
    Start the Frontend (from `client` directory):
    ```bash
    npm run dev
    ```

5.  **Running Tests**
    To execute the test suite:
    ```bash
    cd server
    npm test
    ```
