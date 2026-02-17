'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    File,
    Folder as FolderIcon,
    Search as SearchIcon,
    MoreVertical,
    ExternalLink,
    Download,
    Star,
    Trash2,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilePreviewModal } from '@/components/drive/FilePreviewModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDrive } from '@/hooks/useDrive';

type SearchResults = {
    folders: any[];
    files: any[];
};

export default function SearchPage() {
    const searchParams = useSearchParams();
    const q = searchParams.get('q');
    const [results, setResults] = useState<SearchResults>({ folders: [], files: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { refreshDrive } = useDrive();

    // Preview modal state
    const [previewFile, setPreviewFile] = useState<{
        id: string;
        name: string;
        mime_type: string;
        downloadUrl: string;
    } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        if (!q) {
            setResults({ folders: [], files: [] });
            setError(null);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        api.search(q, controller.signal)
            .then(data => {
                setResults(data);
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                console.error(err);
                setError(err.message);
                toast.error("Search failed", { description: err.message });
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [q]);

    // Open file preview — fetches a signed download URL, then opens the modal
    const handleOpen = async (item: any) => {
        if (item.isFolder) {
            router.push(`/dashboard/files/${item.id}`);
            return;
        }

        let toastId: any;
        try {
            toastId = toast.loading('Loading preview...');
            const { downloadUrl } = await api.getDownloadUrl(item.id);
            setPreviewFile({
                id: item.id,
                name: item.name,
                mime_type: item.mime_type,
                downloadUrl,
            });
            setIsPreviewOpen(true);
            toast.dismiss(toastId);
        } catch (err: any) {
            if (toastId) toast.dismiss(toastId);
            toast.error('Failed to open file', { description: err.message });
        }
    };

    const handleDownload = async (item: any) => {
        let toastId: any;
        try {
            toastId = toast.loading(`Preparing download for ${item.name}...`);
            const { downloadUrl, name } = await api.getDownloadUrl(item.id);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.dismiss(toastId);
            toast.success('Download started');
        } catch (err: any) {
            if (toastId) toast.dismiss(toastId);
            toast.error('Download failed', { description: err.message });
        }
    };

    const handleDelete = async (item: any) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
        try {
            if (item.isFolder) {
                await api.deleteFolder(item.id);
            } else {
                await api.deleteFile(item.id);
            }
            toast.success('Item moved to trash');
            // Re-run the search to refresh results
            if (q) {
                const data = await api.search(q);
                setResults(data);
            }
            refreshDrive();
        } catch (err: any) {
            toast.error('Delete failed', { description: err.message });
        }
    };

    const handleStar = async (item: any) => {
        try {
            await api.toggleStar(item.id, item.isFolder ? 'folder' : 'file');
            toast.success(item.is_starred ? 'Removed from Starred' : 'Added to Starred');
            // Re-run search to refresh star status
            if (q) {
                const data = await api.search(q);
                setResults(data);
            }
            refreshDrive();
        } catch (err: any) {
            toast.error('Failed to update star', { description: err.message });
        }
    };

    // Helper to get a human-readable action label based on mime type
    const getOpenLabel = (item: any): string => {
        if (item.isFolder) return 'Open';
        const mime = item.mime_type || '';
        if (mime.startsWith('audio/')) return 'Play';
        if (mime.startsWith('video/')) return 'Play Video';
        if (mime.startsWith('image/')) return 'View';
        if (mime === 'application/pdf') return 'View';
        return 'Open';
    };

    if (!q) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-500">
                <SearchIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>Enter a keyword to search your files and folders.</p>
            </div>
        );
    }

    const allItems = [
        ...results.folders.map(f => ({ ...f, isFolder: true })),
        ...results.files.map(f => ({ ...f, isFolder: false }))
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <SearchIcon className="text-blue-500" /> Search Results for &quot;{q}&quot;
            </h1>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-2">
                    <Trash2 className="h-5 w-5 rotate-45" />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                    ))}
                </div>
            ) : allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <SearchIcon className="h-12 w-12 mb-4 opacity-20" />
                    <p>No results found for &quot;{q}&quot;</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {allItems.map((item) => (
                        <Card
                            key={item.id}
                            className="group relative border-0 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-900"
                        >
                            {/* Clickable preview area */}
                            <div
                                className="aspect-square flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 group-hover:bg-primary/5 transition-colors"
                                onClick={() => handleOpen(item)}
                            >
                                {item.isFolder ? (
                                    <FolderIcon className="h-12 w-12 text-blue-500/60 group-hover:scale-105 transition-transform" />
                                ) : (
                                    <File className="h-12 w-12 text-gray-400 group-hover:scale-105 transition-transform" />
                                )}
                            </div>

                            {/* File name and actions */}
                            <div className="p-3 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate" title={item.name}>
                                        {item.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">
                                        {item.isFolder
                                            ? 'Folder'
                                            : item.mime_type?.split('/')[1] || 'File'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1">
                                    {/* Star */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStar(item);
                                        }}
                                    >
                                        <Star
                                            className={cn(
                                                'h-4 w-4',
                                                item.is_starred
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-400'
                                            )}
                                        />
                                    </Button>

                                    {/* More Options */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem
                                                className="gap-2 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpen(item);
                                                }}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                {getOpenLabel(item)}
                                            </DropdownMenuItem>
                                            {!item.isFolder && (
                                                <DropdownMenuItem
                                                    className="gap-2 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownload(item);
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" /> Download
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                className="gap-2 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStar(item);
                                                }}
                                            >
                                                <Star
                                                    className={cn(
                                                        'h-4 w-4',
                                                        item.is_starred
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : ''
                                                    )}
                                                />
                                                {item.is_starred ? 'Unstar' : 'Star'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-500 gap-2 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(item);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Star indicator */}
                            {item.is_starred && (
                                <div className="absolute top-2 right-2">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
            />
        </div>
    );
}
