const supabase = require('../config/supabaseClient');

/**
 * Logs an activity to the database.
 * @param {string} actorId - User UUID performing the action
 * @param {string} action - 'upload', 'create', 'rename', 'delete', 'restore', 'move', 'share', 'download'
 * @param {string} resourceType - 'file' or 'folder'
 * @param {string} resourceId - UUID of the resource
 * @param {object} context - Additional metadata (e.g., old name, new path)
 */
exports.logActivity = async (actorId, action, resourceType, resourceId, context = {}) => {
    try {
        const { error } = await supabase
            .from('activities')
            .insert([
                {
                    actor_id: actorId,
                    action,
                    resource_type: resourceType,
                    resource_id: resourceId,
                    context: context
                }
            ]);

        if (error) {
            console.error('Failed to log activity:', error.message);
            // We generally don't want to fail the main request just because logging failed, 
            // check compliance requirements. For now, we log to console and proceed.
        }
    } catch (err) {
        console.error('Activity Logger Exception:', err);
    }
};
