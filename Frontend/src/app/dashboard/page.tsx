'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the default files view
        router.push('/dashboard/files');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-pulse text-muted-foreground">Redirecting to My Drive...</div>
        </div>
    );
}
