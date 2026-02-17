-- Migration: Harden Shares Table
-- 1. Enforce NOT NULL on grantee_user_id
-- This ensures every share record is associated with a specific user.

-- We use a block to handle the archival and deletion safely
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    -- Acquire exclusive lock to prevent concurrent inserts during migration
    LOCK TABLE public.shares IN ACCESS EXCLUSIVE MODE;

    -- Count orphaned shares
    SELECT COUNT(*) INTO orphaned_count FROM public.shares WHERE grantee_user_id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % orphaned shares. Archiving and removing...', orphaned_count;
        
        -- Create archive table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.shares_archive (LIKE public.shares INCLUDING ALL);
        
        -- Archive the orphaned rows
        INSERT INTO public.shares_archive 
        SELECT * FROM public.shares WHERE grantee_user_id IS NULL;
        
        -- Delete the orphaned rows
        DELETE FROM public.shares WHERE grantee_user_id IS NULL;
        
        RAISE NOTICE 'Orphaned shares archived to public.shares_archive and removed from public.shares.';
    ELSE
        RAISE NOTICE 'No orphaned shares found. Proceeding with migration...';
    END IF;

    -- Apply the constraint
    ALTER TABLE public.shares ALTER COLUMN grantee_user_id SET NOT NULL;
END $$;

-- 2. Add composite index for optimized permission lookups
-- This speeds up queries that find all shares for a specific file or folder.
CREATE INDEX IF NOT EXISTS idx_shares_resource ON shares (resource_type, resource_id);
