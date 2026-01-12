const supabase = require('../config/supabaseClient');

exports.searchItems = async (req, res) => {
    const { q, type } = req.query; // q=searchterm, type=folder|file|all
    const userId = req.user.id;

    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    try {
        const results = { folders: [], files: [] };

        // Search Folders
        if (type === 'folder' || !type || type === 'all') {
            const { data: folders, error } = await supabase
                .from('folders')
                .select('*')
                .eq('owner_id', userId) // Restrict to owned items for now (simplest search)
                .ilike('name', `%${q}%`)
                .eq('is_deleted', false)
                .limit(20);

            if (error) throw error;
            results.folders = folders || [];
        }

        // Search Files
        if (type === 'file' || !type || type === 'all') {
            const { data: files, error } = await supabase
                .from('files')
                .select('*')
                .eq('owner_id', userId)
                .ilike('name', `%${q}%`)
                .eq('is_deleted', false)
                .limit(20);

            if (error) throw error;
            results.files = files || [];
        }

        res.status(200).json(results);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
