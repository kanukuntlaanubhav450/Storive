'use client';

import { use } from 'react';
import { FolderBrowser } from '@/components/drive/FolderBrowser';
import { Search, Filter, Grid, List, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function MyFilesPage({
    params
}: {
    params: Promise<{ folderId?: string[] }>
}) {
    const resolvedParams = use(params);
    const folderId = resolvedParams.folderId ? resolvedParams.folderId[0] : undefined;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">My Drive</h1>
                    {/* Breadcrumbs */}
                    <nav className="flex items-center text-sm text-muted-foreground gap-1">
                        <Link href="/dashboard/files" className="hover:text-primary flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            Root
                        </Link>
                        {resolvedParams.folderId?.map((id, index) => (
                            <div key={id} className="flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                <Link href={`/dashboard/files/${id}`} className="hover:text-primary">
                                    Folder
                                </Link>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" title="Grid View">
                        <Grid className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" title="List View">
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 bg-white/50 dark:bg-gray-900/50 p-2 rounded-xl border backdrop-blur-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search for files, folders..."
                        className="pl-9 bg-transparent border-none focus-visible:ring-0 w-full"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" className="gap-2 flex-1">
                        <Filter className="h-4 w-4" />
                        Filter
                    </Button>
                </div>
            </div>

            <FolderBrowser folderId={folderId} />
        </div>
    );
}
