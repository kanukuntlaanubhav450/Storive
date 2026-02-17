'use client';

import { ArrowUpDown, ArrowUp, ArrowDown, Calendar, FileText, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SortOption } from '@/lib/fileUtils';

interface SortDropdownProps {
    sortBy: SortOption;
    onSortChange: (sortBy: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <ArrowUp className="h-4 w-4" /> },
    { value: 'name-desc', label: 'Name (Z-A)', icon: <ArrowDown className="h-4 w-4" /> },
    { value: 'size-asc', label: 'Size (Smallest)', icon: <HardDrive className="h-4 w-4" /> },
    { value: 'size-desc', label: 'Size (Largest)', icon: <HardDrive className="h-4 w-4" /> },
    { value: 'date-asc', label: 'Date (Oldest)', icon: <Calendar className="h-4 w-4" /> },
    { value: 'date-desc', label: 'Date (Newest)', icon: <Calendar className="h-4 w-4" /> },
];

export function SortDropdown({ sortBy, onSortChange }: SortDropdownProps) {
    const currentSort = sortOptions.find(opt => opt.value === sortBy);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Sort: {currentSort?.label.split(' ')[0]}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm font-semibold">Sort by</div>
                <DropdownMenuSeparator />

                {/* Name sorting */}
                <div className="px-2 py-1 text-xs text-muted-foreground">Name</div>
                <DropdownMenuItem
                    onClick={() => onSortChange('name-asc')}
                    className={sortBy === 'name-asc' ? 'bg-accent' : ''}
                >
                    <FileText className="h-4 w-4 mr-2" />
                    A to Z
                    {sortBy === 'name-asc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => onSortChange('name-desc')}
                    className={sortBy === 'name-desc' ? 'bg-accent' : ''}
                >
                    <FileText className="h-4 w-4 mr-2" />
                    Z to A
                    {sortBy === 'name-desc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Size sorting */}
                <div className="px-2 py-1 text-xs text-muted-foreground">Size</div>
                <DropdownMenuItem
                    onClick={() => onSortChange('size-asc')}
                    className={sortBy === 'size-asc' ? 'bg-accent' : ''}
                >
                    <HardDrive className="h-4 w-4 mr-2" />
                    Smallest first
                    {sortBy === 'size-asc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => onSortChange('size-desc')}
                    className={sortBy === 'size-desc' ? 'bg-accent' : ''}
                >
                    <HardDrive className="h-4 w-4 mr-2" />
                    Largest first
                    {sortBy === 'size-desc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Date sorting */}
                <div className="px-2 py-1 text-xs text-muted-foreground">Date Modified</div>
                <DropdownMenuItem
                    onClick={() => onSortChange('date-desc')}
                    className={sortBy === 'date-desc' ? 'bg-accent' : ''}
                >
                    <Calendar className="h-4 w-4 mr-2" />
                    Newest first
                    {sortBy === 'date-desc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => onSortChange('date-asc')}
                    className={sortBy === 'date-asc' ? 'bg-accent' : ''}
                >
                    <Calendar className="h-4 w-4 mr-2" />
                    Oldest first
                    {sortBy === 'date-asc' && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
