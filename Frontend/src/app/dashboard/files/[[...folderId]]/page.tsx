'use client';

import { use, useState, useEffect } from 'react';
import { FolderBrowser } from '@/components/drive/FolderBrowser';
import { Grid, List, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useDrive } from '@/hooks/useDrive';

export default function MyFilesPage({
    params
}: {
    params: Promise<{ folderId?: string[] }>
}) {
    const resolvedParams = use(params);
    const folderId = resolvedParams.folderId ? resolvedParams.folderId[0] : undefined;
    const { breadcrumbs } = useDrive();

    // Initialize view mode to 'grid' to avoid hydration mismatch
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => 'grid');

    // Load view mode from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fileViewMode');
            if (saved === 'grid' || saved === 'list') {
                setViewMode(saved);
            }
        }
    }, []);

    // Save view mode to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('fileViewMode', viewMode);
    }, [viewMode]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'My Drive'}
                    </h1>
                    {/* Breadcrumbs */}
                    <nav className="flex items-center text-sm text-muted-foreground gap-1">
                        <Link href="/dashboard/files" className="hover:text-primary flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            Root
                        </Link>
                        {breadcrumbs.map((crumb) => (
                            <div key={crumb.id} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                <Link href={`/dashboard/files/${crumb.id}`} className="hover:text-primary">
                                    {crumb.name}
                                </Link>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="icon"
                        title="Grid View"
                        onClick={() => setViewMode('grid')}
                    >
                        <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="icon"
                        title="List View"
                        onClick={() => setViewMode('list')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <FolderBrowser folderId={folderId} viewMode={viewMode} />
        </div>
    );
}
