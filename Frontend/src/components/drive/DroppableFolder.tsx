'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableFolderProps {
    id: string;
    children: React.ReactNode;
}

export function DroppableFolder({ id, children }: DroppableFolderProps) {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: { type: 'folder' }
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'transition-all duration-200',
                isOver && 'ring-2 ring-blue-500 ring-offset-2 scale-105'
            )}
        >
            {children}
        </div>
    );
}
