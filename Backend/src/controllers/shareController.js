const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const { v4: uuidv4 } = require('uuid');

exports.shareResource = async (req, res) => {
    const { resourceType, resourceId, email, role } = req.body; // Using email to find user to share with
    const userId = req.user.id;

    try {
        // 1. Verify Requestor is Owner (Only owner can share for MVP, or Editor too?)
        // Spec says "Owner: full control". Let's restrict sharing to Owner for now.
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only the owner can share this resource');

        // 2. Find Grantee User ID by Email
        const { data: grantee, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !grantee) throw new Error('User with this email not found');

        if (grantee.id === userId) throw new Error('Cannot share with yourself');

        // 3. Insert/Update Share
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
        res.status(200).json({ message: 'Shared successfully', share: data });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.unshareResource = async (req, res) => {
    const { resourceType, resourceId, granteeId } = req.body;
    const userId = req.user.id;

    try {
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only the owner can unshare');

        const { error } = await supabase
            .from('shares')
            .delete()
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .eq('grantee_user_id', granteeId);

        if (error) throw error;
        res.status(200).json({ message: 'Access revoked' });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Helper inside controller for now
async function isResourceOwner(type, id, userId) {
    const table = type === 'folder' ? 'folders' : 'files';
    const { data } = await supabase.from(table).select('owner_id').eq('id', id).single();
    return data && data.owner_id === userId;
}

exports.createPublicLink = async (req, res) => {
    const { resourceType, resourceId, password, expiresInHours } = req.body;
    const userId = req.user.id;

    try {
        const isOwner = await isResourceOwner(resourceType, resourceId, userId);
        if (!isOwner) throw new Error('Only owner can create public links');

        const token = uuidv4(); // Simple token
        let expiresAt = null;
        if (expiresInHours) {
            expiresAt = new Date(Date.now() + expiresInHours * 3600000);
        }

        // Ideally hash password if provided. validation out of scope for quick MVP, storing null.

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
        // Only creator can revoke
        const { data: link } = await supabase.from('link_shares').select('created_by').eq('id', linkId).single();
        if (!link || link.created_by !== userId) throw new Error('Permission denied');

        const { error } = await supabase.from('link_shares').delete().eq('id', linkId);
        if (error) throw error;

        res.status(200).json({ message: 'Link revoked' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
