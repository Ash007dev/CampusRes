"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authApi } from '@/lib/api';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
          const user = session.user;
          
          // Check if user exists in public.users table
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          // If user doesn't exist in public.users, create them
          if (!existingUser) {
            // Extract name from metadata or email
            const firstName = user.user_metadata?.full_name?.split(' ')[0] || 
                            user.email?.split('@')[0] || 'User';
            const lastName = user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '';

            await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                firstName: firstName,
                lastName: lastName,
                role: 'STUDENT', // Default role for OAuth users
                reputationScore: 100,
                weeklyQuota: 10,
                weeklyUsage: 0,
              });
          }

          // Store the session token for our backend
          const accessToken = session.access_token;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('user', JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email,
            role: existingUser?.role || 'STUDENT',
            reputationScore: existingUser?.reputationScore || 100,
          }));

          document.cookie = `accessToken=${accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          // No session, redirect to login
          router.push('/auth/login?error=oauth_failed');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        router.push('/auth/login?error=oauth_error');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
