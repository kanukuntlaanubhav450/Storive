'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface User {
    id: string;
    email: string;
    name?: string;
    image_url?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>; // Trigger re-fetch
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}` // If using headers
                    // Or rely on cookies if `credentials: 'include'`
                }
            });
            // Note: We are using Cookies for auth, so we need credentials: 'include' in fetch usually.
            // But let's support both. Code below acts as if we fetch 'me'.

            // Actually, for this MVP, let's assume we rely on the httpOnly cookie. 
            // We just hit /api/auth/me to validate session.
        } catch (error) {
            // ignore
        }
    };

    const checkSession = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            // We need to use a proxy or full URL.
            // NEXT_PUBLIC_API_URL is http://localhost:5000/api
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                credentials: 'include',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
                // Can't clear localStorage here blindly as it might be a temporary network error,
                // but if 401/403, we probably should.
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem('access_token');
                }
            }
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, []);

    const logout = useCallback(async () => {
        try {
            // Call backend to clear cookie
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            // Clear local state
            localStorage.removeItem('access_token');
            setUser(null);
            toast.success("Logged out", { description: "See you next time!" });
            router.push('/login');
        }
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, loading, login: checkSession, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
