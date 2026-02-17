'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { File, Folder, Trash2, RotateCcw, AlertTriangle, MoreVertical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useDrive } from '@/hooks/useDrive';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { FilePreviewModal } from '@/components/drive/FilePreviewModal';

export default function TrashPage() {
    const [content, setContent] = useState<{ folders: any[], files: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const { refreshKey, refreshDrive } = useDrive();
    const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime_type: string; downloadUrl: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const fetchTrash = () => {
        setLoading(true);
        api.getTrash()
            .then(setContent)
            .catch((err: any) => {
                toast.error("Failed to fetch trash", { description: err.message });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTrash();
    }, [refreshKey]);

    const handleEmptyTrash = async () => {
        if (!confirm('Permanently delete all items in trash? This cannot be undone.')) return;
        try {
            await api.emptyTrash();
            toast.success("Trash emptied");
            refreshDrive();
        } catch (err: any) {
            toast.error("Failed to empty trash", { description: err.message });
        }
    };

    const handleRestore = async (item: any) => {
        try {
            if (item.isFolder) {
                await api.restoreFolder(item.id);
            } else {
                await api.restoreFile(item.id);
            }
            toast.success("Restored successfully");
            refreshDrive();
        } catch (err: any) {
            toast.error("Failed to restore", { description: err.message });
        }
    };

    const handlePermanentDelete = async (item: any) => {
        if (!confirm(`Permanently delete "${item.name}"? This action cannot be undone and will delete the file forever.`)) return;

        try {
            if (item.isFolder) {
                await api.permanentDeleteFolder(item.id);
            } else {
                await api.permanentDeleteFile(item.id);
            }
            toast.success("Permanently deleted");
            refreshDrive();
        } catch (err: any) {
            toast.error("Failed to delete permanently", { description: err.message });
        }
    };

    const handlePreview = async (item: any) => {
        if (item.isFolder) return;

        const toastId = toast.loading("Loading preview...");
        try {
            const { downloadUrl } = await api.getDownloadUrl(item.id);
            setPreviewFile({
                id: item.id,
                name: item.name,
                mime_type: item.mime_type,
                downloadUrl
            });
            setIsPreviewOpen(true);
        } catch (err: any) {
            toast.error("Failed to open file", { description: err.message });
        } finally {
            toast.dismiss(toastId);
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
                <Trash2 className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Trash is empty</h3>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Trash2 className="text-red-500" /> Trash
                </h1>
                <Button variant="destructive" onClick={handleEmptyTrash}>
                    <Trash2 className="w-4 h-4 mr-2" /> Empty Trash
                </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {allItems.map((item) => (
                    <Card
                        key={item.isFolder ? `folder-${item.id}` : `file-${item.id}`}
                        className="group relative border-0 shadow-sm hover:shadow-md transition-all overflow-hidden bg-white dark:bg-gray-900"
                    >
                        <div className="aspect-square flex items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 opacity-60 group-hover:opacity-80 transition-opacity">
                            {item.isFolder ? (
                                <Folder className="h-12 w-12 text-blue-500/60" />
                            ) : (
                                <File className="h-12 w-12 text-gray-400" />
                            )}
                        </div>

                        <div className="p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate opacity-70" title={item.name}>{item.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">
                                    {item.isFolder ? 'Folder' : (item.mime_type?.split('/')[1] || 'File')}
                                </p>
                            </div>

                            <div className="flex items-center gap-1">
                                {/* Restore Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-50 dark:hover:bg-green-900/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(item);
                                    }}
                                >
                                    <RotateCcw className="h-4 w-4 text-green-600" />
                                </Button>

                                {/* More Options */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem className="gap-2 cursor-pointer text-green-600" onClick={(e) => {
                                            e.stopPropagation();
                                            handleRestore(item);
                                        }}>
                                            <RotateCcw className="h-4 w-4" /> Restore
                                        </DropdownMenuItem>
                                        {!item.isFolder && (
                                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreview(item);
                                            }}>
                                                <ExternalLink className="h-4 w-4" />
                                                {item.mime_type?.startsWith('audio/') ? 'Play' :
                                                    item.mime_type?.startsWith('video/') ? 'Play Video' :
                                                        item.mime_type?.startsWith('image/') ? 'View' :
                                                            item.mime_type === 'application/pdf' ? 'View' :
                                                                'Preview'}
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem className="gap-2 cursor-pointer text-red-600" onClick={(e) => {
                                            e.stopPropagation();
                                            handlePermanentDelete(item);
                                        }}>
                                            <Trash2 className="h-4 w-4" /> Delete Forever
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Trash Badge */}
                        <div className="absolute top-2 right-2">
                            <Trash2 className="h-4 w-4 text-red-500/60" />
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
