'use client';

import { useState, useEffect, createContext, useContext } from 'react';

interface User {
    id: string;
    email: string;
    name?: string;
    image_url?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => void; // Trigger re-fetch
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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

    // Improved fetch with cookie support
    const checkSession = async () => {
        try {
            // We need to use a proxy or full URL.
            // NEXT_PUBLIC_API_URL is http://localhost:5000/api
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (err) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login: checkSession, logout: () => setUser(null) }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
