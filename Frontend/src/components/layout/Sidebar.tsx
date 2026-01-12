'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    HardDrive,
    Clock,
    Star,
    Trash2,
    Cloud,
    Plus,
    Users,
    Settings,
    LogOut
} from 'lucide-react';
import { UploadButton } from '@/components/drive/UploadButton';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();

    // Extract current folder ID from pathname if in /dashboard/files/[id]
    const pathParts = pathname?.split('/');
    // Example: /dashboard/files/123 -> ["", "dashboard", "files", "123"]
    const currentFolderId = (pathParts && pathParts[1] === 'dashboard' && pathParts[2] === 'files') ? pathParts[3] : undefined;

    const routes = [
        {
            label: 'My Drive',
            icon: HardDrive,
            href: '/dashboard/files',
            variant: 'default'
        },
        {
            label: 'Shared with me',
            icon: Users,
            href: '/dashboard/shared',
            variant: 'ghost'
        },
        {
            label: 'Recent',
            icon: Clock,
            href: '/dashboard/recent',
            variant: 'ghost'
        },
        {
            label: 'Starred',
            icon: Star,
            href: '/dashboard/starred',
            variant: 'ghost'
        },
        {
            label: 'Trash',
            icon: Trash2,
            href: '/dashboard/trash',
            variant: 'ghost'
        },
    ];

    return (
        <div className={cn("relative pb-12 min-h-screen border-r bg-gray-50/40 dark:bg-gray-900/40 backdrop-blur-xl w-64 hidden md:block", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xl font-semibold tracking-tight flex items-center gap-2">
                        <Cloud className="w-6 h-6 text-primary" />
                        Storive
                    </h2>
                    <div className="space-y-1 mt-6">
                        <UploadButton
                            folderId={currentFolderId}
                            onRefresh={() => window.location.reload()}
                        />

                        {routes.map((route) => {
                            const Icon = route.icon;
                            return (
                                <Link key={route.href} href={route.href}>
                                    <Button
                                        variant={pathname?.startsWith(route.href) ? 'secondary' : 'ghost'}
                                        className={cn("w-full justify-start", pathname?.startsWith(route.href) && "bg-blue-100/50 text-primary dark:bg-blue-900/20")}
                                    >
                                        <Icon className="mr-2 h-4 w-4" />
                                        {route.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>
                </div>
                <div className="py-2 px-3 mt-auto absolute bottom-0 w-full mb-4">
                    {/* Storage Meter Placeholder */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
                        <div className="flex justify-between text-xs mb-2">
                            <span>Storage</span>
                            <span>75%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700">
                            <div className="h-2 bg-primary rounded-full w-3/4"></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">7.5 GB of 10 GB used</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
