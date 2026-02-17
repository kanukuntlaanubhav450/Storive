'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Link2, Copy, Check, UserPlus, Users2, Globe } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface ShareDialogProps {
    isOpen: boolean;
    onClose: () => void;
    resource: {
        id: string;
        name: string;
        type: 'file' | 'folder';
    } | null;
}

interface Share {
    id: string;
    grantee_user_id: string;
    role: 'viewer' | 'editor';
    users: {
        id: string;
        name: string;
        email: string;
    };
}

interface PublicLink {
    linkId: string;
    token: string;
    expiresAt: string | null;
}

export function ShareDialog({ isOpen, onClose, resource }: ShareDialogProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
    const [shares, setShares] = useState<Share[]>([]);
    const [canManageShares, setCanManageShares] = useState(true);
    const [publicLink, setPublicLink] = useState<PublicLink | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimeoutRef = useRef<any>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isOpen && resource) {
            fetchShares();
        }
    }, [isOpen, resource]);

    const fetchShares = async () => {
        if (!resource) return;

        try {
            const data = await api.getShares(resource.type, resource.id);
            setShares(data.shares || []);
            setCanManageShares(true);
        } catch (err: any) {
            // If we get "Only the owner can view shares", gracefully handle it
            if (err.message?.includes('Only the owner')) {
                setCanManageShares(false);
                setShares([]);
            } else {
                toast.error("Failed to load shares", { description: err.message });
            }
        }
    };

    const handleShare = async () => {
        if (!resource || !email.trim()) return;

        setLoading(true);
        try {
            await api.shareResource(resource.type, resource.id, email.trim(), role);
            toast.success(`Shared with ${email}`);
            setEmail('');
            fetchShares();
        } catch (error: any) {
            toast.error('Failed to share', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveAccess = async (share: Share) => {
        if (!resource) return;

        try {
            await api.unshareResource(resource.type, resource.id, share.grantee_user_id);
            toast.success('Access removed');
            fetchShares();
        } catch (error: any) {
            toast.error('Failed to remove access', { description: error.message });
        }
    };

    const handleChangeRole = async (share: Share, newRole: 'viewer' | 'editor') => {
        if (!resource) return;

        try {
            // Re-share with new role (upsert)
            await api.shareResource(resource.type, resource.id, share.users.email, newRole);
            toast.success(`Changed to ${newRole}`);
            fetchShares();
        } catch (error: any) {
            toast.error('Failed to change permission', { description: error.message });
        }
    };

    const handleCreateLink = async () => {
        if (!resource) return;

        try {
            const data = await api.createPublicLink(resource.type, resource.id);
            const fullUrl = `${window.location.origin}/share/${data.token}`;
            setPublicLink({ ...data, token: fullUrl });
            toast.success('Public link created');
        } catch (error: any) {
            toast.error('Failed to create link', { description: error.message });
        }
    };

    const handleCopyLink = async () => {
        if (!publicLink) return;

        if (copyTimeoutRef.current) {
            clearTimeout(copyTimeoutRef.current);
        }

        try {
            await navigator.clipboard.writeText(publicLink.token);
            setCopied(true);
            toast.success('Link copied to clipboard');
            copyTimeoutRef.current = setTimeout(() => {
                setCopied(false);
                copyTimeoutRef.current = null;
            }, 2000);
        } catch (err: any) {
            toast.error('Failed to copy link', { description: err.message });
        }
    };

    const handleRevokeLink = async () => {
        if (!publicLink) return;

        try {
            await api.revokePublicLink(publicLink.linkId);
            setPublicLink(null);
            toast.success('Link removed');
        } catch (error: any) {
            toast.error('Failed to remove link', { description: error.message });
        }
    };

    if (!resource) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users2 className="h-5 w-5" />
                        Share "{resource.name}"
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Share with people */}
                    <div>
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Share with people
                        </h3>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                                className="flex-1"
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-28">
                                        {role === 'viewer' ? '👁️ Viewer' : '✏️ Editor'}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => setRole('viewer')}>
                                        👁️ Viewer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRole('editor')}>
                                        ✏️ Editor
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button onClick={handleShare} disabled={loading || !email.trim()}>
                                Send
                            </Button>
                        </div>
                    </div>

                    {/* People with access */}
                    {shares.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium mb-3">People with access</h3>
                            <div className="space-y-2">
                                {shares.map((share) => (
                                    <div
                                        key={share.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-900"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {share.users.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{share.users.name}</p>
                                                <p className="text-xs text-muted-foreground">{share.users.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm">
                                                        {share.role === 'viewer' ? '👁️ Viewer' : '✏️ Editor'}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(share, 'viewer')}>
                                                        👁️ Viewer
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(share, 'editor')}>
                                                        ✏️ Editor
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveAccess(share)}
                                                aria-label={`Remove access for ${share.users.email || share.users.name}`}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Public link */}
                    <div>
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Get link
                        </h3>
                        {!publicLink ? (
                            <Button onClick={handleCreateLink} variant="outline" className="w-full">
                                <Link2 className="h-4 w-4 mr-2" />
                                Create public link
                            </Button>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                                    <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                                            Anyone with the link can view
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {publicLink.token}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleCopyLink}
                                        className="flex-shrink-0"
                                    >
                                        {copied ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <Button
                                    onClick={handleRevokeLink}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-red-600 hover:text-red-700"
                                >
                                    Remove link
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Done button */}
                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={onClose}>Done</Button>
                    </div>
                </div>
            </DialogContent >
        </Dialog >
    );
}
