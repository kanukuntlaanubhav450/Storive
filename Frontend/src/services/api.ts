const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';
if (process.env.NODE_ENV === 'development') {
    console.log('API Service initialized with Base URL:', API_BASE_URL);
}

async function request(endpoint: string, options: RequestInit & { signal?: AbortSignal } = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // Ensure cookies are sent
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!res.ok) {
        console.error(`API Error: ${res.status} ${res.statusText} on ${endpoint}`);
        const errorText = await res.text();
        console.error('Error response:', errorText);

        try {
            const error = JSON.parse(errorText);
            throw new Error(error.error || error.message || 'Request failed');
        } catch (e) {
            if (e instanceof SyntaxError) {
                throw new Error(errorText || 'An unknown error occurred');
            }
            throw e;
        }
    }

    // Handle standard empty responses
    if (res.status === 204) return undefined;

    const contentType = res.headers.get('content-type');
    const contentLength = res.headers.get('content-length');

    // If body is empty or not JSON, return early
    if (contentLength === '0' || !contentType || !contentType.includes('application/json')) {
        return undefined;
    }

    try {
        const text = await res.text();
        if (!text) return undefined;
        return JSON.parse(text);
    } catch (e) {
        console.error('API Parse Error: Failed to parse response as JSON', e);
        return undefined;
    }
}

export const api = {
    // Auth
    me: () => request('/auth/me'),
    login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    logout: () => request('/auth/logout', { method: 'POST' }), // If we add logout endpoint

    // OTP-based registration
    sendOTP: (userData: { name: string; email: string; password: string }) =>
        request('/auth/send-otp', { method: 'POST', body: JSON.stringify(userData) }),
    verifyOTP: (data: { email: string; otp: string }) =>
        request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
    resendOTP: (data: { email: string }) =>
        request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),

    // Folders
    getFolder: (id?: string) => request(`/folders${id ? `/${id}` : ''}`),
    createFolder: (name: string, parentId?: string) => request('/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parentId })
    }),
    updateFolder: (id: string, data: any) => request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFolder: (id: string) => request(`/folders/${id}`, { method: 'DELETE' }),
    restoreFolder: (id: string) => request(`/folders/${id}/restore`, { method: 'POST' }),
    permanentDeleteFolder: (id: string) => request(`/folders/${id}/permanent`, { method: 'DELETE' }),
    getFolderDownloadUrl: (id: string) => `${API_BASE_URL}/folders/${id}/download`,
    moveFolder: (id: string, targetFolderId: string | null) => request(`/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ parentId: targetFolderId })
    }),

    // Files
    initUpload: (data: any) => request('/files/upload/init', { method: 'POST', body: JSON.stringify(data) }),
    completeUpload: (data: any) => request('/files/upload/complete', { method: 'POST', body: JSON.stringify(data) }),
    abortUpload: (data: { fileId: string }) => request('/files/upload/abort', { method: 'POST', body: JSON.stringify(data) }),
    deleteFile: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
    restoreFile: (id: string) => request(`/files/${id}/restore`, { method: 'POST' }),
    permanentDeleteFile: (id: string) => request(`/files/${id}/permanent`, { method: 'DELETE' }),
    getDownloadUrl: (id: string) => request(`/files/${id}/download`),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
        request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    updateProfile: (data: { name: string }) =>
        request('/auth/update-profile', { method: 'POST', body: JSON.stringify(data) }),
    moveFile: (id: string, targetFolderId: string | null) => request(`/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ folderId: targetFolderId })
    }),

    // Search
    search: (query: string, signal?: AbortSignal) => request(`/search?q=${encodeURIComponent(query)}`, { signal }),

    // Shares
    shareResource: (resourceType: 'file' | 'folder', resourceId: string, email: string, role: 'viewer' | 'editor') =>
        request('/shares', {
            method: 'POST',
            body: JSON.stringify({ resourceType, resourceId, email, role })
        }),
    getShares: (resourceType: 'file' | 'folder', resourceId: string) =>
        request(`/shares?resourceType=${resourceType}&resourceId=${resourceId}`),
    unshareResource: (resourceType: 'file' | 'folder', resourceId: string, granteeId: string) =>
        request('/shares/revoke', {
            method: 'POST',
            body: JSON.stringify({ resourceType, resourceId, granteeId })
        }),
    createPublicLink: (resourceType: 'file' | 'folder', resourceId: string, expiresInHours?: number) =>
        request('/shares/links', {
            method: 'POST',
            body: JSON.stringify({ resourceType, resourceId, expiresInHours })
        }),
    revokePublicLink: (linkId: string) =>
        request('/shares/links/revoke', {
            method: 'POST',
            body: JSON.stringify({ linkId })
        }),

    // Dashboard
    getRecent: () => request('/dashboard/recent'),
    getStarred: () => request('/dashboard/starred'),
    getTrash: () => request('/dashboard/trash'),
    getShared: () => request('/dashboard/shared'),
    getStorage: (signal?: AbortSignal) => request('/dashboard/storage', { signal }),
    toggleStar: (id: string, type: 'file' | 'folder') => request('/dashboard/star', {
        method: 'POST',
        body: JSON.stringify({ id, type })
    }),
    emptyTrash: () => request('/dashboard/trash/empty', { method: 'DELETE' }),
};
