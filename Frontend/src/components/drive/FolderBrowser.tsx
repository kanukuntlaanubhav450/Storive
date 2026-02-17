'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { HardDrive, File, Folder as FolderIcon, MoreVertical, ExternalLink, Trash2, Download, Star, Share2, Plus } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDrive } from '@/hooks/useDrive';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { DropZone } from './DropZone';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { DraggableItem } from './DraggableItem';
import { DroppableFolder } from './DroppableFolder';
import { FilePreviewModal } from './FilePreviewModal';
import { ShareDialog } from './ShareDialog';
import { SortDropdown } from './SortDropdown';
import { filterItems, sortItems, SortOption } from '@/lib/fileUtils';

export interface FolderContent {
    id: string;
    name: string;
    parent_id: string | null;
    folders: any[];
    files: any[];
}

export function FolderBrowser({ folderId, viewMode = 'grid' }: { folderId?: string; viewMode?: 'grid' | 'list' }) {
    const [content, setContent] = useState<FolderContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();
    const { refreshKey, refreshDrive, setBreadcrumbs } = useDrive();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime_type: string; downloadUrl: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [shareResource, setShareResource] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null);
    const [isShareOpen, setIsShareOpen] = useState(false);

    // Sort state
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // 5px movement required to start drag
            },
        })
    );

    const fetchContent = async () => {
        setLoading(true);
        setError(''); // Clear previous error
        try {
            const data = await api.getFolder(folderId || 'root');
            // ... crumbs and content update ...
            const crumbs = [...(data.ancestors || [])];
            if (data.folder) {
                crumbs.push(data.folder);
            }
            setBreadcrumbs(crumbs);

            setContent({
                id: data.folder?.id || 'root',
                name: data.folder?.name || 'My Drive',
                parent_id: data.folder?.parent_id || null,
                folders: data.children.folders,
                files: data.children.files
            });
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Failed to load folder");
            toast.error("Failed to load folder");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, [folderId, refreshKey]);

    const handleFolderClick = (id: string) => {
        router.push(`/dashboard/files/${id}`);
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
            refreshDrive(); // Refresh globally so Trash page updates + Storage meter
        } catch (err: any) {
            toast.error("Delete failed", { description: err.message });
        }
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        // Find the dragged item and target
        const draggedItem = allItems.find(item => item.id === active.id);
        const targetItem = allItems.find(item => item.id === over.id);

        // Validate: target must be a folder
        if (!targetItem?.isFolder) {
            toast.error("Can only drop into folders");
            return;
        }

        // Prevent dropping folder into itself
        if (draggedItem?.isFolder && draggedItem.id === targetItem.id) {
            toast.error("Cannot move folder into itself");
            return;
        }

        try {
            if (draggedItem?.isFolder) {
                await api.moveFolder(active.id as string, over.id as string);
            } else {
                await api.moveFile(active.id as string, over.id as string);
            }
            toast.success(`Moved to ${targetItem.name}`);
            refreshDrive();
        } catch (err: any) {
            toast.error("Move failed", { description: err.message });
        }
    };

    // File upload handler
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddFilesClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const currentFolderId = folderId === 'root' ? undefined : folderId;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const toastId = toast.loading(`Uploading ${file.name}...`);

            try {
                // 1. Initialize upload
                const initData = await api.initUpload({
                    name: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type,
                    folderId: currentFolderId
                });

                // 2. Upload to storage
                const uploadRes = await fetch(initData.uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type }
                });

                if (!uploadRes.ok) throw new Error('Storage upload failed');

                // 3. Complete upload
                await api.completeUpload({ fileId: initData.fileId });

                toast.success(`${file.name} uploaded`, { id: toastId });
            } catch (error: any) {
                console.error('Upload failed:', error);
                toast.error(`Failed to upload ${file.name}`, {
                    id: toastId,
                    description: error.message
                });
            }
        }

        // Reset input and refresh
        e.target.value = '';
        refreshDrive();
    };

    // Combine folders and files, then sort with useMemo for performance
    // IMPORTANT: This must be before early returns to maintain hook order
    const allItems = useMemo(() => {
        if (!content) return [];
        const rawItems = [
            ...(content?.folders || []).map(f => ({ ...f, isFolder: true })),
            ...(content?.files || []).map(f => ({ ...f, isFolder: false }))
        ];
        return sortItems(rawItems, sortBy);
    }, [content?.folders, content?.files, sortBy]);

    if (loading) return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>)}
    </div>;

    if (error) return <div className="text-red-500 p-4 bg-red-50 rounded-lg">Error: {error}</div>;

    const handleDownload = async (item: any) => {
        if (item.isFolder) {
            // Trigger direct browser download from backend endpoint
            const downloadUrl = api.getFolderDownloadUrl(item.id);
            window.open(downloadUrl, '_blank');
            return;
        }

        let toastId: any;
        try {
            toastId = toast.loading(`Preparing download for ${item.name}...`);
            const { downloadUrl, name } = await api.getDownloadUrl(item.id);

            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = name; // Attribute suggested filename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.dismiss(toastId);
            toast.success("Download started");
        } catch (err: any) {
            console.error("Download Error", err);
            if (toastId) toast.dismiss(toastId);
            toast.error("Download failed", { description: err.message });
        }
    };

    const handleOpen = async (item: any) => {
        if (item.isFolder) {
            handleFolderClick(item.id);
        } else {
            // For files, open preview modal
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

    const handleStar = async (item: any) => {
        try {
            await api.toggleStar(item.id, item.isFolder ? 'folder' : 'file');
            toast.success(item.is_starred ? "Removed from Starred" : "Added to Starred");
            refreshDrive(); // Refresh globally so Starred page updates too
        } catch (err: any) {
            toast.error("Failed to update star", { description: err.message });
        }
    };

    return (
        <DropZone folderId={folderId}>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-4">
                    {/* Sort and Upload Controls */}
                    <div className="flex justify-end gap-2">
                        <SortDropdown
                            sortBy={sortBy}
                            onSortChange={setSortBy}
                        />
                        {/* Show Add Files button only inside folders, not in root */}
                        {folderId && folderId !== 'root' && (
                            <>
                                <Button
                                    onClick={handleAddFilesClick}
                                    className="gap-2 bg-primary hover:bg-primary/90"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Files
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </>
                        )}
                    </div>

                    {allItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl">
                            <HardDrive className="h-12 w-12 mb-4 opacity-20" />
                            <p>This folder is empty</p>
                            <p className="text-sm mt-2">Drag and drop files here or use the + New button</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="space-y-2">
                            {allItems.map((item) => {
                                const cardContent = (
                                    <Card
                                        key={item.id}
                                        className="group relative border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden bg-white dark:bg-gray-900"
                                    >
                                        <div className="flex items-center gap-4 p-4">
                                            {/* Icon */}
                                            <div
                                                className="flex-shrink-0"
                                                onClick={() => item.isFolder ? handleFolderClick(item.id) : null}
                                            >
                                                {item.isFolder ? (
                                                    <FolderIcon className="h-10 w-10 text-blue-500/60" />
                                                ) : (
                                                    <File className="h-10 w-10 text-gray-400" />
                                                )}
                                            </div>

                                            {/* Name and Type */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.isFolder ? 'Folder' : (item.mime_type?.split('/')[1]?.toUpperCase() || 'File')}
                                                </p>
                                            </div>

                                            {/* Size */}
                                            {!item.isFolder && (
                                                <div className="text-sm text-muted-foreground hidden sm:block">
                                                    {((item.size || 0) / 1024 / 1024).toFixed(2)} MB
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStar(item);
                                                    }}
                                                >
                                                    <Star className={cn("h-4 w-4", item.is_starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} />
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {!item.isFolder && (
                                                            <DropdownMenuItem onClick={() => handleOpen(item)}>
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Open
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => {
                                                            setShareResource({ id: item.id, name: item.name, type: item.isFolder ? 'folder' : 'file' });
                                                            setIsShareOpen(true);
                                                        }}>
                                                            <Share2 className="mr-2 h-4 w-4" />
                                                            Share
                                                        </DropdownMenuItem>
                                                        {!item.isFolder && (
                                                            <DropdownMenuItem onClick={() => handleDownload(item)}>
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => handleDelete(item)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </Card>
                                );

                                // Wrap folders with both Droppable and Draggable (same as grid view)
                                if (item.isFolder) {
                                    return (
                                        <DroppableFolder key={item.id} id={item.id}>
                                            <DraggableItem id={item.id} type="folder" data={item}>
                                                {cardContent}
                                            </DraggableItem>
                                        </DroppableFolder>
                                    );
                                }

                                // Wrap files with only Draggable (same as grid view)
                                return (
                                    <DraggableItem key={item.id} id={item.id} type="file" data={item}>
                                        {cardContent}
                                    </DraggableItem>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {allItems.map((item) => {
                                const cardContent = (
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
                                                    <Star className={cn("h-4 w-4", item.is_starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} />
                                                </Button>

                                                {/* Share Button */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShareResource({ id: item.id, name: item.name, type: item.isFolder ? 'folder' : 'file' });
                                                        setIsShareOpen(true);
                                                    }}
                                                >
                                                    <Share2 className="h-4 w-4 text-gray-400 hover:text-blue-500" />
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

                                                {/* More Options Dropdown */}
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
                                                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStar(item);
                                                        }}>
                                                            <Star className={cn("h-4 w-4", item.is_starred ? "fill-yellow-400 text-yellow-400" : "")} />
                                                            {item.is_starred ? "Unstar" : "Star"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShareResource({ id: item.id, name: item.name, type: item.isFolder ? 'folder' : 'file' });
                                                            setIsShareOpen(true);
                                                        }}>
                                                            <Share2 className="h-4 w-4" /> Share
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-500 gap-2 cursor-pointer" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(item);
                                                        }}>
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        {item.is_starred && (
                                            <div className="absolute top-2 right-2">
                                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                            </div>
                                        )}
                                    </Card>
                                );

                                // Wrap folders with both Droppable and Draggable
                                if (item.isFolder) {
                                    return (
                                        <DroppableFolder key={item.id} id={item.id}>
                                            <DraggableItem id={item.id} type="folder" data={item}>
                                                {cardContent}
                                            </DraggableItem>
                                        </DroppableFolder>
                                    );
                                }

                                // Wrap files with only Draggable
                                return (
                                    <DraggableItem key={item.id} id={item.id} type="file" data={item}>
                                        {cardContent}
                                    </DraggableItem>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Drag Overlay - shows ghost of dragged item */}
                <DragOverlay>
                    {activeId ? (
                        <Card className="opacity-80 rotate-3 shadow-2xl">
                            <div className="aspect-square flex items-center justify-center bg-gray-50/50">
                                {allItems.find(i => i.id === activeId)?.isFolder ? (
                                    <FolderIcon className="h-12 w-12 text-blue-500/60" />
                                ) : (
                                    <File className="h-12 w-12 text-gray-400" />
                                )}
                            </div>
                            <div className="p-3">
                                <p className="text-sm font-medium truncate">
                                    {allItems.find(i => i.id === activeId)?.name}
                                </p>
                            </div>
                        </Card>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
            />

            {/* Share Dialog */}
            <ShareDialog
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                resource={shareResource}
            />
        </DropZone>

    );
}
