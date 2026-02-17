'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth(); // Hooks must be inside component

    // Handle OAuth callback if tokens are in URL hash
    useEffect(() => {
        const handleOAuthCallback = async () => {
            const hash = window.location.hash;
            if (!hash) return;

            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken) {
                console.log('OAuth tokens detected in URL');
                setIsLoading(true);

                try {
                    // Store tokens
                    localStorage.setItem('access_token', accessToken);
                    if (refreshToken) {
                        localStorage.setItem('refresh_token', refreshToken);
                    }

                    // Fetch user info
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });

                    if (!res.ok) {
                        throw new Error('Failed to fetch user info');
                    }

                    const data = await res.json();
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Refresh auth context
                    await login();

                    toast.success('Welcome!', {
                        description: 'Successfully signed in with Google'
                    });

                    // Clear hash and redirect
                    window.location.hash = '';
                    router.push('/dashboard');
                } catch (error: any) {
                    console.error('OAuth callback error:', error);
                    toast.error('Authentication Error', {
                        description: error.message || 'Failed to complete sign in'
                    });
                    setIsLoading(false);
                }
            }
        };

        handleOAuthCallback();
    }, [router, login]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include',
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            // Save token to localStorage for fallback auth
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
            }

            // Sync Auth State (Fetch user using the new token)
            await login();

            // Success
            toast.success("Welcome back!", { description: "Logged in successfully" });
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
            toast.error("Login failed", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/google`);

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.msg || errorData.error || 'Google sign-in is not available');
            }

            const data = await res.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No redirect URL received from server');
            }
        } catch (err: any) {
            console.error('Google login error:', err);
            toast.error('Google Sign-In Unavailable', {
                description: 'Google authentication is not configured. Please use email and password to sign in.'
            });
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
            <Card className="w-full max-w-md border-0 shadow-xl dark:bg-gray-900/50 backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Sign in to Storive</CardTitle>
                    <CardDescription>
                        Enter your email below to access your files
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid grid-cols-1 gap-2">
                        <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>
                    <form onSubmit={handleLogin}>
                        <div className="grid gap-2">
                            <div className="grid gap-1">
                                <Input
                                    id="email"
                                    placeholder="name@example.com"
                                    type="email"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoCorrect="off"
                                    disabled={isLoading}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-1">
                                <Input
                                    id="password"
                                    placeholder="Password"
                                    type="password"
                                    disabled={isLoading}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <div className="flex items-center justify-end">
                                <Link href="/forgot-password" title="Forgot password" className="text-sm text-primary hover:underline">Forgot password?</Link>
                            </div>
                            <Button disabled={isLoading}>
                                {isLoading && (
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                                )}
                                Sign In
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter>
                    <p className="text-center text-sm text-muted-foreground w-full">
                        Don't have an account?{" "}
                        <Link href="/register" className="underline hover:text-primary">
                            Sign up
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
