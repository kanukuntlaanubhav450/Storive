'use client';

import { useState } from 'react';
import { api } from '@/services/api';
import { Plus, FolderPlus, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { CreateFolderDialog } from './CreateFolderDialog';

export function UploadButton({ folderId, onRefresh }: { folderId?: string, onRefresh: () => void }) {
    const [showFolderDialog, setShowFolderDialog] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const toastId = toast.loading(`Uploading ${file.name}...`);
        let uploadedFileId: string | null = null;

        try {
            // 1. Initialize upload (Get signed URL and create DB entry)
            const initData = await api.initUpload({
                name: file.name,
                sizeBytes: file.size,
                mimeType: file.type,
                folderId: folderId
            });

            uploadedFileId = initData.fileId;

            // 2. Upload to Supabase Storage using signed URL
            const uploadRes = await fetch(initData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            if (!uploadRes.ok) {
                throw new Error('Storage upload failed');
            }

            // 3. Complete upload (Verify and update DB)
            await api.completeUpload({ fileId: initData.fileId });

            toast.success("Upload complete", { id: toastId });
            onRefresh();

        } catch (error: any) {
            console.error('Upload failed:', error);

            // Cleanup orphaned DB record if initialization succeeded but upload failed
            if (uploadedFileId) {
                console.log('Cleaning up orphaned upload:', uploadedFileId);
                try {
                    await api.abortUpload({ fileId: uploadedFileId });
                } catch (cleanupError) {
                    console.error('Cleanup failed:', cleanupError);
                }
            }

            toast.error("Upload failed", {
                id: toastId,
                description: error.message || 'Something went wrong'
            });
        } finally {
            // Reset input
            e.target.value = '';
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="lg" className="w-full justify-start shadow-md bg-primary hover:bg-primary/90 text-white mb-6">
                        <Plus className="mr-2 h-4 w-4" />
                        New
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-2">
                    <DropdownMenuItem
                        className="gap-2 py-2 cursor-pointer"
                        onClick={() => setShowFolderDialog(true)}
                    >
                        <FolderPlus className="h-4 w-4" /> New Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="gap-2 py-2 cursor-pointer relative"
                        onSelect={(e) => e.preventDefault()}
                    >
                        <FileUp className="h-4 w-4" /> File Upload
                        <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                        />
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {showFolderDialog && (
                <CreateFolderDialog
                    parentId={folderId}
                    onSuccess={() => {
                        toast.success("Folder created successfully");
                        setShowFolderDialog(false);
                        onRefresh();
                    }}
                    onCancel={() => setShowFolderDialog(false)}
                />
            )}
        </>
    );
}
