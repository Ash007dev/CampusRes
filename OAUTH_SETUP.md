# OAuth Setup Guide for Campus Resource Engine

## Step 1: Configure Google OAuth

### 1.1 Create Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure OAuth consent screen if prompted
6. Application type: **Web application**
7. Add authorized redirect URIs:
   ```
   https://arxsyeioxxjrukonnzwm.supabase.co/auth/v1/callback
   http://localhost:3002/auth/callback
   ```
8. Copy **Client ID** and **Client Secret**

### 1.2 Configure in Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **arxsyeioxxjrukonnzwm**
3. Go to **Authentication > Providers**
4. Find **Google** and toggle it ON
5. Paste your Google Client ID and Client Secret
6. Click **Save**

---

## Step 2: Configure Microsoft/Outlook OAuth

### 2.1 Create Microsoft OAuth App
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Name: **Campus Resource Engine**
5. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
6. Redirect URI: **Web** + `https://arxsyeioxxjrukonnzwm.supabase.co/auth/v1/callback`
7. Click **Register**
8. Copy **Application (client) ID**
9. Go to **Certificates & secrets**
10. Click **New client secret**
11. Copy the **Value** (this is your Client Secret)

### 2.2 Configure in Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **arxsyeioxxjrukonnzwm**
3. Go to **Authentication > Providers**
4. Find **Azure (Microsoft)** and toggle it ON
5. Paste your Azure Client ID and Client Secret
6. Azure Tenant: Use `common` for multi-tenant support
7. Click **Save**

---

## Step 3: Environment Variables (Already Configured)

Your Supabase URL and keys are already set in `.env`:
```
SUPABASE_URL=https://arxsyeioxxjrukonnzwm.supabase.co
SUPABASE_SERVICE_KEY=...
```

---

## Step 4: Test OAuth

After configuring in Supabase:
1. The OAuth buttons will appear on your login page
2. Click "Continue with Google" or "Continue with Microsoft"
3. Complete the OAuth flow
4. User will be created automatically in Supabase Auth

---

## Important Notes:

1. **Production URLs**: When deploying, add your production domain to authorized redirect URIs
2. **Email Verification**: OAuth users are automatically verified
3. **User Sync**: After OAuth login, create a record in `public.users` table to sync roles
4. **Default Role**: OAuth users should be assigned a default role (e.g., STUDENT)

---

## Next Steps After Supabase Configuration:

Run the updated LoginForm and test OAuth login!
