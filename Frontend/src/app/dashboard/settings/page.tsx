'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

export default function SettingsPage() {
    const { user, login } = useAuth();
    const router = useRouter();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isLoading, setIsLoading] = useState(false);

    // Update local state when user changes
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await api.updateProfile({ name });
            // Refresh user context to display updated name
            await login();
            toast.success('Profile updated', { description: 'Your profile has been updated successfully' });
        } catch (error: any) {
            toast.error('Update failed', { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Profile Information
                    </CardTitle>
                    <CardDescription>
                        Update your account profile information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium">Email Address</label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                disabled
                            />
                            <p className="text-xs text-muted-foreground">
                                Email cannot be changed at this time
                            </p>
                        </div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Updating...' : 'Update Profile'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Account Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Account Information
                    </CardTitle>
                    <CardDescription>
                        Your account details
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm font-medium">User ID</span>
                        <span className="text-sm text-muted-foreground">{user?.id}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm font-medium">Email</span>
                        <span className="text-sm text-muted-foreground">{user?.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium">Account Type</span>
                        <span className="text-sm text-muted-foreground">Free</span>
                    </div>
                </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        Security
                    </CardTitle>
                    <CardDescription>
                        Manage your password and security settings
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Change your password to keep your account secure. You&apos;ll need to enter your current password first.
                    </p>
                    <Button variant="outline" onClick={() => router.push('/dashboard/settings/change-password')}>
                        <Lock className="h-4 w-4 mr-2" />
                        Change Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
