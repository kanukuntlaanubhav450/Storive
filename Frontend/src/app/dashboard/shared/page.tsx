'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card } from '@/components/ui/card';
import { FolderBrowser, FolderContent } from '@/components/drive/FolderBrowser';
import { Users, File, Folder as FolderIcon } from 'lucide-react';
import { useDrive } from '@/hooks/useDrive';
import { useRouter } from 'next/navigation';
import { FilePreviewModal } from '@/components/drive/FilePreviewModal';
import { toast } from 'sonner';

export default function SharedPage() {
    const [content, setContent] = useState<FolderContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { refreshKey } = useDrive();
    const router = useRouter();
    const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mime_type: string; downloadUrl: string } | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(null);
        api.getShared()
            .then(data => {
                setContent({
                    id: 'shared',
                    name: 'Shared with me',
                    parent_id: '',
                    folders: data.folders,
                    files: data.files
                });
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
                toast.error("Failed to load shared items", { description: err.message });
            })
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

    if (loading) return (
        <div className="p-6">
            <div className="h-8 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                ))}
            </div>
        </div>
    );

    // Use FolderBrowser logic or custom view? 
    // FolderBrowser is coupled with 'fetching' by ID in its useEffect.
    // We should probably just render the items here similarly to Starred/Trash for simplicity, 
    // unless we refactor FolderBrowser to accept 'initialContent'.
    // Given the time, let's copy the render logic for now or implement a simple view.
    // Actually, reusing the Card grid is simple enough.

    const allItems = [
        ...(content?.folders || []).map(f => ({ ...f, isFolder: true })),
        ...(content?.files || []).map(f => ({ ...f, isFolder: false }))
    ];

    if (allItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium">No shared items</h3>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Users className="text-blue-500" /> Shared with me
            </h1>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-2">
                    <Users className="h-5 w-5 rotate-45" />
                    <span>{error}</span>
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {allItems.map((item) => (
                    <Card
                        key={item.id}
                        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors hover:border-primary"
                        onClick={() => item.isFolder ? router.push(`/dashboard/files/${item.id}`) : handleFileClick(item)}
                    >
                        <div className="flex flex-col items-center gap-2">
                            {item.isFolder ? (
                                <FolderIcon className="w-12 h-12 text-blue-500" />
                            ) : (
                                <File className="w-12 h-12 text-gray-400" />
                            )}
                            <span className="text-sm font-medium truncate w-full text-center">{item.name}</span>
                        </div>
                    </Card>
                ))}
            </div>

            <FilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                file={previewFile}
            />
        </div>
    );
}
