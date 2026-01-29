# 🚀 CampusRes - Complete Setup Guide

## ⚠️ READ THIS FIRST

This guide walks you through setting up the Campus Resource Reservation System from scratch. Follow **each step in order**.

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:

| Requirement | How to Check | Install Link |
|-------------|--------------|--------------|
| Node.js 20.x | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm 10.x | `npm --version` | Comes with Node.js |
| Docker Desktop | `docker --version` | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | `git --version` | [git-scm.com](https://git-scm.com/) |

> ⚠️ **Important**: You're using Node.js v22 which may have compatibility issues. Consider using Node.js 20 LTS.

---

## 🗄️ STEP 1: Supabase Setup (Database)

You have two options for the database:

### Option A: Use Supabase (Recommended for beginners)

1. **Create Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for free

2. **Create New Project**
   - Click "New Project"
   - Name: `campusres`
   - Database Password: **Save this password!**
   - Region: Choose closest to you
   - Click "Create new project"

3. **Wait for Setup** (takes 1-2 minutes)

4. **Get Your Connection String**
   - Go to Project Settings → Database
   - Copy the "Connection string" (URI)
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

5. **Enable Required Extension**
   - Go to SQL Editor in Supabase
   - Run this SQL:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```

### Option B: Use Docker (Local PostgreSQL)

If you prefer local development with Docker:

```powershell
# Make sure Docker Desktop is running first!
cd C:\Users\Ashish\Downloads\L2_SE
docker-compose up -d postgres redis
```

Connection string will be: `postgresql://campusres:campusres@localhost:5432/campusres`

---

## 🧹 STEP 2: Clean Up Failed Installation

The npm install failed. Let's clean everything:

```powershell
# Open PowerShell as Administrator
cd C:\Users\Ashish\Downloads\L2_SE

# Delete all node_modules folders
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force client\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force server\node_modules -ErrorAction SilentlyContinue

# Delete package-lock files
Remove-Item package-lock.json -ErrorAction SilentlyContinue
Remove-Item client\package-lock.json -ErrorAction SilentlyContinue
Remove-Item server\package-lock.json -ErrorAction SilentlyContinue

# Clear npm cache
npm cache clean --force
```

---

## 📦 STEP 3: Install Dependencies (Clean Install)

### 3.1 Install Server Dependencies First

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\server
npm install
```

### 3.2 Install Client Dependencies

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\client
npm install
```

### 3.3 Install Root Dependencies (Optional)

```powershell
cd C:\Users\Ashish\Downloads\L2_SE
npm install
```

---

## ⚙️ STEP 4: Configure Environment Variables

### 4.1 Server Configuration

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\server
Copy-Item .env.example .env
```

Now **edit the `.env` file** with your settings:

```powershell
notepad .env
```

Update these values:

```env
# If using Supabase, paste your connection string here:
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# If using Docker locally:
# DATABASE_URL="postgresql://campusres:campusres@localhost:5432/campusres"

# Redis (only needed if using Docker - skip if not)
REDIS_URL="redis://localhost:6379"

# IMPORTANT: Change this to a random string!
JWT_SECRET="change-this-to-a-very-long-random-string-at-least-32-chars"

# Server settings
PORT=3001
NODE_ENV=development
```

### 4.2 Client Configuration

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\client
Copy-Item .env.example .env.local
```

The defaults should work for local development.

---

## 🗃️ STEP 5: Setup Database Schema

This creates all the tables in your database:

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\server

# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push
```

> **Note**: If you see errors about `btree_gist` extension, make sure you ran the SQL in Step 1.

### 5.1 Seed Sample Data (Optional but Recommended)

```powershell
npx prisma db seed
```

This creates:
- Sample users (admin, faculty, students)
- Sample rooms
- Sample bookings

**Default login credentials after seeding:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.edu | Password123! |
| Faculty | professor@university.edu | Password123! |
| Student | student1@university.edu | Password123! |

---

## 🚀 STEP 6: Start the Application

### 6.1 Start the Server

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\server
npm run dev
```

You should see:
```
✅ Server running on http://localhost:3001
📚 API Documentation: http://localhost:3001/api-docs
```

### 6.2 Start the Client (New Terminal)

Open a **new terminal window**:

```powershell
cd C:\Users\Ashish\Downloads\L2_SE\client
npm run dev
```

You should see:
```
▲ Next.js 14.x
- Local: http://localhost:3000
```

---

## ✅ STEP 7: Verify Everything Works

1. **Open Browser**: Go to http://localhost:3000
2. **Login**: Use the credentials from Step 5.1
3. **Test Features**:
   - View the booking calendar
   - Browse available rooms
   - Try making a booking

---

## 🔧 Troubleshooting

### Problem: npm install fails with EPERM errors

**Solution**: Close VS Code and any terminals, then:
```powershell
# Run PowerShell as Administrator
taskkill /f /im node.exe
Remove-Item -Recurse -Force node_modules
npm install
```

### Problem: Prisma errors about connection

**Solution**: Check your DATABASE_URL in `.env`:
- Make sure it's correct
- If using Supabase, ensure the project is active
- If using Docker, ensure containers are running: `docker ps`

### Problem: "btree_gist" extension error

**Solution**: Run this SQL in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### Problem: Port already in use

**Solution**:
```powershell
# Find what's using the port
netstat -ano | findstr :3001
# Kill the process (replace PID)
taskkill /PID <PID_NUMBER> /F
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     YOUR BROWSER                        │
│                  http://localhost:3000                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS CLIENT (Port 3000)                 │
│         React Components, Booking Calendar              │
└────────────────────────┬────────────────────────────────┘
                         │ API Calls
                         ▼
┌─────────────────────────────────────────────────────────┐
│            EXPRESS SERVER (Port 3001)                   │
│     Authentication, Booking Logic, Room Management     │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│   SUPABASE/      │          │     REDIS        │
│   POSTGRESQL     │          │   (Optional)     │
│   (Database)     │          │   (Caching)      │
└──────────────────┘          └──────────────────┘
```

---

## 📁 Key Files You Should Know

| File | Purpose |
|------|---------|
| `server/.env` | Server configuration (database, secrets) |
| `client/.env.local` | Client configuration (API URLs) |
| `server/prisma/schema.prisma` | Database schema definition |
| `docker-compose.yml` | Docker services configuration |

---

## 🎯 What Each Component Does

| Component | Description |
|-----------|-------------|
| **Next.js Client** | User interface - calendar, forms, dashboards |
| **Express Server** | API endpoints, business logic, authentication |
| **PostgreSQL** | Stores users, rooms, bookings |
| **Redis** | Optional caching for performance |
| **Prisma** | Database ORM - makes database queries easy |

---

## ❓ Need Help?

If you're still stuck:

1. **Check the terminal output** for specific error messages
2. **Verify prerequisites** (Node.js 20, Docker running)
3. **Double-check .env files** have correct values
4. **Try the Troubleshooting section** above

---

## 🏃 Quick Start Summary

```powershell
# 1. Clean up
cd C:\Users\Ashish\Downloads\L2_SE
Remove-Item -Recurse -Force node_modules, client\node_modules, server\node_modules -ErrorAction SilentlyContinue

# 2. Setup Supabase at supabase.com (get your connection string)

# 3. Install dependencies
cd server && npm install
cd ..\client && npm install

# 4. Configure server
cd ..\server
Copy-Item .env.example .env
# Edit .env and add your DATABASE_URL

# 5. Setup database
npx prisma generate
npx prisma db push
npx prisma db seed

# 6. Start server
npm run dev

# 7. New terminal - Start client
cd C:\Users\Ashish\Downloads\L2_SE\client
npm run dev

# 8. Open http://localhost:3000
```
