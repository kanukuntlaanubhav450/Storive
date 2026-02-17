-- 1. Enable extensions
create extension if not exists pg_trgm;

-- 2. Create Users Table (Public Profile)
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  image_url text,
  created_at timestamptz default now()
);

-- 3. Sync existing Auth users to Public Users (Fixes your current login)
-- This ensures that your currently logged-in user exists in the public table
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- 4. Create Folders Table
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references users(id) on delete cascade,
  parent_id uuid references folders(id) on delete set null,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Ensure unique names per folder per user
create unique index if not exists folders_unique_name on folders(owner_id, parent_id, name) where is_deleted = false;

-- 5. Create Files Table
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_key text unique not null,
  owner_id uuid references users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  version_id uuid,
  checksum text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_files_owner on files(owner_id);

-- 6. Create Pending Registrations (for OTP)
create table if not exists pending_registrations (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    name text not null,
    password_hash text not null,
    otp text not null,
    otp_expires_at timestamptz not null,
    created_at timestamptz default now()
);

-- 7. Shares Table
create table if not exists shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('file','folder')),
  resource_id uuid not null,
  grantee_user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('viewer','editor')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  unique(resource_type, resource_id, grantee_user_id)
);

-- 8. Activities Table
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null check (action in ('upload','rename','delete','restore','move','share','download')),
  resource_type text not null check (resource_type in ('file','folder')),
  resource_id uuid not null,
  context jsonb,
  created_at timestamptz default now()
);
