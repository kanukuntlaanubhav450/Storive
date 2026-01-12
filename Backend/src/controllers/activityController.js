const supabase = require('../config/supabaseClient');

exports.getRecentActivity = async (req, res) => {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    try {
        // Fetch activities where the user is the ACTOR 
        // OR where the resource belongs to the user (if we want to see who modified our stuff).
        // For simple "My Activity", just filter by actor_id.

        // Advanced: "Team Activity" -> show actions on files I own performed by others.
        // Let's implement a mix: Actions I did, OR actions on my files.
        // This requires a join or complex filter. For MVP: Actions *I* did or *involved* me.

        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .eq('actor_id', userId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (error) throw error;

        // Ideally we would verify details of the resource, but the log text is often enough.
        res.status(200).json({ activities: data });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
