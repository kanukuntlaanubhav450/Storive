// Utility functions for file operations

export type SortOption = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'date-asc' | 'date-desc';

export interface FileItem {
    id: string;
    name: string;
    size?: number;
    updated_at?: string;
    created_at?: string;
    mime_type?: string;
    isFolder?: boolean;
    is_starred?: boolean;
    owner_id?: string;
    parent_id?: string | null;
}

/**
 * Filter items by search query
 */
export function filterItems(items: FileItem[], query: string): FileItem[] {
    if (!query.trim()) return items;

    const lowerQuery = query.toLowerCase().trim();

    return items.filter(item =>
        item.name.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Sort items by specified option
 */
export function sortItems(items: FileItem[], sortBy: SortOption): FileItem[] {
    const sorted = [...items];

    // Always keep folders first
    const folders = sorted.filter(item => item.isFolder);
    const files = sorted.filter(item => !item.isFolder);

    const sortFn = (a: FileItem, b: FileItem) => {
        switch (sortBy) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'size-asc':
                return (a.size || 0) - (b.size || 0);
            case 'size-desc':
                return (b.size || 0) - (a.size || 0);
            case 'date-asc':
                return new Date(a.updated_at || a.created_at || 0).getTime() -
                    new Date(b.updated_at || b.created_at || 0).getTime();
            case 'date-desc':
                return new Date(b.updated_at || b.created_at || 0).getTime() -
                    new Date(a.updated_at || a.created_at || 0).getTime();
            default:
                return 0;
        }
    };

    folders.sort(sortFn);
    files.sort(sortFn);

    return [...folders, ...files];
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const absBytes = Math.abs(bytes);
    const sign = bytes < 0 ? '-' : '';

    let i = Math.floor(Math.log(absBytes) / Math.log(k));
    i = Math.max(0, Math.min(i, sizes.length - 1));

    const value = Math.round((absBytes / Math.pow(k, i)) * 100) / 100;
    return `${sign}${value} ${sizes[i]}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get file icon based on mime type
 */
export function getFileIcon(mimeType?: string): string {
    if (!mimeType) return '📄';

    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return '📦';

    return '📄';
}
