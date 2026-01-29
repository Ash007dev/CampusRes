# 🏫 Campus Resource Engine (CampusRes)

A modern room booking system for educational institutions built with **Next.js**, **Express**, and **Supabase**.

## 🚀 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, JWT Authentication
- **Database**: PostgreSQL (Supabase)
- **Real-time**: Socket.io
- **Cache**: Redis (optional)

---

## 📋 Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account (for database)

---

## 🛠️ Quick Setup for Teammates

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/campus-resource-engine.git
cd campus-resource-engine
```

### 2. Install dependencies
```bash
# Root dependencies
npm install

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 3. Set up environment variables

**Server** (in `server/` folder):
```bash
cp .env.example .env
```
Edit `server/.env` and add:
- `SUPABASE_URL` - Get from Supabase Dashboard > Settings > API
- `SUPABASE_SERVICE_KEY` - Get from Supabase Dashboard > Settings > API > service_role key
- `JWT_SECRET` - Generate a random string (e.g., `openssl rand -hex 32`)

**Client** (in `client/` folder):
```bash
cp .env.example .env.local
```
The defaults should work for local development.

### 4. Start the development servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Server runs at: http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```
Client runs at: http://localhost:3001

---

## 📁 Project Structure

```
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   ├── components/    # React components
│   │   ├── contexts/      # Auth context
│   │   ├── lib/           # API client, utilities
│   │   └── hooks/         # Custom hooks
│   └── .env.example
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, validation
│   │   ├── routes/        # API routes
│   │   └── lib/           # Supabase, Redis clients
│   └── .env.example
└── README.md
```

---

## 🔑 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@campus.edu | admin123 |
| Student | student@campus.edu | student123 |

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push: `git push origin feature/your-feature`
4. Open a Pull Request

---

## 📝 Common Issues

**"undefined undefined" for user name?**
Make sure the server is restarted after any changes.

**CORS errors?**
Check that `CORS_ORIGIN` in server `.env` matches your client URL.

**Database connection failed?**
Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct.
