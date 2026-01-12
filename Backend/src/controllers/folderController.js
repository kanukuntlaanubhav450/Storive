const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const activityLogger = require('../utils/activityLogger');

exports.createFolder = async (req, res) => {
    const { name, parentId } = req.body;
    const userId = req.user.id;

    try {
        if (parentId) {
            const canEditParent = await permissionUtils.canEdit('folder', parentId, userId);
            if (!canEditParent) throw new Error('Permission denied: Cannot create in this folder');
        }

        const { data, error } = await supabase
            .from('folders')
            .insert([
                {
                    name,
                    parent_id: parentId || null,
                    owner_id: userId
                }
            ])
            .select()
            .single();

        if (error) throw error;

        // Log Activity
        await activityLogger.logActivity(userId, 'create', 'folder', data.id, { name });

        res.status(201).json({ folder: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        let folder = null;

        if (id !== 'root') {
            const canRead = await permissionUtils.canRead('folder', id, userId);
            if (!canRead) throw new Error('Access denied');

            const { data } = await supabase.from('folders').select('*').eq('id', id).single();
            folder = data;
        }

        let folderQuery = supabase
            .from('folders')
            .select('*')
            .eq('is_deleted', false)
            .order('name', { ascending: true });

        let fileQuery = supabase
            .from('files')
            .select('*')
            .eq('is_deleted', false)
            .order('name', { ascending: true });

        if (id === 'root') {
            folderQuery = folderQuery.is('parent_id', null).eq('owner_id', userId);
            fileQuery = fileQuery.is('folder_id', null).eq('owner_id', userId);
        } else {
            folderQuery = folderQuery.eq('parent_id', id);
            fileQuery = fileQuery.eq('folder_id', id);
        }

        const { data: subfolders, error: subError } = await folderQuery;
        if (subError) throw subError;

        const { data: files, error: fileError } = await fileQuery;
        if (fileError) throw fileError;

        res.status(200).json({
            folder,
            children: {
                folders: subfolders,
                files: files
            }
        });

    } catch (error) {
        console.error('Get Folder Error:', error);
        res.status(404).json({ error: 'Folder not found or access denied' });
    }
};

exports.updateFolder = async (req, res) => {
    const { id } = req.params;
    const { name, parentId } = req.body;
    const userId = req.user.id;

    try {
        const canEdit = await permissionUtils.canEdit('folder', id, userId);
        if (!canEdit) throw new Error('Permission denied');

        const updates = {};
        if (name) updates.name = name;
        if (parentId !== undefined) {
            if (parentId) {
                const canEditNewParent = await permissionUtils.canEdit('folder', parentId, userId);
                if (!canEditNewParent) throw new Error('Cannot move to target folder');
            }
            updates.parent_id = parentId;
        }
        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('folders')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log Activity
        const action = parentId !== undefined ? 'move' : 'rename';
        await activityLogger.logActivity(userId, action, 'folder', id, updates);

        res.status(200).json({ folder: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const canEdit = await permissionUtils.canEdit('folder', id, userId);
        if (!canEdit) throw new Error('Permission denied');

        // Soft delete
        const { data, error } = await supabase
            .from('folders')
            .update({ is_deleted: true })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log Activity
        await activityLogger.logActivity(userId, 'delete', 'folder', id);

        res.status(200).json({ message: 'Folder moved to trash', folder: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.restoreFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Can edit means we own controls, but 'checkAccess' throws if is_deleted.
        // We need custom check for restore: Look up item -> check ownership/edit rights -> ignore deleted flag
        const { data: folder, error: fetchError } = await supabase.from('folders').select('*').eq('id', id).single();
        if (fetchError || !folder) throw new Error('Folder not found');

        // Ownership check (or Editor if we allow editors to restore? Safer Owner only)
        if (folder.owner_id !== userId) throw new Error('Permission denied');

        const { data, error } = await supabase
            .from('folders')
            .update({ is_deleted: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await activityLogger.logActivity(userId, 'restore', 'folder', id);

        res.status(200).json({ message: 'Folder restored', folder: data });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
