'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, File, Folder as FolderIcon, Star, Trash2, Download, ExternalLink, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDrive } from '@/hooks/useDrive';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { FilePreviewModal } from '@/components/drive/FilePreviewModal';

export default function StarredPage() {
    const [content, setContent] = useState<{ folders: any[], files: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { refreshKey, refreshDrive } = useDrive();
    const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime_type: string; downloadUrl: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const fetchStarred = () => {
        setLoading(true);
        api.getStarred().then(setContent).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchStarred();
    }, [refreshKey]);

    const handleStar = async (item: any) => {
        try {
            await api.toggleStar(item.id, item.isFolder ? 'folder' : 'file');
            toast.success("Removed from Starred");
            refreshDrive();
        } catch (err: any) {
            toast.error("Failed to update star", { description: err.message });
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
            toast.success("Item moved to trash");
            refreshDrive();
        } catch (err: any) {
            toast.error("Delete failed", { description: err.message });
        }
    };

    const handleDownload = async (item: any) => {
        if (item.isFolder) {
            const downloadUrl = api.getFolderDownloadUrl(item.id);
            window.open(downloadUrl, '_blank');
            return;
        }

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
            toast.success("Download started");
        } catch (err: any) {
            if (toastId) toast.dismiss(toastId);
            toast.error("Download failed", { description: err.message });
        }
    };

    const handleOpen = async (item: any) => {
        if (item.isFolder) {
            router.push(`/dashboard/files/${item.id}`);
        } else {
            let toastId: any;
            try {
                toastId = toast.loading("Loading preview...");
                const { downloadUrl } = await api.getDownloadUrl(item.id);
                setPreviewFile({
                    id: item.id,
                    name: item.name,
                    mime_type: item.mime_type,
                    downloadUrl
                });
                setIsPreviewOpen(true);
                toast.dismiss(toastId);
            } catch (err: any) {
                if (toastId) toast.dismiss(toastId);
                toast.error("Failed to open file", { description: err.message });
            }
        }
    };

    if (loading) return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse p-6">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>)}
    </div>;

    const allItems = [
        ...(content?.folders || []).map(f => ({ ...f, isFolder: true })),
        ...(content?.files || []).map(f => ({ ...f, isFolder: false }))
    ];

    if (allItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
                <Star className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No starred items</h3>
                <p>Star important files and folders to access them quickly.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Star className="fill-yellow-400 text-yellow-400" /> Starred
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {allItems.map((item) => (
                    <Card
                        key={item.id}
                        className="group relative border-0 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-900"
                    >
                        <div
                            className="aspect-square flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 group-hover:bg-primary/5 transition-colors"
                            onClick={() => item.isFolder ? router.push(`/dashboard/files/${item.id}`) : null}
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

                            <div className="flex items-center gap-1">
                                {/* Star Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStar(item);
                                    }}
                                >
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                </Button>

                                {/* Delete Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                </Button>

                                {/* More Options */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpen(item);
                                        }}>
                                            <ExternalLink className="h-4 w-4" />
                                            {item.isFolder ? 'Open' :
                                                item.mime_type?.startsWith('audio/') ? 'Play' :
                                                    item.mime_type?.startsWith('video/') ? 'Play Video' :
                                                        item.mime_type?.startsWith('image/') ? 'View' :
                                                            item.mime_type === 'application/pdf' ? 'View' :
                                                                'Open'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(item);
                                        }}>
                                            <Download className="h-4 w-4" /> Download
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Star Badge */}
                        <div className="absolute top-2 right-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        </div>
                    </Card>
                ))}
            </div>

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
            />
        </div>
    );
}
