"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const [status, setStatus] = useState('Completing sign in...');
  const handled = useRef(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (handled.current) return;
      handled.current = true;

      try {
        // Implicit flow: Supabase returns #access_token=...&refresh_token=... in hash
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
          console.error('[OAuth Callback] No access_token in URL hash');
          window.location.replace('/auth/login?error=no_tokens');
          return;
        }

        // Set the Supabase session so RLS-protected queries work
        if (refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        // Decode the JWT payload to get user info (no API call needed)
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const userId = payload.sub;
        const email = payload.email;
        const metadata = payload.user_metadata || {};
        const fullName = metadata.full_name || metadata.name || email?.split('@')[0] || 'User';

        console.log('[OAuth Callback] Logged in as:', email);
        setStatus('Setting up your account...');

        // Ensure user exists in public.users table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role, reputation_score')
          .eq('id', userId)
          .single();

        if (!existingUser) {
          const firstName = metadata.first_name || fullName.split(' ')[0];
          const lastName = metadata.last_name || fullName.split(' ').slice(1).join(' ') || '';

          const { error: insertError } = await supabase.from('users').insert({
            id: userId,
            email: email,
            first_name: firstName,
            last_name: lastName,
            role: 'STUDENT',
            reputation_score: 100,
            credits_balance: 100,
            quota_limit_hours: 10,
            is_active: true,
            email_verified: true,
            no_show_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error('[OAuth Callback] Failed to create user profile:', insertError);
          } else {
            console.log('[OAuth Callback] Created user profile for:', email);
          }
        }

        // Store token and user info for our app
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        localStorage.setItem('user', JSON.stringify({
          id: userId,
          email: email,
          name: fullName,
          role: existingUser?.role || 'STUDENT',
          reputationScore: existingUser?.reputation_score || 100,
        }));

        // Set cookie for Next.js middleware
        document.cookie = `accessToken=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

        setStatus('Redirecting to dashboard...');
        window.location.replace('/dashboard');

      } catch (error) {
        console.error('[OAuth Callback] Error:', error);
        setStatus('Something went wrong...');
        setTimeout(() => window.location.replace('/auth/login?error=oauth_error'), 2000);
      }
    };

    handleOAuthCallback();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-4 text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
