const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const activityLogger = require('../utils/activityLogger');
const { v4: uuidv4 } = require('uuid');

const STORAGE_BUCKET = 'drive';

exports.initUpload = async (req, res) => {
    const { name, folderId, mimeType, sizeBytes } = req.body;
    const userId = req.user.id;

    console.log(`[InitUpload] Starting for user: ${userId}, file: ${name}, folder: ${folderId}`);

    try {
        // Permission: If uploading to a folder, user must have 'editor' or 'owner' rights.
        if (folderId && folderId !== 'root') {
            const canEditFolder = await permissionUtils.canEdit('folder', folderId, userId);
            if (!canEditFolder) {
                console.warn('[InitUpload] Permission denied for folder:', folderId);
                throw new Error('Permission denied: Cannot upload to this folder');
            }
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
                    folder_id: folderId === 'root' ? null : folderId,
                    owner_id: userId,
                    mime_type: mimeType,
                    size_bytes: sizeBytes,
                    storage_key: storageKey,
                }
            ])
            .select()
            .single();

        if (dbError) {
            console.error('[InitUpload] DB Insert Error (Files):', JSON.stringify(dbError, null, 2));
            throw dbError;
        }
        console.log('[InitUpload] DB Insert Success:', file.id);

        // 3. Generate Signed Upload URL
        const { data: uploadData, error: storageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(storageKey);

        if (storageError) {
            await supabase.from('files').delete().eq('id', file.id);
            throw storageError;
        }

        // Note: Logging 'upload' happens at completion in completeUpload

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

exports.abortUpload = async (req, res) => {
    const { fileId } = req.body;
    const userId = req.user.id;

    console.log(`[AbortUpload] Cleaning up file: ${fileId} for user: ${userId}`);

    try {
        const { data: file, error: fetchError } = await supabase
            .from('files')
            .select('owner_id, storage_key')
            .eq('id', fileId)
            .single();

        if (fetchError || !file) {
            console.warn('[AbortUpload] File not found or already cleaned up:', fileId);
            return res.status(200).json({ message: 'Nothing to clean up' });
        }

        if (file.owner_id !== userId) {
            throw new Error('Permission denied');
        }

        // 1. Delete DB Entry
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .eq('id', fileId);

        if (dbError) throw dbError;

        // 2. Cleanup Storage if path exists
        if (file.storage_key) {
            try {
                const { error: storageError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .remove([file.storage_key]);

                if (storageError) {
                    console.error('[AbortUpload] Storage cleanup error:', {
                        bucket: STORAGE_BUCKET,
                        key: file.storage_key,
                        error: storageError
                    });
                }
            } catch (error) {
                console.error('[AbortUpload] Storage cleanup exception:', {
                    bucket: STORAGE_BUCKET,
                    key: file.storage_key,
                    error
                });
            }
        }

        console.log('[AbortUpload] Cleanup successful for file:', fileId);
        res.status(200).json({ message: 'Upload aborted and cleaned up' });

    } catch (error) {
        console.error('[AbortUpload] Error during cleanup:', error);
        res.status(400).json({ error: error.message });
    }
};

exports.downloadFile = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`📥 Download File Request: fileId=${id}, userId=${userId}`);

    try {
        const { data: file, error: dbError } = await supabase
            .from('files')
            .select('*')
            .eq('id', id)
            .single();

        if (dbError || !file) {
            console.error('❌ File not found in database:', id, dbError);
            throw new Error('File not found');
        }

        console.log(`✓ File found: ${file.name}, owner: ${file.owner_id}`);

        const canRead = await permissionUtils.canRead('file', id, userId);
        if (!canRead) {
            console.error(`❌ Permission denied for user ${userId} on file ${id}`);
            throw new Error('Access denied');
        }

        console.log(`✓ Permission granted for ${userId}`);

        const { data, error: storageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.storage_key, 3600, {
                download: file.name
            });

        if (storageError) {
            console.error('❌ Storage error:', storageError);
            throw storageError;
        }

        console.log(`✅ Download URL generated successfully for: ${file.name}`);

        // Log Download (Optional - might be noisy)
        // await activityLogger.logActivity(userId, 'download', 'file', id);

        res.status(200).json({
            downloadUrl: data.signedUrl,
            name: file.name,
            mimeType: file.mime_type
        });

    } catch (error) {
        console.error('❌ Download Error:', error);
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

        // Check if parent folder is deleted
        // If parent is deleted, move file to root to ensure it's accessible
        if (file.folder_id) {
            const { data: parent } = await supabase.from('folders').select('is_deleted').eq('id', file.folder_id).single();
            if (parent && parent.is_deleted) {
                // Parent folder is deleted - move file to root
                // This ensures the file is accessible after restoration
                const { error: moveError } = await supabase
                    .from('files')
                    .update({ folder_id: null })
                    .eq('id', id);

                if (moveError) {
                    console.error('Error moving file to root:', moveError);
                    throw new Error('Failed to restore file: parent folder is deleted');
                }

                // Update local file object to reflect the move
                file.folder_id = null;
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


exports.permanentDeleteFile = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Use ownership check instead of canEdit for deleted files
        // canEdit may fail for trashed items, so we check ownership directly
        // This matches the pattern used in folderController.js
        const { data: file, error: fetchError } = await supabase
            .from('files')
            .select('owner_id, storage_key, is_deleted')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!file) throw new Error('File not found');

        // Ownership check (only owner can permanently delete)
        if (file.owner_id !== userId) throw new Error('Permission denied');

        if (!file.is_deleted) {
            throw new Error('File must be in trash before permanent deletion');
        }

        // Atomic deletion: Delete database record FIRST, then storage
        // This prevents orphaned DB records if storage deletion fails
        // Step 1: Delete from database FIRST
        const { error: dbError } = await supabase
            .from('files')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        // Step 2: Delete from storage ONLY after DB deletion succeeds
        // Storage deletion errors are logged but don't fail the operation
        // Rationale: Orphaned storage files are acceptable; orphaned DB records break the app
        if (file.storage_key) {
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .remove([file.storage_key]);

            if (storageError) {
                // Log error with details for manual cleanup, but don't fail
                console.error('Storage deletion error (DB already clean):', {
                    fileId: id,
                    storageKey: file.storage_key,
                    error: storageError
                });
            }
        }

        await activityLogger.logActivity(userId, 'permanent_delete', 'file', id);

        res.status(200).json({ message: 'File permanently deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
