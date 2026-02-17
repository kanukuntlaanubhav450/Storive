const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const { v4: uuidv4 } = require('uuid');
const { sendShareNotificationEmail } = require('../utils/emailService');
const { maskEmail } = require('../utils/logUtils');

// Validation constants
const ALLOWED_RESOURCE_TYPES = ['file', 'folder'];
const ALLOWED_ROLES = ['viewer', 'editor'];

exports.shareResource = async (req, res) => {
    const { resourceType, resourceId, email, role } = req.body;
    const userId = req.user.id;

    try {
        // 1. Validate input parameters
        if (!resourceType || !ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
            return res.status(400).json({
                error: `Invalid resourceType. Must be one of: ${ALLOWED_RESOURCE_TYPES.join(', ')}`
            });
        }

        if (!resourceId) {
            return res.status(400).json({
                error: 'Invalid resourceId. Identifier is required.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email. A valid email address is required.'
            });
        }

        if (!role || !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({
                error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}`
            });
        }

        // 2. Verify Requestor is Owner
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only the owner can share this resource');

        // 3. Find Grantee User ID by Email
        const { data: grantee, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !grantee) throw new Error('User with this email not found');

        if (grantee.id === userId) throw new Error('Cannot share with yourself');

        // 4. Insert/Update Share
        const { data, error } = await supabase
            .from('shares')
            .upsert([
                {
                    resource_type: resourceType,
                    resource_id: resourceId,
                    grantee_user_id: grantee.id,
                    role: role,
                    created_by: userId
                }
            ], { onConflict: 'resource_type, resource_id, grantee_user_id' })
            .select()
            .single();

        if (error) throw error;

        // Send email notification
        try {
            console.log('📧 Attempting to send share notification email...');
            // Get resource name and owner name
            const table = resourceType === 'folder' ? 'folders' : 'files';
            const { data: resource } = await supabase.from(table).select('name').eq('id', resourceId).single();
            const { data: owner } = await supabase.from('users').select('name').eq('id', userId).single();
            const { data: recipient } = await supabase.from('users').select('name, email').eq('id', grantee.id).single();

            console.log('Email details:', {
                resource: resource?.name,
                owner: owner?.name,
                recipient: recipient?.email ? maskEmail(recipient.email) : '[no-email]'
            });

            if (resource && owner && recipient) {
                const accessUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/shared`;
                const emailSent = await sendShareNotificationEmail(
                    recipient.email,
                    recipient.name,
                    owner.name,
                    resource.name,
                    resourceType,
                    role,
                    accessUrl
                );
                console.log('✅ Email sent successfully:', emailSent);
            } else {
                console.log('⚠️ Missing data for email:', { resource, owner, recipient });
            }
        } catch (emailError) {
            console.error('❌ Failed to send share notification email:', emailError);
            // Don't fail the share operation if email fails
        }

        res.status(200).json({ message: 'Shared successfully', share: data });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.unshareResource = async (req, res) => {
    const { resourceType, resourceId, granteeId } = req.body;
    const userId = req.user.id;

    try {
        // Validate resourceType
        if (!resourceType || !ALLOWED_RESOURCE_TYPES.includes(resourceType)) {
            return res.status(400).json({
                error: `Invalid resourceType. Must be one of: ${ALLOWED_RESOURCE_TYPES.join(', ')}`
            });
        }

        // Verify owner
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only the owner can unshare');

        // Delete the share and return the deleted rows
        const { data, error } = await supabase
            .from('shares')
            .delete()
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .eq('grantee_user_id', granteeId)
            .select(); // Return deleted rows to verify

        if (error) throw error;

        // Check if any rows were actually deleted
        if (!data || data.length === 0) {
            return res.status(404).json({
                error: 'Share not found. No access to revoke.'
            });
        }

        res.status(200).json({ message: 'Access revoked' });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Helper inside controller for now
async function isResourceOwner(type, id, userId) {
    // Validate input type (use same constants as exports)
    if (!type || !ALLOWED_RESOURCE_TYPES.includes(type)) {
        throw new Error(`Invalid resource type: ${type}. Must be 'file' or 'folder'`);
    }

    // Map to correct table
    const table = type === 'folder' ? 'folders' : 'files';

    // Query database
    const { data, error } = await supabase
        .from(table)
        .select('owner_id')
        .eq('id', id)
        .single();

    // Propagate Supabase errors instead of silently ignoring
    if (error) {
        // If resource not found, return false (not owner)
        if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
            return false;
        }
        // For other errors, propagate them
        throw error;
    }

    // Check ownership
    if (!data) {
        return false; // Resource not found
    }

    return data.owner_id === userId;
}

exports.getShares = async (req, res) => {
    const { resourceType, resourceId } = req.query;
    const userId = req.user.id;

    try {
        // Verify user is owner
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only the owner can view shares');

        // Get all shares for this resource
        const { data: shares, error } = await supabase
            .from('shares')
            .select('*')
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId);

        if (error) throw error;

        // Manually fetch user details for each share
        const sharesWithUsers = await Promise.all(
            (shares || []).map(async (share) => {
                const { data: user } = await supabase
                    .from('users')
                    .select('id, name, email')
                    .eq('id', share.grantee_user_id)
                    .single();

                return {
                    ...share,
                    users: user || { id: share.grantee_user_id, name: 'Unknown', email: 'unknown@example.com' }
                };
            })
        );

        res.status(200).json({ shares: sharesWithUsers });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.createPublicLink = async (req, res) => {
    const { resourceType, resourceId, expiresInHours } = req.body;
    const userId = req.user.id;

    try {
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only owner can create public links');

        const token = uuidv4(); // Simple token
        let expiresAt = null;
        if (expiresInHours) {
            expiresAt = new Date(Date.now() + expiresInHours * 3600000);
        }

        const { data, error } = await supabase
            .from('link_shares')
            .insert([{
                resource_type: resourceType,
                resource_id: resourceId,
                token: token,
                role: 'viewer', // Public links are View Only strictly
                expires_at: expiresAt,
                created_by: userId
            }])
            .select()
            .single();

        if (error) throw error;

        // Return the link (Frontend constructs full URL)
        res.status(201).json({
            linkId: data.id,
            token: data.token,
            expiresAt: data.expires_at
        });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.accessPublicLink = async (req, res) => {
    const { token } = req.params;

    try {
        const { data: link, error } = await supabase
            .from('link_shares')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !link) throw new Error('Invalid link');

        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            throw new Error('Link expired');
        }

        // Get Resource Details (Preview)
        // Note: Public access needs to be carefully handled. 
        // We return metadata. Actual file download needs a Signed URL generated *here*.

        let resource = null;
        if (link.resource_type === 'file') {
            const { data: file } = await supabase.from('files').select('*').eq('id', link.resource_id).single();
            if (file) {
                // Generate temp download url
                const { data: dl } = await supabase.storage.from('drive').createSignedUrl(file.storage_key, 3600);
                resource = { ...file, downloadUrl: dl?.signedUrl };
            }
        } else {
            const { data: folder } = await supabase.from('folders').select('*').eq('id', link.resource_id).single();
            // For folders, we might need to list children? 
            // Public folder view is complex. Return folder meta for now.
            resource = folder;
        }

        res.status(200).json({ resource, link });

    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};

exports.revokePublicLink = async (req, res) => {
    const { linkId } = req.body;
    const userId = req.user.id;

    try {
        // Get link details including resource info
        const { data: link, error: linkError } = await supabase
            .from('link_shares')
            .select('created_by, resource_type, resource_id')
            .eq('id', linkId)
            .single();

        if (linkError || !link) {
            throw new Error('Link not found');
        }

        // Check if user is the link creator
        const isCreator = link.created_by === userId;

        // Check if user is the resource owner
        const isOwner = await isResourceOwner(link.resource_type, link.resource_id, userId);

        // Allow revoke if user is either creator or resource owner
        if (!isCreator && !isOwner) {
            throw new Error('Permission denied. Only the link creator or resource owner can revoke.');
        }

        // Revoke the link
        const { error } = await supabase.from('link_shares').delete().eq('id', linkId);
        if (error) throw error;

        res.status(200).json({ message: 'Link revoked' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
