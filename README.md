# Campus Resource Engine (CRE)

A comprehensive, real-time platform designed to optimize the allocation and utilization of campus resources (study rooms, labs, equipment) through intelligent scheduling, fair usage policies, and automated integrity checks.

---

## 📌 Project Overview & Problem Statement

### The Problem
University campuses often face significant inefficiencies in resource management:
- **"Ghost Bookings":** Students reserve rooms but never show up, wasting valuable space.
- **Unfair Allocation:** Resources are monopolized by a few, leaving others without access.
- **Administrative Burden:** Manual tracking and conflict resolution consume staff time.
- **Lack of Visibility:** Students struggle to find available spaces in real-time.

### The Solution: Campus Resource Engine
CRE addresses these challenges with a **credit-based booking system** powered by real-time data and automated enforcement mechanisms. It ensures equitable access, maximizes utilization through waitlist automaton, and disincentivizes misuse via reputation scoring.

---

## 🚀 Key Features

### 🔐 1. Advanced Authentication & Security
- **Secure Access:** Supabase Auth integration with JWT handling.
- **Multi-Factor Authentication (MFA):** Enhanced security for all users.
- **Role-Based Access Control (RBAC):** Granular permissions for Students, Faculty, and Administrators.
- **Profile Management:** User profiles with department mapping and reputation tracking.

### 📅 2. Smart Booking & Scheduling
- **Real-Time Availability:** Instant checking of room/resource status.
- **Conflict Detection:** automated prevention of double-booking.
- **Credit Logic:** Weekly quota system (e.g., 10 hours/week) ensures fair distribution.
- **QR Code Check-in:** Verifies physical presence to confirm bookings.

### ⏳ 3. Intelligent Waitlist Management
- **Automated Promotion:** Waitlisted users are automatically promoted when a slot opens.
- **Priority Logic:** Promotions consider reputation scores and booking history.
- **Instant Notifications:** Users are alerted immediately via email and real-time socket events.

### 👻 4. "Ghost Killer" Integrity System
- **Automated No-Show Detection:** Cron jobs identify bookings where users failed to check in.
- **Dynamic Penalties:** Automatically cancels "ghost" bookings, frees up the slot, deducts reputation points.
- **Ban Logic:** Repeat offenders (3+ no-shows) face temporary account suspension.

### 📊 5. Administrative Control Center
- **Comprehensive Dashboard:** Visual analytics for resource usage, peak times, and user activity.
- **Audit Logging:** Full traceability of all system actions (Login, Booking, Cancellation, System Cron).
- **User Management:** Tools to adjust credits, manage bans, and oversee roles.
- **Broadcast System:** Send mass announcements to all users.

---

## 🛠️ Technology Stack

Our application is built on a modern, type-safe stack designed for performance and scalability.

### Client-Side
- **Framework:** Next.js 14 (React 18)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI (Headless components)
- **State Management:** Zustand + React Query
- **Real-Time:** Socket.IO Client
- **Visualization:** Recharts for analytics

### Server-Side
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Real-Time:** Socket.IO Server
- **Authentication:** Supabase Auth
- **Validation:** Zod
- **Job Processing:** BullMQ / Node-Cron (for Ghost Killer)

### DevOps & Tooling
- **Testing:** Vitest (Unit & Integration), Jest
- **Linting:** ESLint + Prettier
- **Documentation:** Swagger / OpenAPI

---

## 🧪 Testing Strategy

We employ a rigorous testing methodology to ensure system reliability and fairness logic.

- **Unit Testing (Vitest):** Focused on core logic modules (e.g., Credit calculation, Reputation penalties).
- **Integration Testing:** Verifies the interaction between controllers, services, and the database.
- **Epic-Based Test Suites:**
    - `test:epic3`: Validates smart allocation, waitlist promotion, and conflict resolution.
    - `test:epic5`: Validates the "Ghost Killer" integrity logic and cron job execution.
- **End-to-End Formatting:** Verified API responses match client expectations (e.g., CamelCase mapping).

---

## 📖 User Epics

The development was driven by key User Epics to ensure user-centric value delivery:

1.  **"Secure Foundation" (Epic 1):** As a user, I want secure, role-based access so my data and privileges are protected.
2.  **"Seamless Discovery" (Epic 2):** As a student, I want to easily find and book available rooms that fit my schedule.
3.  **"Fair Access" (Epic 3):** As a student, I want a fair chance to get a room via waitlists and credit limits, so resources aren't hoarded.
4.  **"Operational Integrity" (Epic 5 - Ghost Killer):** As an admin, I want the system to automatically penalize no-shows so that wasted time slots are minimized.
5.  **"Insight & Control" (Epic 4):** As an admin, I want visibility into system usage and the ability to intervene when necessary.

---

## ⚡ What Makes CRE Stand Out?

1.  **Active fairness enforcement:** Unlike passive booking tools, CRE actively penalizes misuse (No-Shows) and rewards good behavior (Reputation).
2.  **Automated Optimization:** The "Ghost Killer" feature proactively recovers wasted inventory without human intervention.
3.  **Real-Time Sync:** Socket.IO integration ensures that availability visuals are accurate to the millisecond across all connected clients.
4.  **Auditability:** Every significant action is logged, creating a transparent environment for dispute resolution.

---

## 🏃‍♂️ Execution & Setup

### Prerequisites
- Node.js (v18+)
- Supabase Account & Project

### Steps
1.  **Clone the Repository**
2.  **Install Dependencies:**
    ```bash
    cd client && npm install
    cd ../server && npm install
    ```
3.  **Environment Setup:**
    - Configure `.env` in `client` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
    - Configure `.env` in `server` with `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`.
4.  **Run Development Servers:**
    ```bash
    # Terminal 1 (Server)
    cd server && npm run dev

    # Terminal 2 (Client)
    cd client && npm run dev
    ```
5.  **Access:** Open `http://localhost:3000` to view the application.

---

