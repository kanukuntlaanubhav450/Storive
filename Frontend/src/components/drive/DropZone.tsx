'use client';

import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDrive } from '@/hooks/useDrive';

interface DropZoneProps {
    children: React.ReactNode;
    folderId?: string;
    className?: string;
}

export function DropZone({ children, folderId, className }: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { refreshDrive } = useDrive();

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if we're leaving the container itself
        const rect = e.currentTarget.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
        ) {
            setIsDragging(false);
        }
    }, []);

    const uploadFile = useCallback(async (file: File) => {
        const toastId = toast.loading(`Uploading ${file.name}...`);

        try {
            // 1. Initialize upload
            const initData = await api.initUpload({
                name: file.name,
                sizeBytes: file.size,
                mimeType: file.type,
                folderId: folderId
            });

            // 2. Upload to Storage
            const uploadRes = await fetch(initData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });

            if (!uploadRes.ok) throw new Error('Storage upload failed');

            // 3. Complete upload
            await api.completeUpload({ fileId: initData.fileId });

            toast.success(`${file.name} uploaded`, { id: toastId });
            return true;
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast.error(`Failed to upload ${file.name}`, {
                id: toastId,
                description: error.message
            });
            return false;
        }
    }, [folderId]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('[DropZone] Drop event triggered');
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        console.log('[DropZone] Files dropped:', files.length);

        if (files.length === 0) {
            console.warn('[DropZone] No files in drop event');
            return;
        }

        setIsUploading(true);

        // Upload files sequentially to avoid overwhelming the server
        for (const file of files) {
            console.log('[DropZone] Uploading:', file.name);
            await uploadFile(file);
        }

        setIsUploading(false);
        refreshDrive();
    }, [uploadFile, refreshDrive]);

    return (
        <div
            className={cn(
                "relative min-h-[400px] transition-all duration-200",
                className
            )}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {children}

            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-3 text-primary">
                        <Upload className="h-16 w-16 animate-bounce" />
                        <p className="text-lg font-medium">Drop files here to upload</p>
                        <p className="text-sm opacity-70">Release to upload to this folder</p>
                    </div>
                </div>
            )}

            {/* Uploading Indicator */}
            {isUploading && !isDragging && (
                <div className="absolute top-4 right-4 z-50 bg-white dark:bg-gray-900 shadow-lg rounded-lg px-4 py-2 flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Uploading...</span>
                </div>
            )}
        </div>
    );
}
