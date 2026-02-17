'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the URL hash parameters (Supabase returns tokens in the hash)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const error = hashParams.get('error');
                const errorDescription = hashParams.get('error_description');

                // Clear sensitive hash from URL immediately
                if (window.location.hash) {
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }

                // Check for errors
                if (error) {
                    console.error('OAuth error:', error, errorDescription);
                    toast.error('Authentication Failed', {
                        description: errorDescription || 'Failed to sign in with Google'
                    });
                    router.push('/login');
                    return;
                }

                // Check if we have tokens
                if (!accessToken) {
                    toast.error('Authentication Failed', {
                        description: 'No access token received'
                    });
                    router.push('/login');
                    return;
                }

                // Store tokens in localStorage
                localStorage.setItem('access_token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refresh_token', refreshToken);
                }

                // Fetch user info from backend
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!res.ok) {
                    throw new Error('Failed to fetch user info');
                }

                const data = await res.json();

                // Store user info
                localStorage.setItem('user', JSON.stringify(data.user));

                // Show success message
                toast.success('Welcome!', {
                    description: 'Successfully signed in with Google'
                });

                // Redirect to dashboard
                router.push('/dashboard');

            } catch (error: any) {
                console.error('Callback error:', error);
                toast.error('Authentication Error', {
                    description: error.message || 'Something went wrong'
                });
                router.push('/login');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
            <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
            </div>
        </div>
    );
}
