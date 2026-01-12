const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function request(endpoint: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include', // Ensure cookies are sent
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return res.json();
}

export const api = {
    // Auth
    me: () => request('/auth/me'),
    login: (credentials: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    logout: () => request('/auth/logout', { method: 'POST' }), // If we add logout endpoint

    // Folders
    getFolder: (id?: string) => request(`/folders${id ? `/${id}` : ''}`),
    createFolder: (name: string, parentId?: string) => request('/folders', {
        method: 'POST',
        body: JSON.stringify({ name, parent_id: parentId })
    }),
    updateFolder: (id: string, data: any) => request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFolder: (id: string) => request(`/folders/${id}`, { method: 'DELETE' }),

    // Files
    initUpload: (data: any) => request('/files/upload/init', { method: 'POST', body: JSON.stringify(data) }),
    completeUpload: (data: any) => request('/files/upload/complete', { method: 'POST', body: JSON.stringify(data) }),
    deleteFile: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
    getDownloadUrl: (id: string) => request(`/files/${id}/download`),

    // Search
    search: (query: string) => request(`/search?q=${encodeURIComponent(query)}`),

    // Shares
    share: (data: any) => request('/shares', { method: 'POST', body: JSON.stringify(data) }),
};
