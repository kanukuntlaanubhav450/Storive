const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Debug logging (Gated for security)
if (process.env.DEBUG_SUPABASE === 'true') {
    const isServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('--- Supabase Client Config ---');
    console.log('URL:', supabaseUrl);
    console.log('Using Service Role Key?', isServiceRole ? '✅ YES (Bypasses RLS)' : '❌ NO (Limited by RLS)');
    if (!isServiceRole && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is defined but NOT being used!');
    }
    console.log('---------------------------');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
