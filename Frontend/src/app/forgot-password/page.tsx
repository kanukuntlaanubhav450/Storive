'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [retryAfter, setRetryAfter] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            // Handle rate limit error (429) first, regardless of content-type
            if (res.status === 429) {
                let retrySeconds = 60; // Default
                const retryAfterHeader = res.headers.get('Retry-After');

                if (retryAfterHeader) {
                    const parsed = parseInt(retryAfterHeader, 10);
                    if (!isNaN(parsed)) {
                        retrySeconds = parsed;
                    } else {
                        const date = Date.parse(retryAfterHeader);
                        if (!isNaN(date)) {
                            retrySeconds = Math.ceil((date - Date.now()) / 1000);
                        }
                    }
                    if (retrySeconds < 0) retrySeconds = 60;
                } else {
                    // Try to extract from JSON if possible
                    const contentType = res.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        try {
                            const data = await res.json();
                            retrySeconds = data.retryAfter || 60;
                        } catch (e) { /* fallback to default */ }
                    }
                }

                setRetryAfter(retrySeconds);

                // Clear any existing interval before starting a new one
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }

                // Start countdown
                intervalRef.current = setInterval(() => {
                    setRetryAfter((prev) => {
                        if (prev <= 1) {
                            if (intervalRef.current) {
                                clearInterval(intervalRef.current);
                                intervalRef.current = null;
                            }
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);

                throw new Error('Too many attempts. Please wait before trying again.');
            }

            // For other responses, check content-type before parsing
            const contentType = res.headers.get('content-type');
            let data: any = {};
            if (contentType && contentType.includes('application/json')) {
                data = await res.json();
            }

            if (!res.ok) {
                throw new Error(data.error || 'Request failed');
            }

            setMessage(data.message || 'Check your email for a reset link.');
        } catch (err: any) {
            console.error('Forgot password error:', err);

            // Handle different types of errors
            if (err.message === 'Failed to fetch') {
                setError('Unable to connect to server. Please check your internet connection or try again later.');
            } else {
                setError(err.message || 'Failed to send reset link');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
            <Card className="w-full max-w-md border-0 shadow-xl dark:bg-gray-900/50 backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Forgot password</CardTitle>
                    <CardDescription>
                        Enter your email address and we will send you a reset link
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <form onSubmit={handleReset}>
                        <div className="grid gap-2">
                            <div className="grid gap-1">
                                <Input
                                    id="email"
                                    placeholder="name@example.com"
                                    type="email"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    disabled={isLoading}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            {message && <p className="text-sm text-green-500">{message}</p>}
                            {retryAfter > 0 && (
                                <p className="text-sm text-amber-600">
                                    Please wait {retryAfter} second{retryAfter !== 1 ? 's' : ''} before trying again.
                                </p>
                            )}
                            <Button disabled={isLoading || retryAfter > 0}>
                                {isLoading && (
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                                )}
                                {retryAfter > 0 ? `Wait ${retryAfter}s` : 'Send Reset Link'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter>
                    <p className="text-center text-sm text-muted-foreground w-full">
                        Remember your password?{" "}
                        <Link href="/login" className="underline hover:text-primary">
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
