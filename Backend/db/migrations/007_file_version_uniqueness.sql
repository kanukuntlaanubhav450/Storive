-- 1. Deduplicate file_versions before applying the unique constraint
-- Keep only the record with the largest ID for each (file_id, version_number) pair
DELETE FROM file_versions a
USING file_versions b
WHERE a.file_id = b.file_id
  AND a.version_number = b.version_number
  AND a.id < b.id;

-- 2. Add unique constraint to file_versions to prevent duplicate version entries
alter table file_versions 
add constraint file_versions_file_id_version_number_key unique (file_id, version_number);
