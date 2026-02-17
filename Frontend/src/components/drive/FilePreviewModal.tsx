'use client';

import { useState, useEffect } from 'react';
import { X, Download, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    file: {
        id: string;
        name: string;
        mime_type: string;
        downloadUrl: string;
    } | null;
}

export function FilePreviewModal({ isOpen, onClose, file }: FilePreviewModalProps) {
    const [isMuted, setIsMuted] = useState(false);

    if (!file) return null;

    const getFileType = (mimeType: string): 'audio' | 'video' | 'image' | 'pdf' | 'text' | 'unknown' => {
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.startsWith('text/')) return 'text';
        return 'unknown';
    };

    const fileType = getFileType(file.mime_type);

    const renderPreview = () => {
        // Don't render media if downloadUrl is not available yet
        if (!file.downloadUrl) {
            return (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-pulse text-muted-foreground">Loading preview...</div>
                </div>
            );
        }

        switch (fileType) {
            case 'audio':
                return (
                    <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                        <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                            <Volume2 className="w-16 h-16 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold mb-4 text-center">{file.name}</h3>
                        <audio
                            controls
                            autoPlay
                            className="w-full max-w-md"
                            src={file.downloadUrl}
                        >
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                );

            case 'video':
                return (
                    <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                            controls
                            autoPlay
                            className="w-full max-h-[70vh]"
                            src={file.downloadUrl}
                        >
                            Your browser does not support the video element.
                        </video>
                    </div>
                );

            case 'image':
                return (
                    <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <img
                            src={file.downloadUrl}
                            alt={file.name}
                            className="max-w-full max-h-[70vh] object-contain rounded"
                        />
                    </div>
                );

            case 'pdf':
                return (
                    <iframe
                        src={file.downloadUrl}
                        className="w-full h-[70vh] rounded-lg"
                        title={file.name}
                        sandbox="allow-same-origin"
                    />
                );

            case 'text':
                return (
                    <iframe
                        src={file.downloadUrl}
                        className="w-full h-[70vh] rounded-lg bg-white dark:bg-gray-900"
                        title={file.name}
                        sandbox="allow-same-origin"
                    />
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <Download className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Preview not available</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            This file type cannot be previewed in the browser.
                        </p>
                        <Button asChild>
                            <a href={file.downloadUrl} download={file.name}>
                                <Download className="w-4 h-4 mr-2" />
                                Download File
                            </a>
                        </Button>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="truncate pr-4">{file.name}</span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                asChild
                            >
                                <a href={file.downloadUrl} download={file.name}>
                                    <Download className="h-4 w-4" />
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    {renderPreview()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
