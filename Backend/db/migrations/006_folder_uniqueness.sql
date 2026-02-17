-- Migration: Fix Folder Name Uniqueness
-- 1. Drop the flawed existing index
-- This index failed for root folders because NULL parent_id is not considered equal in standard unique constraints.
DROP INDEX IF EXISTS folders_unique_name;

-- 2. Create partial unique index for root folders
-- Ensures unique folder names for a user where there is no parent folder.
CREATE UNIQUE INDEX folders_unique_name_root 
ON folders (owner_id, name) 
WHERE parent_id IS NULL AND is_deleted = false;

-- 3. Create partial unique index for child folders
-- Ensures unique folder names within each parent folder.
CREATE UNIQUE INDEX folders_unique_name_child 
ON folders (owner_id, parent_id, name) 
WHERE parent_id IS NOT NULL AND is_deleted = false;
