# Campus Resource Reservation System - Walkthrough

## 📋 Project Overview

A production-grade, scalable Campus Resource Reservation System built with:
- **Backend**: Express.js + TypeScript + Prisma + PostgreSQL (Supabase)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + shadcn/ui
- **Package Manager**: pnpm with workspaces
- **Real-time**: Socket.io for live updates
- **Optional**: Redis for caching (not required to run)

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ (you have v22.19.0)
- pnpm installed globally (`npm install -g pnpm`)
- PostgreSQL database (configured with Supabase)

### Run the Application

**Open 2 terminals in VS Code:**

#### Terminal 1: Server (Port 3001)
```powershell
cd c:\Users\Ashish\Downloads\L2_SE\server
pnpm run dev
```

#### Terminal 2: Client (Port 3000)
```powershell
cd c:\Users\Ashish\Downloads\L2_SE\client
pnpm run dev
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/api-docs

---

## 🔐 Test Credentials

Database is seeded with these users:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.edu | Password123! |
| Faculty | professor@university.edu | Password123! |
| Student | student1@university.edu | Password123! |

---

## ✅ API Tests Verified

All these tests pass:
```
✓ GET  /api/v1/health - Server health check
✓ POST /api/v1/auth/login - Login with credentials
✓ POST /api/v1/auth/register - Register new user (without department)
✓ GET  /api/v1/rooms - List all rooms (authenticated)
```

---

## 📁 Project Structure

```
L2_SE/
├── client/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components (shadcn/ui)
│   │   ├── contexts/      # React contexts (Auth)
│   │   └── lib/           # API client, utilities
│   └── package.json
│
├── server/                 # Express.js Backend
│   ├── prisma/
│   │   ├── schema.prisma  # Database schema
│   │   └── seed.ts        # Database seeding
│   ├── src/
│   │   ├── config/        # Configuration
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── lib/           # Prisma, Redis, Socket.io
│   │   └── index.ts       # Server entry point
│   ├── .env               # Environment variables
│   └── package.json
│
├── pnpm-workspace.yaml    # pnpm workspace config
└── package.json           # Root package.json
```

---

## 🛠️ Common Commands

### From Root Directory (`c:\Users\Ashish\Downloads\L2_SE`)

```powershell
# Install all dependencies
pnpm install

# Run both server and client together
pnpm dev

# Run only server
pnpm dev:server

# Run only client
pnpm dev:client
```

### From Server Directory (`server/`)

```powershell
# Development mode
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Prisma commands
pnpm exec prisma generate      # Generate Prisma client
pnpm exec prisma migrate dev   # Run migrations
pnpm exec prisma studio        # Open Prisma Studio (DB GUI)
pnpm run prisma:seed           # Seed database
```

### From Client Directory (`client/`)

```powershell
# Development mode
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

---

## 🔧 Troubleshooting

### VS Code Shows Prisma Type Errors (but build works)
This is a TypeScript server cache issue. Fix:
1. Press `Ctrl+Shift+P`
2. Type "Restart TS"
3. Select "TypeScript: Restart TS Server"

### Redis Connection Errors
Redis is **optional** - these warnings won't break the app:
```
ERROR: Redis client error { "code": "ECONNREFUSED" }
```
The app works fine without Redis. To use Redis, install and run Redis locally.

### Port Already in Use
Kill existing node processes:
```powershell
taskkill /f /im node.exe
```

### Database Connection Issues
Check `.env` in server folder:
```env
DATABASE_URL="postgresql://postgres.xxx:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```
Make sure password has NO brackets around it.

### Fresh Install
```powershell
# From root directory
Remove-Item -Recurse -Force node_modules, client/node_modules, server/node_modules -ErrorAction SilentlyContinue
pnpm install
cd server
pnpm exec prisma generate
```

---

## 📝 What Was Built

### Backend Features
- ✅ JWT Authentication (login, register, token refresh)
- ✅ Role-based access control (Student, Faculty, Admin, Lab Admin)
- ✅ Room management with amenities and capacity
- ✅ Booking system with conflict detection
- ✅ Recurring bookings support
- ✅ Weekly quota system per user
- ✅ Reputation scoring system
- ✅ Ghost booking killer (auto-cancel no-shows)
- ✅ Real-time updates via Socket.io
- ✅ Rate limiting and security headers
- ✅ Swagger API documentation

### Frontend Features
- ✅ Modern UI with shadcn/ui components
- ✅ Interactive booking calendar
- ✅ Room search and filtering
- ✅ User authentication flow
- ✅ Dashboard with room availability
- ✅ Admin panel for management

### Database Schema
- Users (with roles, reputation, credits)
- Departments
- Rooms (with amenities, capacity, type)
- Bookings (with status, check-in tracking)
- Waitlist entries
- Audit logs

---

## 🔄 Development Workflow

1. **Start servers** (Terminal 1 & 2)
2. **Make changes** - Hot reload is enabled
3. **Database changes**:
   ```powershell
   cd server
   # Edit prisma/schema.prisma
   pnpm exec prisma migrate dev --name your_migration_name
   pnpm exec prisma generate
   ```
4. **View database**:
   ```powershell
   cd server
   pnpm exec prisma studio
   ```

---

## 🚢 Production Deployment

### Build
```powershell
cd server
pnpm run build

cd ../client
pnpm run build
```

### Environment Variables (Production)
Set `NODE_ENV=production` and configure:
- `DATABASE_URL` - Production PostgreSQL
- `JWT_SECRET` - Strong secret (32+ chars)
- `REDIS_HOST`, `REDIS_PASSWORD` - Production Redis
- `CORS_ORIGIN` - Your frontend domain

---

## 📞 API Endpoints

### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/auth/quota` - Get user's weekly quota

### Rooms
- `GET /api/v1/rooms` - Search rooms
- `GET /api/v1/rooms/:id` - Get room details
- `GET /api/v1/rooms/best-fit` - Find rooms by capacity
- `GET /api/v1/rooms/by-building` - Rooms grouped by building

### Bookings
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings/my` - Get my bookings
- `GET /api/v1/bookings/:id` - Get booking details
- `DELETE /api/v1/bookings/:id` - Cancel booking
- `GET /api/v1/bookings/availability` - Check room availability

---

*Last Updated: January 13, 2026*
