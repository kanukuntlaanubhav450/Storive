-- Create a function to empty trash for a user in a single transaction
-- This ensures that both files and folders are deleted atomically
CREATE OR REPLACE FUNCTION empty_trash(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, pg_catalog
AS $$
BEGIN
  -- Delete all trashed files for the user
  DELETE FROM public.files 
  WHERE owner_id = p_owner_id 
    AND is_deleted = true;

  -- Delete all trashed folders for the user
  DELETE FROM public.folders 
  WHERE owner_id = p_owner_id 
    AND is_deleted = true;
END;
$$;
