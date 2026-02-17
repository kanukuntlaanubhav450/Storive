const supabase = require('../config/supabaseClient');
const logger = require('./logger');

exports.checkAccess = async (resourceType, resourceId, userId, requiredRole = 'viewer') => {
    logger.debug(`checkAccess: type=${resourceType}, resourceId=${resourceId}, userId=${userId}, requiredRole=${requiredRole}`);

    // 1. Check Ownership (Quickest check)
    // Validate resourceType to prevent improper table mapping
    if (resourceType !== 'folder' && resourceType !== 'file') {
        throw new Error(`Invalid resourceType: ${resourceType}; expected 'file' or 'folder'`);
    }
    const table = resourceType === 'folder' ? 'folders' : 'files';

    const { data: resource, error: resourceError } = await supabase
        .from(table)
        .select('owner_id, is_deleted')
        .eq('id', resourceId)
        .single();

    if (resourceError || !resource) {
        logger.error(`Resource not found:`, resourceError);
        throw new Error('Resource not found');
    }

    logger.debug(`Resource found: owner=${resource.owner_id}, is_deleted=${resource.is_deleted}`);

    // 1a. Deleted items are generally not accessible unless restoring (handled separately)
    if (resource.is_deleted) {
        logger.info(`Resource is in trash`);
        throw new Error('Resource is in trash');
    }

    // 1b. Owner always has full access
    if (resource.owner_id === userId) {
        logger.debug(`User is owner - access granted`);
        return true;
    }

    logger.debug(`User is not owner, checking shares table...`);

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

    if (shareError && shareError.code !== 'PGRST116') {
        logger.error(`Database error checking shares:`, shareError);
        throw shareError;
    }

    logger.debug(`Share query result:`, { share, shareError });

    if (share) {
        logger.debug(`Share found: role=${share.role}`);
        if (requiredRole === 'viewer') {
            logger.info(`Viewer access granted (any share grants view access)`);
            return true; // Any share grants view access
        }
        if (requiredRole === 'editor' && share.role === 'editor') {
            logger.info(`Editor access granted`);
            return true;
        }
        logger.warn(`Share exists but insufficient permissions`);
    } else {
        logger.debug(`No share found for this user (or row missing)`);
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
