'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface BreadcrumbItem {
    id: string;
    name: string;
}

interface DriveContextType {
    refreshKey: number;
    refreshDrive: () => void;
    breadcrumbs: BreadcrumbItem[];
    setBreadcrumbs: (items: BreadcrumbItem[]) => void;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export function DriveProvider({ children }: { children: React.ReactNode }) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

    const refreshDrive = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    return (
        <DriveContext.Provider value={{ refreshKey, refreshDrive, breadcrumbs, setBreadcrumbs }}>
            {children}
        </DriveContext.Provider>
    );
}

export function useDrive() {
    const context = useContext(DriveContext);
    if (context === undefined) {
        throw new Error('useDrive must be used within a DriveProvider');
    }
    return context;
}
