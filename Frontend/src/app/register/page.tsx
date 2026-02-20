'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [resendDisabled, setResendDisabled] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const router = useRouter();
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setResendDisabled(false);
        }
    }, [countdown]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Send OTP to user's email
            const response = await api.sendOTP({ name, email, password });

            // Debug Helper
            if (response.debug_otp) {
                console.log('%c🔐 DEBUG OTP CODE: ' + response.debug_otp, 'background: #222; color: #bada55; font-size: 20px; padding: 10px;');
            }

            // Show OTP modal
            setShowOTPModal(true);
            setResendDisabled(true);
            setCountdown(60); // 60 second cooldown for resend
            toast.success("OTP Sent!", { description: `Check ${email} for your code.` });
        } catch (err: any) {
            setError(err.message);
            toast.error("Failed to register", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOTPChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d+$/.test(value)) return;

        const newOtp = [...otp];

        // Handle paste of full OTP
        if (value.length > 1) {
            const digits = value.slice(0, 6).split('');
            digits.forEach((digit, i) => {
                if (i < 6) newOtp[i] = digit;
            });
            setOtp(newOtp);
            // Focus last filled input or last input
            const lastIndex = Math.min(digits.length - 1, 5);
            otpInputRefs.current[lastIndex]?.focus();
            return;
        }

        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = async () => {
        const otpCode = otp.join('');
        if (otpCode.length !== 6) {
            setError('Please enter the complete 6-digit OTP');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await api.verifyOTP({ email, otp: otpCode });

            // Success! Go directly to dashboard — session is carried via HttpOnly cookie
            toast.success("Account created successfully!", { description: "Welcome to Storive!" });
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message);
            toast.error("Verification failed", { description: err.message });
            // Clear OTP on error
            setOtp(['', '', '', '', '', '']);
            otpInputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }

    };

    const handleResendOTP = async () => {
        if (resendDisabled) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await api.resendOTP({ email });

            if (response.debug_otp) {
                console.log('%c🔐 DEBUG OTP CODE: ' + response.debug_otp, 'background: #222; color: #bada55; font-size: 20px; padding: 10px;');
            }
            setResendDisabled(true);
            setCountdown(60);
            // Clear existing OTP
            setOtp(['', '', '', '', '', '']);
            toast.success("Code resent", { description: "Check your email inbox." });
        } catch (err: any) {
            setError(err.message);
            toast.error("Failed to resend code", { description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    // OTP Verification Modal
    if (showOTPModal) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
                <Card className="w-full max-w-md border-0 shadow-xl dark:bg-gray-900/50 backdrop-blur-md">
                    <CardHeader className="space-y-4 text-center">
                        <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="16" x="2" y="4" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>
                        <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
                        <CardDescription className="text-base">
                            We&apos;ve sent a 6-digit code to<br />
                            <span className="font-medium text-foreground">{email}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="text-sm text-muted-foreground text-center">
                            Enter the verification code to complete your registration
                        </p>

                        {/* OTP Input Fields */}
                        <div className="flex justify-center gap-2">
                            {otp.map((digit, index) => (
                                <Input
                                    key={index}
                                    ref={(el) => { otpInputRefs.current[index] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={digit}
                                    onChange={(e) => handleOTPChange(index, e.target.value)}
                                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                                    className="w-12 h-14 text-center text-2xl font-bold"
                                    disabled={isLoading}
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>

                        {error && (
                            <p className="text-sm text-red-500 text-center">{error}</p>
                        )}

                        <Button
                            onClick={handleVerifyOTP}
                            disabled={isLoading || otp.join('').length !== 6}
                            className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        >
                            {isLoading ? (
                                <>
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                                    Verifying...
                                </>
                            ) : (
                                'Verify & Create Account'
                            )}
                        </Button>

                        <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Didn&apos;t receive the code?
                            </p>
                            <Button
                                variant="ghost"
                                onClick={handleResendOTP}
                                disabled={resendDisabled || isLoading}
                                className="text-sm"
                            >
                                {resendDisabled ? (
                                    `Resend in ${countdown}s`
                                ) : (
                                    'Resend Code'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button
                            variant="link"
                            onClick={() => {
                                setShowOTPModal(false);
                                setOtp(['', '', '', '', '', '']);
                                setError('');
                            }}
                            className="text-muted-foreground"
                        >
                            ← Back to registration
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Registration Form
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-950">
            <Card className="w-full max-w-md border-0 shadow-xl dark:bg-gray-900/50 backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
                    <CardDescription>
                        Enter your details below to create your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <form onSubmit={handleRegister}>
                        <div className="grid gap-3">
                            <div className="grid gap-1">
                                <Input
                                    id="name"
                                    placeholder="Full Name"
                                    type="text"
                                    autoCapitalize="words"
                                    autoComplete="name"
                                    disabled={isLoading}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
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
                                    required
                                />
                            </div>
                            <div className="grid gap-1">
                                <Input
                                    id="password"
                                    placeholder="Password (min 6 characters)"
                                    type="password"
                                    disabled={isLoading}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <Button disabled={isLoading} className="h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                                {isLoading && (
                                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                                )}
                                Sign Up
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter>
                    <p className="text-center text-sm text-muted-foreground w-full">
                        Already have an account?{" "}
                        <Link href="/login" className="underline hover:text-primary">
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
