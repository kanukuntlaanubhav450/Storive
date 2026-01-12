'use client';

import { useState, useEffect } from 'react';
import { HardDrive, File, Folder as FolderIcon, MoreVertical, ExternalLink, Trash2, Download } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

interface FolderContent {
    id: string;
    name: string;
    parent_id: string | null;
    folders: any[];
    files: any[];
}

export function FolderBrowser({ folderId }: { folderId?: string }) {
    const [content, setContent] = useState<FolderContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    const fetchContent = async () => {
        setLoading(true);
        try {
            const data = await api.getFolder(folderId);
            setContent(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, [folderId]);

    const handleFolderClick = (id: string) => {
        router.push(`/dashboard/files/${id}`);
    };

    if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl"></div>)}
    </div>;

    if (error) return <div className="text-red-500 p-4 bg-red-50 rounded-lg">Error: {error}</div>;

    const allItems = [
        ...(content?.folders || []).map(f => ({ ...f, isFolder: true })),
        ...(content?.files || []).map(f => ({ ...f, isFolder: false }))
    ];

    return (
        <div className="space-y-4">
            {allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl">
                    <HardDrive className="h-12 w-12 mb-4 opacity-20" />
                    <p>This folder is empty</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {allItems.map((item) => (
                        <Card
                            key={item.id}
                            className="group relative border-0 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-900"
                        >
                            <div
                                className="aspect-square flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 group-hover:bg-primary/5 transition-colors"
                                onClick={() => item.isFolder ? handleFolderClick(item.id) : null}
                            >
                                {item.isFolder ? (
                                    <FolderIcon className="h-12 w-12 text-blue-500/60 group-hover:scale-105 transition-transform" />
                                ) : (
                                    <File className="h-12 w-12 text-gray-400 group-hover:scale-105 transition-transform" />
                                )}
                            </div>

                            <div className="p-3 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">
                                        {item.isFolder ? 'Folder' : (item.mime_type?.split('/')[1] || 'File')}
                                    </p>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem className="gap-2">
                                            <ExternalLink className="h-4 w-4" /> Open
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2">
                                            <Download className="h-4 w-4" /> Download
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-500 gap-2">
                                            <Trash2 className="h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
