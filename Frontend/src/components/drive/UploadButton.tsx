'use client';

import { useState } from 'react';
import { Plus, FolderPlus, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { CreateFolderDialog } from './CreateFolderDialog';

export function UploadButton({ folderId, onRefresh }: { folderId?: string, onRefresh: () => void }) {
    const [showFolderDialog, setShowFolderDialog] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // TODO: Implement actual upload logic via api.initUpload/completeUpload
        console.log('Uploading file:', file.name);
        alert('File upload (multipart) will be connected in next step.');
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
                    <DropdownMenuItem className="gap-2 py-2 cursor-pointer relative">
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
                        setShowFolderDialog(false);
                        onRefresh();
                    }}
                    onCancel={() => setShowFolderDialog(false)}
                />
            )}
        </>
    );
}
