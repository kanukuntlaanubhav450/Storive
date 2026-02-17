const supabase = require('../config/supabaseClient');
const permissionUtils = require('../utils/permissionUtils');
const activityLogger = require('../utils/activityLogger');

const STORAGE_BUCKET = 'drive';

exports.getRecent = async (req, res) => {
    const userId = req.user.id;
    try {
        // Fetch last 20 accessed/modified files
        const { data, error } = await supabase
            .from('files')
            .select('*')
            .eq('owner_id', userId)
            .eq('is_deleted', false)
            .order('updated_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.status(200).json({ files: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getStarred = async (req, res) => {
    const userId = req.user.id;
    try {
        const { data: folders, error: folderError } = await supabase
            .from('folders')
            .select('*')
            .eq('owner_id', userId)
            .eq('is_starred', true)
            .eq('is_deleted', false);

        if (folderError) throw folderError;

        const { data: files, error: fileError } = await supabase
            .from('files')
            .select('*')
            .eq('owner_id', userId)
            .eq('is_starred', true)
            .eq('is_deleted', false);

        if (fileError) throw fileError;

        res.status(200).json({ folders, files });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getTrash = async (req, res) => {
    const userId = req.user.id;
    try {
        const { data: folders, error: folderError } = await supabase
            .from('folders')
            .select('*')
            .eq('is_deleted', true)
            .eq('owner_id', userId);

        if (folderError) throw folderError;

        const { data: files, error: fileError } = await supabase
            .from('files')
            .select('*')
            .eq('is_deleted', true)
            .eq('owner_id', userId);

        if (fileError) throw fileError;

        res.status(200).json({ folders, files });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getShared = async (req, res) => {
    const userId = req.user.id;
    try {
        // Fetch shares where user is grantee
        const { data: shares, error } = await supabase
            .from('shares')
            .select('*')
            .eq('grantee_user_id', userId);

        if (error) throw error;

        // Process mixed results (some might be folders, some files)
        const folderIds = shares.filter(s => s.resource_type === 'folder').map(s => s.resource_id);
        const fileIds = shares.filter(s => s.resource_type === 'file').map(s => s.resource_id);

        let folders = [];
        let files = [];

        if (folderIds.length > 0) {
            const { data, error: folderError } = await supabase.from('folders').select('*').in('id', folderIds);
            if (folderError) {
                console.error('[GetShared] Error fetching shared folders:', folderError);
                throw folderError;
            }
            folders = data || [];
        }
        if (fileIds.length > 0) {
            const { data, error: fileError } = await supabase.from('files').select('*').in('id', fileIds);
            if (fileError) {
                console.error('[GetShared] Error fetching shared files:', fileError);
                throw fileError;
            }
            files = data || [];
        }

        res.status(200).json({ folders, files });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getStorage = async (req, res) => {
    const userId = req.user.id;
    try {
        const { data, error } = await supabase
            .from('files')
            .select('size_bytes')
            .eq('owner_id', userId)
            .eq('is_deleted', false);

        if (error) throw error;

        const totalBytes = data.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
        res.status(200).json({ totalBytes, limit: 10 * 1024 * 1024 * 1024 }); // Example 10GB limit
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.toggleStar = async (req, res) => {
    const { type, id } = req.body; // type: 'folder' | 'file'
    const userId = req.user.id;

    try {
        // Validate inputs
        if (!id) {
            return res.status(400).json({ error: 'ID is required' });
        }
        if (type !== 'folder' && type !== 'file') {
            return res.status(400).json({ error: "Type must be 'folder' or 'file'" });
        }

        const table = type === 'folder' ? 'folders' : 'files';

        // 1. Get current status
        const { data: item, error: fetchError } = await supabase
            .from(table)
            .select('is_starred, owner_id')
            .eq('id', id)
            .single();

        if (fetchError || !item) throw new Error('Item not found');
        if (item.owner_id !== userId) throw new Error('Permission denied'); // Simple ownership check for starring

        // 2. Toggle
        const newStatus = !item.is_starred;
        const { error: updateError } = await supabase
            .from(table)
            .update({ is_starred: newStatus })
            .eq('id', id);

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Updated', isStarred: newStatus });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.emptyTrash = async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Get files to delete to clean storage first
        // We select the storage_keys before deleting DB records
        const { data: filesToDelete, error: fetchError } = await supabase
            .from('files')
            .select('storage_key')
            .eq('is_deleted', true)
            .eq('owner_id', userId);

        if (fetchError) {
            console.error('[EmptyTrash] Error fetching files:', fetchError);
            throw fetchError;
        }

        // 2. Call the empty_trash RPC FIRST to ensure DB consistency
        // This atomically deletes DB records for folders and files.
        console.log(`[EmptyTrash] Calling empty_trash RPC for user: ${userId}`);
        const { error: rpcError } = await supabase.rpc('empty_trash', {
            p_owner_id: userId
        });

        if (rpcError) {
            console.error('[EmptyTrash] RPC DB deletion error:', rpcError);
            // Bail - do NOT attempt storage cleanup if DB deletion fails
            throw rpcError;
        }

        console.log(`[EmptyTrash] Database records cleaned successfully for user: ${userId}`);

        // 3. Delete files from storage ONLY after RPC succeeds
        // If storage removal fails, we log it but don't fail the request (DB is already clean)
        if (filesToDelete && filesToDelete.length > 0) {
            const paths = filesToDelete.map(f => f.storage_key).filter(Boolean);
            if (paths.length > 0) {
                console.log(`[EmptyTrash] Attempting to remove ${paths.length} files from storage...`);
                const { error: storageError } = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .remove(paths);

                if (storageError) {
                    console.error('[EmptyTrash] Storage cleanup warning (DB already clean):', storageError);
                    // Do NOT throw - we keep the success status because DB records are gone
                } else {
                    console.log(`[EmptyTrash] Storage cleaned successfully for user: ${userId}`);
                }
            }
        }

        res.status(200).json({ message: 'Trash emptied' });
    } catch (error) {
        console.error('[EmptyTrash] Error:', error);
        res.status(500).json({ error: error.message });
    }
};
