const supabase = require('../config/supabaseClient');

/**
 * Checks if a user has access to a resource.
 * @param {string} resourceType - 'file' or 'folder'
 * @param {string} resourceId - UUID of the resource
 * @param {string} userId - UUID of the user
 * @param {string} requiredRole - 'viewer' or 'editor'
 * @returns {Promise<boolean>} - Returns true if access is granted, throws error otherwise.
 */
exports.checkAccess = async (resourceType, resourceId, userId, requiredRole = 'viewer') => {
    // 1. Check Ownership (Quickest check)
    // We need to look up the resource first.
    const table = resourceType === 'folder' ? 'folders' : 'files';

    const { data: resource, error: resourceError } = await supabase
        .from(table)
        .select('owner_id, is_deleted')
        .eq('id', resourceId)
        .single();

    if (resourceError || !resource) {
        throw new Error('Resource not found');
    }

    // 1a. Deleted items are generally not accessible unless restoring (handled separately)
    if (resource.is_deleted) {
        throw new Error('Resource is in trash');
    }

    // 1b. Owner always has full access
    if (resource.owner_id === userId) {
        return true;
    }

    // 2. Check Shares Table
    // If requiredRole is 'editor', user must have 'editor' role.
    // If requiredRole is 'viewer', user can have 'viewer' OR 'editor' role.

    const { data: share, error: shareError } = await supabase
        .from('shares')
        .select('role')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .eq('grantee_user_id', userId)
        .single();

    if (share) {
        if (requiredRole === 'viewer') return true; // Any share grants view access
        if (requiredRole === 'editor' && share.role === 'editor') return true;
    }

    throw new Error('Access denied');
};

/**
 * Checks if a user is an Editor or Owner (Permissions to Modify)
 */
exports.canEdit = async (resourceType, resourceId, userId) => {
    return await exports.checkAccess(resourceType, resourceId, userId, 'editor');
};

/**
 * Checks if a user is a Viewer, Editor, or Owner (Permissions to Read)
 */
exports.canRead = async (resourceType, resourceId, userId) => {
    return await exports.checkAccess(resourceType, resourceId, userId, 'viewer');
};
