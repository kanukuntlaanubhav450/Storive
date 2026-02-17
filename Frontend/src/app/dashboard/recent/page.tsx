'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { File, Clock } from 'lucide-react';
import { useDrive } from '@/hooks/useDrive';
import { FilePreviewModal } from '@/components/drive/FilePreviewModal';
import { toast } from 'sonner';

export default function RecentPage() {
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { refreshKey } = useDrive();
    const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime_type: string; downloadUrl: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.getRecent()
            .then(res => setFiles(res.files))
            .catch(err => toast.error("Failed to load recent files", { description: err.message }))
            .finally(() => setLoading(false));
    }, [refreshKey]);

    const handleFileClick = async (file: any) => {
        let toastId: string | number | undefined;
        try {
            toastId = toast.loading("Loading preview...");
            const { downloadUrl } = await api.getDownloadUrl(file.id);
            setPreviewFile({
                id: file.id,
                name: file.name,
                mime_type: file.mime_type,
                downloadUrl
            });
            setIsPreviewOpen(true);
        } catch (err: any) {
            toast.error("Failed to open file", { description: err.message });
        } finally {
            if (toastId) toast.dismiss(toastId);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
                <Clock className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No recent files</h3>
            </div>
        );
    }

    return (
        <>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Clock className="text-blue-500" /> Recent Files
                </h1>
                <div className="space-y-2">
                    {files.map((file) => (
                        <div
                            key={file.id}
                            className="flex items-center gap-4 p-3 bg-white dark:bg-gray-900 border rounded-lg hover:shadow-sm cursor-pointer transition-all hover:border-primary"
                            onClick={() => handleFileClick(file)}
                        >
                            <File className="w-8 h-8 text-gray-400" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{file.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                    Modified {new Date(file.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-sm text-gray-500">
                                {(file.size_bytes / 1024 / 1024).toFixed(1)} MB
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
            />
        </>
    );
}
