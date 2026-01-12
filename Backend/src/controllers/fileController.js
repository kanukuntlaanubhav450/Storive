const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const activityLogger = require('../utils/activityLogger');
const { v4: uuidv4 } = require('uuid');

const STORAGE_BUCKET = 'drive';

exports.initUpload = async (req, res) => {
    const { name, folderId, mimeType, sizeBytes } = req.body;
    const userId = req.user.id;

    try {
        // Permission: If uploading to a folder, user must have 'editor' or 'owner' rights.
        if (folderId && folderId !== 'root') {
            const canEditFolder = await permissionUtils.canEdit('folder', folderId, userId);
            if (!canEditFolder) throw new Error('Permission denied: Cannot upload to this folder');
        }

        // 1. Generate path
        const fileUuid = uuidv4();
        const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storageKey = `tenants/${userId}/${folderId || 'root'}/${fileUuid}-${safeName}`;

        // 2. Create DB Entry
        const { data: file, error: dbError } = await supabase
            .from('files')
            .insert([
                {
                    name,
                    folder_id: folderId || null,
                    owner_id: userId,
                    mime_type: mimeType,
                    size_bytes: sizeBytes,
                    storage_key: storageKey,
                }
            ])
            .select()
            .single();

        if (dbError) throw dbError;

        // 3. Generate Signed Upload URL
        const { data: uploadData, error: storageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(storageKey);

        if (storageError) {
            await supabase.from('files').delete().eq('id', file.id);
            throw storageError;
        }

        // Note: Logging 'upload' happens at completion usually
        await activityLogger.logActivity(userId, 'upload-init', 'file', file.id, { name });

        res.status(201).json({
            fileId: file.id,
            storageKey: storageKey,
            uploadUrl: uploadData.signedUrl,
            token: uploadData.token
        });

    } catch (error) {
        console.error('Init Upload Error:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.completeUpload = async (req, res) => {
    const { fileId } = req.body;
    const userId = req.user.id;

    try {
        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();

        if (error || !file) throw new Error('File not found');

        if (file.owner_id !== userId) throw new Error('Permission denied');

        const { error: updateError } = await supabase
            .from('files')
            .update({ updated_at: new Date() })
            .eq('id', fileId);

        if (updateError) throw updateError;

        await activityLogger.logActivity(userId, 'upload', 'file', fileId);

        res.status(200).json({ message: 'Upload verified and completed', file });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.downloadFile = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const { data: file, error: dbError } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .single();

        if (dbError || !file) throw new Error('File not found');

        const canRead = await permissionUtils.canRead('file', id, userId);
        if (!canRead) throw new Error('Access denied');

        const { data, error: storageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.storage_key, 3600);

        if (storageError) throw storageError;

        // Log Download (Optional - might be noisy)
        // await activityLogger.logActivity(userId, 'download', 'file', id);

        res.status(200).json({
            downloadUrl: data.signedUrl,
            name: file.name,
            mimeType: file.mime_type
        });

    } catch (error) {
        console.error('Download Error:', error);
        res.status(404).json({ error: error.message });
    }
};

exports.updateFile = async (req, res) => {
    const { id } = req.params;
    const { name, folderId } = req.body;
    const userId = req.user.id;

    try {
        const canEdit = await permissionUtils.canEdit('file', id, userId);
        if (!canEdit) throw new Error('Permission denied');

        const updates = {};
        if (name) updates.name = name;
        if (folderId !== undefined) updates.folder_id = folderId;
        updates.updated_at = new Date();

        const { data, error } = await supabase
            .from('files')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        const action = folderId !== undefined ? 'move' : 'rename';
        await activityLogger.logActivity(userId, action, 'file', id, updates);

        res.status(200).json({ file: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteFile = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const canEdit = await permissionUtils.canEdit('file', id, userId);
        if (!canEdit) throw new Error('Permission denied');

        const { data, error } = await supabase
            .from('files')
            .update({ is_deleted: true })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await activityLogger.logActivity(userId, 'delete', 'file', id);

        res.status(200).json({ message: 'File moved to trash', file: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.restoreFile = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const { data: file, error: fetchError } = await supabase.from('files').select('*').eq('id', id).single();
        if (fetchError || !file) throw new Error('File not found');

        if (file.owner_id !== userId) throw new Error('Permission denied');

        // Check if parent folder is deleted? Ideally yes.
        if (file.folder_id) {
            const { data: parent } = await supabase.from('folders').select('is_deleted').eq('id', file.folder_id).single();
            if (parent && parent.is_deleted) {
                // Move to root if parent is missing
                // For now, simpler to just error or move to root.
                // let's just restore it, user can find it in 'recent' or similar.
            }
        }

        const { data, error } = await supabase
            .from('files')
            .update({ is_deleted: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await activityLogger.logActivity(userId, 'restore', 'file', id);

        res.status(200).json({ message: 'File restored', file: data });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
