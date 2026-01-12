'use client';

import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This layout will wrap dashboard pages
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) return null;

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Header will go here */}
                <header className="h-16 border-b flex items-center px-6 justify-between bg-white/50 backdrop-blur-sm dark:bg-gray-950/50 sticky top-0 z-10">
                    <h1 className="text-lg font-medium">Dashboard</h1>
                    <div className="flex items-center gap-4">
                        {/* Search Bar Placeholder */}
                        <div className="w-64 h-9 bg-gray-100 rounded-md dark:bg-gray-800"></div>
                        {/* User Avatar Placeholder */}
                        <div className="w-8 h-8 bg-primary rounded-full text-white flex items-center justify-center text-xs">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
