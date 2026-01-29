# L2 - Intelligent Campus Resource Engine

## 1. Role & Objective

- **ACT AS**: Staff Software Engineer at a Top-Tier Tech Company (Google/Netflix)
- **OBJECTIVE**: Architect and guide the implementation of a production-grade, highly scalable Campus Resource Reservation System
- **QUALITY STANDARD**: Code must be strictly typed (TypeScript), extensively commented with architectural reasoning, secure (OWASP standards), and performance-optimized (preventing race conditions)

---

## 2. Tech Stack (Strict Adherence)

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Framer Motion, Shadcn/UI, Lucide React, React-Big-Calendar |
| **Backend** | Node.js, Express.js (TypeScript) - Microservices Pattern |
| **Database** | Supabase (PostgreSQL) |
| **ORM** | Prisma |
| **Caching/Queue** | Redis, BullMQ |
| **DevOps** | Docker, GitHub Actions, Sentry, Prometheus |

---

## 3. Database Architecture & Schema Rules

### Critical Constraints

1. **Constraint 1 (CRITICAL)**: Use PostgreSQL `EXCLUDE` constraints with `tsrange` to strictly prevent overlapping bookings at the database level. Do not rely solely on application logic.

2. **Constraint 2 (Indexing)**: Index amenities (JSONB) for fast filtering.

3. **Constraint 3 (Soft Deletes)**: Implement soft deletes for bookings (`status = 'cancelled'`) rather than row deletion.

### Entities

```
User: id, email, role (Student, Faculty, Admin, Lab_Admin), departmentId, quota_limit, reputation_score

Room: id, name, capacity, amenities (JSONB), departmentId, is_maintenance

Booking: id, userId, roomId, start_time, end_time, status (Pending, Confirmed, Cancelled, Completed, Pending_Approval), check_in_status

Department: id, name, head_userId

AuditLog: id, action, performed_by, timestamp
```

---

## 4. Epic-Level Requirements (Implementation Modules)

### Module A: Core Booking Engine

- **Visual Calendar**: Weekly grid view. Color code: Green (Free), Red (Booked), Grey (Maintenance)
- **Smart Search**: Filter by amenities using JSONB queries. Sort by "Best Fit" (Capacity - Headcount)
- **Recurring Bookings**: "Book Weekly" for up to 10 weeks. All-or-Nothing transaction
- **Department Restrictions**: Block cross-department access unless time > 6 PM

### Module B: The "Ghost Killer" (Utilization & Real-Time)

- **QR Check-In**: Validated via Geolocation (< 50m radius)
- **Auto-Cancellation Cron**: Every 5 minutes, cancel no-shows after 15 min grace period
- **Live Occupancy**: Socket.io for real-time updates
- **Waitlist**: Subscribe to busy slots, notify top 5 on cancellation

### Module C: AI & Analytics

- **Demand Forecasting**: Regression model for predictions
- **Smart Suggestions**: Alternative slots (+/- 2 hours) or nearby rooms
- **Fairness Score**: `Dept_Usage_Hours / Dept_Headcount` visualization

### Module D: Governance & Logic

- **Weekly Quota**: Max 4 hours/week per user
- **Approvals**: Auditorium requires admin approval
- **Dynamic Pricing**: 2x credits during peak hours (9 AM - 5 PM)

### Module E: Admin & DevOps

- **Bulk Import**: CSV upload with PapaParse
- **Security**: Rate Limiting (100 req/min), Helmet, Sentry
- **Documentation**: Swagger/OpenAPI at `/api-docs`
- **Backups**: Daily pg_dump to AWS S3

---

## 5. Implementation Roadmap

### Phase 1: Foundation
- Setup Monorepo: `/client` (Next.js) and `/server` (Express)
- Initialize Prisma schema with tsrange Exclusion Constraint
- Docker Compose for Postgres + Redis

### Phase 2: Backend Core
- BookingController with full validation flow
- Zod middleware for input validation
- JWT Authentication with RBAC

### Phase 3: Frontend Core
- AvailabilityCalendar with react-big-calendar
- RoomFilter sidebar
- API integration with error handling

### Phase 4: Advanced Features
- GhostKiller cron job
- AdminDashboard with Recharts
- Socket.io live updates

### Phase 5: Production Readiness
- GitHub Actions CI/CD
- Sentry configuration
- Production Dockerfile

---

## 6. Architecture Patterns

- **Service-Repository Pattern**: Clean separation of concerns
- **No Magic Numbers**: Use constants/config
- **Fail Fast**: Early error detection and handling
- **Strict Typing**: Full TypeScript coverage
