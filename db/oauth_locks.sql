-- Distributed lock for OAuth token refresh (lease-based row lock).
--
-- Why: ATProto refresh tokens are single-use and rotate on every refresh. When
-- the poller (auto-post) and a browser session refresh the SAME user at nearly
-- the same time, one consumes the refresh token and the other presents the now
-- stale token -> `invalid_grant` -> the session is deleted ("session death").
-- The OAuth client serializes refreshes per-user IF a lock implementation is
-- provided (runtimeImplementation.requestLock). The in-isolate fallback lock
-- does NOT span Cloudflare Workers isolates, so we back the lock with the DB.
--
-- Run this ONCE against the Postgres behind PostgREST (schema `nowplayingat`).
-- Replace <postgrest_role> with the same role used to write nowplayingat tables
-- (the role PostgREST authenticates as for oauth_sessions writes).

create table if not exists nowplayingat.oauth_locks (
  name       text        primary key,
  owner      text        not null,
  expires_at timestamptz not null
);

-- Atomically acquire (or take over an expired) lock. Returns true on success.
-- INSERT ... ON CONFLICT is row-atomic, so concurrent callers cannot both win.
-- FOUND is true only when a row was actually inserted or updated (i.e. acquired).
create or replace function nowplayingat.try_acquire_lock(
  p_name text, p_owner text, p_ttl_ms int
) returns boolean
language plpgsql
as $$
begin
  insert into nowplayingat.oauth_locks (name, owner, expires_at)
  values (p_name, p_owner, now() + (p_ttl_ms || ' milliseconds')::interval)
  on conflict (name) do update
    set owner = excluded.owner,
        expires_at = excluded.expires_at
    where nowplayingat.oauth_locks.expires_at < now();
  return found;
end;
$$;

-- Release a lock we own. Owner check prevents releasing a lease that already
-- expired and was taken over by another worker.
create or replace function nowplayingat.release_lock(
  p_name text, p_owner text
) returns void
language sql
as $$
  delete from nowplayingat.oauth_locks
  where name = p_name and owner = p_owner;
$$;

-- Grants: allow the PostgREST role to use the table and RPCs.
grant usage on schema nowplayingat to anon_user;
grant select, insert, update, delete on nowplayingat.oauth_locks to anon_user;
grant execute on function nowplayingat.try_acquire_lock(text, text, int) to anon_user;
grant execute on function nowplayingat.release_lock(text, text) to anon_user;

-- PostgREST caches the schema; reload so the new RPCs are exposed immediately:
notify pgrst, 'reload schema';
