'use client';

import { Sidebar } from './Sidebar';
import { SearchBar } from './SearchBar';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DriveProvider } from '@/hooks/useDrive';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';

// This layout will wrap dashboard pages
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading, logout } = useAuth();
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
        <DriveProvider>
            <div className="flex min-h-screen">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-screen">
                    {/* Header will go here */}
                    <header className="h-16 border-b flex items-center px-6 justify-between bg-white/50 backdrop-blur-sm dark:bg-gray-950/50 sticky top-0 z-10">
                        <h1 className="text-lg font-medium">Dashboard</h1>
                        <div className="flex items-center gap-4">
                            <SearchBar />
                            {/* User Avatar with Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        className="w-8 h-8 bg-primary rounded-full text-white flex items-center justify-center text-xs cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                        title={user.name || user.email}
                                    >
                                        {(user.name || user.email)?.charAt(0).toUpperCase()}
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.name || 'User'}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="cursor-pointer">
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Logout</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    <main className="flex-1 p-6 overflow-auto">
                        {children}
                    </main>
                </div>
            </div>
        </DriveProvider>
    );
}
