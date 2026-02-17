const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const activityLogger = require('../utils/activityLogger');

const STORAGE_BUCKET = 'drive';

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

        let ancestors = [];
        if (folder && folder.parent_id) {
            let currentParentId = folder.parent_id;
            // Limit depth to prevent infinite loops or excessive queries
            for (let i = 0; i < 10; i++) {
                if (!currentParentId) break;

                const { data: parent } = await supabase
                    .from('folders')
                    .select('id, name, parent_id')
                    .eq('id', currentParentId)
                    .single();

                if (parent) {
                    ancestors.unshift(parent);
                    currentParentId = parent.parent_id;
                } else {
                    break;
                }
            }
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
            ancestors,
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

                // Cycle detection: Prevent moving a folder into its own descendant
                // Walk up the parent chain of the target folder to check if the folder being moved is an ancestor
                let currentParentId = parentId;
                let depth = 0;
                const maxDepth = 100; // Prevent infinite loops in case of data corruption

                while (currentParentId && depth < maxDepth) {
                    // If the target parent is the folder being moved, that's a cycle
                    if (currentParentId === id) {
                        throw new Error('Cannot move folder into itself or its descendant');
                    }

                    // Fetch the parent folder to get its parent_id
                    const { data: parentFolder, error: parentError } = await supabase
                        .from('folders')
                        .select('parent_id')
                        .eq('id', currentParentId)
                        .single();

                    if (parentError || !parentFolder) {
                        // Parent folder not found or error - stop checking
                        break;
                    }

                    // Move up to the next parent
                    currentParentId = parentFolder.parent_id;
                    depth++;
                }

                if (depth >= maxDepth) {
                    console.error(`Cycle detection reached max depth for folder ${id}`);
                    throw new Error('Folder hierarchy is too deep or corrupted');
                }
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

exports.downloadFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const archiver = require('archiver');
        const canRead = await permissionUtils.canRead('folder', id, userId);
        if (!canRead) throw new Error('Access denied');

        const { data: folder, error: folderError } = await supabase.from('folders').select('name').eq('id', id).single();
        if (folderError || !folder) throw new Error('Folder not found');

        // Recursive function to gather files
        // For MVP, let's strictly get files in THIS folder to avoid complexity and heavy loads.
        // User asked to "download folder", usually implies contents.
        // We will fetch ALL files that belong to this folder or its subfolders.
        // Doing this efficiently with Supabase:
        // Option 1: Recursive CTE.
        // Option 2: Fetch all files and folders for user, build tree in memory, filter. (Not scalable)
        // Option 3: Basic depth - Just immediate files.
        // Let's do Option 2 but optimized: Fetch all files/folders for this user, iterate.
        // Warning: If user has 10k files, this is slow.
        // Better: Postgres Recursive CTE.

        // Let's try a simpler approach: Just get files in THIS folder (Depth 0) first to ensure it works.
        // AND warn user "Subfolders are not included" in UI? No, that's bad UX.

        // Query to get all descendant folder IDs?
        const { data: allFolders } = await supabase.from('folders').select('id, parent_id, name').eq('owner_id', userId).eq('is_deleted', false);

        const getDescendantIds = (rootId, all) => {
            let ids = [rootId];
            let children = all.filter(f => f.parent_id === rootId);
            for (let child of children) {
                ids = ids.concat(getDescendantIds(child.id, all));
            }
            return ids;
        };

        const targetFolderIds = getDescendantIds(id, allFolders || []);

        const { data: files } = await supabase
            .from('files')
            .select('name, storage_key, folder_id')
            .in('folder_id', targetFolderIds)
            .eq('is_deleted', false);

        // Setup Zip Stream (even if empty, like Google Drive)
        res.setHeader('Content-Type', 'application/zip');

        // Sanitize folder name to prevent header injection
        // Remove control characters, quotes, newlines, and other unsafe characters
        let safeFolderName = folder.name
            .replace(/[\r\n\t]/g, '') // Remove CR, LF, TAB
            .replace(/["'\\]/g, '')    // Remove quotes and backslashes
            .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Remove control chars, keep printable ASCII + Unicode
            .trim();

        // Fallback to safe default if name becomes empty after sanitization
        if (!safeFolderName) {
            safeFolderName = 'folder';
        }

        // Limit length to prevent excessively long filenames
        if (safeFolderName.length > 200) {
            safeFolderName = safeFolderName.substring(0, 200);
        }

        // Build Content-Disposition header with proper encoding
        // For ASCII-only names, use simple format
        // For non-ASCII names, use RFC 5987 encoding (filename* parameter)
        const hasNonAscii = /[^\x20-\x7E]/.test(safeFolderName);

        if (hasNonAscii) {
            // RFC 5987: filename*=UTF-8''encoded-name
            const encodedName = encodeURIComponent(safeFolderName);
            res.setHeader('Content-Disposition', `attachment; filename="folder.zip"; filename*=UTF-8''${encodedName}.zip`);
        } else {
            // Simple ASCII filename
            res.setHeader('Content-Disposition', `attachment; filename="${safeFolderName}.zip"`);
        }

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archiver Error:', err);
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        archive.pipe(res);

        // Build folder path mapping for preserving structure
        const folderPathMap = {};
        const buildFolderPath = (folderId, allFolders) => {
            if (!folderId || folderId === id) return ''; // Root of download
            const currentFolder = allFolders.find(f => f.id === folderId);
            if (!currentFolder) return '';
            const parentPath = buildFolderPath(currentFolder.parent_id, allFolders);
            return parentPath ? `${parentPath}/${currentFolder.name}` : currentFolder.name;
        };

        // Pre-build paths for all target folders
        for (const fId of targetFolderIds) {
            if (fId !== id) { // Skip root folder itself
                const folderData = allFolders.find(f => f.id === fId);
                if (folderData) {
                    folderPathMap[fId] = buildFolderPath(fId, allFolders);
                }
            }
        }

        // Add empty directories for folder structure (like Google Drive)
        for (const fId of targetFolderIds) {
            if (fId !== id && folderPathMap[fId]) {
                archive.append('', { name: `${folderPathMap[fId]}/` }); // Trailing slash = directory
            }
        }

        // Add files to zip with proper paths
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const { data: fileData, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(file.storage_key);
                    if (downloadError) {
                        console.error(`Failed to download ${file.name}`, downloadError);
                        continue;
                    }
                    const arrayBuffer = await fileData.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Get folder path for this file
                    const folderPath = folderPathMap[file.folder_id] || '';
                    const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;

                    archive.append(buffer, { name: filePath });
                } catch (e) {
                    console.error(`Error processing file ${file.name}`, e);
                }
            }
        }

        await archive.finalize();

    } catch (error) {
        console.error('Download Folder Error:', error);
        if (!res.headersSent) res.status(400).json({ error: error.message });
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

exports.permanentDeleteFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Use ownership check instead of canEdit for deleted folders
        // canEdit may fail for trashed items, so we check ownership directly
        // This matches the pattern used in restoreFolder (lines 374-378)

        const { data: folder, error: fetchError } = await supabase
            .from('folders')
            .select('owner_id, is_deleted')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!folder) throw new Error('Folder not found');

        // Ownership check (only owner can permanently delete)
        if (folder.owner_id !== userId) throw new Error('Permission denied');
        if (!folder.is_deleted) {
            throw new Error('Folder must be in trash before permanent deletion');
        }

        // Get all descendant folders and files
        const { data: allFolders } = await supabase.from('folders').select('id, parent_id').eq('owner_id', userId);

        const getDescendantIds = (rootId, all) => {
            let ids = [rootId];
            let children = all.filter(f => f.parent_id === rootId);
            for (let child of children) {
                ids = ids.concat(getDescendantIds(child.id, all));
            }
            return ids;
        };

        const targetFolderIds = getDescendantIds(id, allFolders || []);

        // Get all files in these folders
        const { data: files } = await supabase
            .from('files')
            .select('id, storage_key')
            .in('folder_id', targetFolderIds);

        // Delete files atomically: DB first, then storage
        // This prevents orphaned DB records if deletion fails
        if (files && files.length > 0) {
            // Step 1: Delete files from database FIRST
            const { error: filesDbError } = await supabase
                .from('files')
                .delete()
                .in('id', files.map(f => f.id));

            if (filesDbError) throw filesDbError;

            // Step 2: Delete from storage ONLY after DB deletion succeeds
            // Storage deletion errors are logged but don't fail the operation
            // since the DB records are already removed
            const storagePaths = files.map(f => f.storage_key).filter(Boolean);
            if (storagePaths.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .remove(storagePaths);

                if (storageError) {
                    // Log the error but don't throw - DB is already cleaned up
                    console.error('Storage deletion error (non-fatal, DB already cleaned):', storageError);
                    console.error('Failed to delete storage paths:', storagePaths);
                }
            }
        }

        // Delete all folders from database
        const { error: foldersDbError } = await supabase
            .from('folders')
            .delete()
            .in('id', targetFolderIds);

        if (foldersDbError) throw foldersDbError;

        await activityLogger.logActivity(userId, 'permanent_delete', 'folder', id);

        res.status(200).json({ message: 'Folder permanently deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.permanentDeleteFolder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Use ownership check instead of canEdit for deleted folders
        // canEdit may fail for trashed items, so we check ownership directly
        // This matches the pattern used in restoreFolder (lines 374-378)

        const { data: folder, error: fetchError } = await supabase
            .from('folders')
            .select('owner_id, is_deleted')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!folder) throw new Error('Folder not found');

        // Ownership check (only owner can permanently delete)
        if (folder.owner_id !== userId) throw new Error('Permission denied');
        if (!folder.is_deleted) {
            throw new Error('Folder must be in trash before permanent deletion');
        }

        const { data: allFolders } = await supabase.from('folders').select('id, parent_id').eq('owner_id', userId);

        const getDescendantIds = (rootId, all) => {
            let ids = [rootId];
            let children = all.filter(f => f.parent_id === rootId);
            for (let child of children) {
                ids = ids.concat(getDescendantIds(child.id, all));
            }
            return ids;
        };

        const targetFolderIds = getDescendantIds(id, allFolders || []);

        const { data: files } = await supabase
            .from('files')
            .select('id, storage_key')
            .in('folder_id', targetFolderIds);

        // Delete files atomically: DB first, then storage
        // This prevents orphaned DB records if deletion fails
        if (files && files.length > 0) {
            // Step 1: Delete files from database FIRST
            const { error: filesDbError } = await supabase
                .from('files')
                .delete()
                .in('id', files.map(f => f.id));

            if (filesDbError) throw filesDbError;

            // Step 2: Delete from storage ONLY after DB deletion succeeds
            // Storage deletion errors are logged but don't fail the operation
            // since the DB records are already removed
            const storagePaths = files.map(f => f.storage_key).filter(Boolean);
            if (storagePaths.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .remove(storagePaths);

                if (storageError) {
                    // Log the error but don't throw - DB is already cleaned up
                    console.error('Storage deletion error (non-fatal, DB already cleaned):', storageError);
                    console.error('Failed to delete storage paths:', storagePaths);
                }
            }
        }

        const { error: foldersDbError } = await supabase
            .from('folders')
            .delete()
            .in('id', targetFolderIds);

        if (foldersDbError) throw foldersDbError;

        await activityLogger.logActivity(userId, 'permanent_delete', 'folder', id);

        res.status(200).json({ message: 'Folder permanently deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
