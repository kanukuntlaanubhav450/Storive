'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { useDrive } from '@/hooks/useDrive';
import { useAuth } from '@/hooks/useAuth';

export function StorageUsage() {
    const [usage, setUsage] = useState({ totalBytes: 0, limit: 10 * 1024 * 1024 * 1024 }); // Default 10GB
    const [loading, setLoading] = useState(true);
    const { refreshKey } = useDrive();
    const { user } = useAuth();

    useEffect(() => {
        const controller = new AbortController();

        const fetchStorage = async () => {
            // Only fetch if user is logged in
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const data = await api.getStorage(controller.signal);
                setUsage(data);
            } catch (error: any) {
                if (error.name === 'AbortError') return;
                console.error('Failed to fetch storage', error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchStorage();

        return () => {
            controller.abort();
        };
    }, [refreshKey, user]);

    const formatSize = (bytes: number) => {
        if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '0 B';
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const percentage = usage.limit > 0 ? Math.min((usage.totalBytes / usage.limit) * 100, 100) : 0;

    if (loading) return <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />;

    return (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between text-xs mb-2">
                <span className="font-medium">Storage</span>
                <span className={cn(percentage > 90 ? "text-red-500" : "")}>{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full dark:bg-gray-700 overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all duration-500", percentage > 90 ? "bg-red-500" : "bg-primary")}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                {formatSize(usage.totalBytes)} of {formatSize(usage.limit)} used
            </p>
        </div>
    );
}
