# Sync/Cloud v1

OA = Outfit-App
MBA = Moodboard-App

This document defines the first practical sync/cloud implementation for OA and MBA.

The goal is to move from browser-only persistence toward a sync-ready architecture without breaking current local-first behavior.

---

# **Core v1 decisions**

- IndexedDB remains the runtime source and offline cache on each device.
- Cloud becomes the durable sync target and sync source across devices.
- Preview assets sync first.
- Originals remain optional and deferred.
- `itemUuid` is the canonical cloud identity.
- `id` remains legacy/local-active during transition.
- OA and MBA remain separate apps.
- The hub is a resolver/router, not a workflow owner.
- No collaboration or public sharing in v1.
- Conflict handling is last-write-wins in v1 with explicit timestamps and device metadata.

---

# **v1 scope**

## **Included**

- private authenticated per-user cloud libraries
- outbound and inbound sync for durable app-owned records
- preview asset upload/download
- background sync that preserves current local behavior when offline
- additive sync metadata stored locally
- explicit first-device bootstrap/account-attach flow
- tombstone-based delete sync
- per-app payload builders for:
    - OA item
    - OA saved outfit
    - MBA reference
    - MBA board

## **First synced entities**

### **OA**

- wardrobe items
- saved outfits

### **MBA**

- references
- boards

### **Cross-app**

- additive hub link records when available

## **Local-first runtime rule**

- the app continues reading and writing IndexedDB first
- cloud success must not be required for normal local use
- sync runs as background replication, not as the primary runtime persistence path

---

# **Non-goals**

- collaborative editing
- public boards or sharing links
- original asset sync
- hard dependency on network availability
- hub-owned outfit editing
- hub-owned board editing
- real-time multiplayer
- field-level merge resolution
- server-side generation logic
- replacing backup/export flows
- abrupt UUID-only runtime lookup cutover
- merging OA and MBA into a single app

---

# **Supabase schema**

## **Conventions**

- all app-owned tables are per-user
- `item_uuid` is the stable cloud identity for item-like entities
- `legacy_id` preserves current local/runtime ids
- `payload` stores app-owned record data without flattening domain-specific behavior
- `deleted_at` is used for tombstones
- `client_updated_at` stores the app-generated authoritative LWW timestamp
- `server_received_at` stores ingestion time for auditing/debugging
- `last_modified_by_device` stores the device that last won the LWW write

## **Extensions**

```sql
create extension if not exists pgcrypto;
```

## **Profiles**

```sql
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## **Assets**

```sql
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('oa', 'mba')),
  asset_kind text not null check (asset_kind in ('preview')),
  storage_provider text not null default 'r2',
  storage_bucket text not null,
  storage_key text not null,
  mime_type text not null default '',
  byte_size bigint not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  sha256 text not null default '',
  source_item_uuid text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  unique (user_id, storage_key)
);

create index assets_user_app_idx on public.assets (user_id, app);
create index assets_user_item_uuid_idx on public.assets (user_id, source_item_uuid);
create index assets_user_deleted_idx on public.assets (user_id, deleted_at);
```

## **OA items**

```sql
create table public.oa_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_uuid text not null,
  legacy_id text not null default '',
  preview_asset_id uuid null references public.assets(id) on delete set null,
  image_url_mirror text not null default '',
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  last_modified_by_device text not null default '',
  unique (user_id, item_uuid)
);

create index oa_items_user_updated_idx on public.oa_items (user_id, client_updated_at desc);
create index oa_items_user_deleted_idx on public.oa_items (user_id, deleted_at);
create index oa_items_user_legacy_idx on public.oa_items (user_id, legacy_id);
```

## **OA saved outfits**

```sql
create table public.oa_saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  outfit_uuid text not null,
  legacy_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  last_modified_by_device text not null default '',
  unique (user_id, outfit_uuid)
);

create index oa_saved_outfits_user_updated_idx on public.oa_saved_outfits (user_id, client_updated_at desc);
create index oa_saved_outfits_user_deleted_idx on public.oa_saved_outfits (user_id, deleted_at);
create index oa_saved_outfits_user_legacy_idx on public.oa_saved_outfits (user_id, legacy_id);
```

## **MBA references**

```sql
create table public.mba_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_uuid text not null,
  legacy_id text not null default '',
  preview_asset_id uuid null references public.assets(id) on delete set null,
  image_url_mirror text not null default '',
  payload jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  last_modified_by_device text not null default '',
  unique (user_id, item_uuid)
);

create index mba_references_user_updated_idx on public.mba_references (user_id, client_updated_at desc);
create index mba_references_user_deleted_idx on public.mba_references (user_id, deleted_at);
create index mba_references_user_legacy_idx on public.mba_references (user_id, legacy_id);
```

## **MBA boards**

```sql
create table public.mba_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_uuid text not null,
  legacy_id text not null default '',
  payload jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  last_modified_by_device text not null default '',
  unique (user_id, board_uuid)
);

create index mba_boards_user_updated_idx on public.mba_boards (user_id, client_updated_at desc);
create index mba_boards_user_deleted_idx on public.mba_boards (user_id, deleted_at);
create index mba_boards_user_legacy_idx on public.mba_boards (user_id, legacy_id);
```

## **Hub links**

```sql
create table public.hub_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_type text not null,
  source_app text not null check (source_app in ('oa', 'mba')),
  target_app text not null check (target_app in ('oa', 'mba')),
  source_item_uuid text not null default '',
  target_item_uuid text not null default '',
  source_legacy_id text not null default '',
  target_legacy_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  client_created_at timestamptz not null,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  last_modified_by_device text not null default '',
  unique (user_id, link_type, source_item_uuid, target_item_uuid)
);

create index hub_links_user_updated_idx on public.hub_links (user_id, client_updated_at desc);
create index hub_links_user_deleted_idx on public.hub_links (user_id, deleted_at);
```

## **Device sync state**

```sql
create table public.device_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null check (app in ('oa', 'mba')),
  device_id text not null,
  last_push_cursor timestamptz null,
  last_pull_cursor timestamptz null,
  last_successful_push_at timestamptz null,
  last_successful_pull_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app, device_id)
);
```

---

# **RLS rules outline**

Enable RLS on every public table above.

Base policy pattern:

- authenticated users can only `select`, `insert`, `update`, and soft-delete rows where `user_id = auth.uid()`
- no cross-user reads
- no anonymous access
- asset rows follow the same ownership rule

Representative pattern:

```sql
alter table public.oa_items enable row level security;

create policy "oa_items_select_own"
on public.oa_items
for select
to authenticated
using (user_id = auth.uid());

create policy "oa_items_insert_own"
on public.oa_items
for insert
to authenticated
with check (user_id = auth.uid());

create policy "oa_items_update_own"
on public.oa_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

Apply the same shape to:

- `user_profiles`
- `assets`
- `oa_items`
- `oa_saved_outfits`
- `mba_references`
- `mba_boards`
- `hub_links`
- `device_sync_state`

Additional RLS notes:

- signed R2 upload/download URLs should only be issued after server-side ownership checks
- service-role jobs may bypass RLS for internal asset cleanup, but client apps must not
- hard deletes should remain server-only maintenance operations, not client-exposed behavior in v1

---

# **R2 asset key strategy**

## **Bucket layout**

- private bucket
- preview assets only in v1
- originals excluded from v1 sync

## **Key shape**

```txt
users/{userId}/{app}/preview/{itemUuid}/{sha256}.{ext}
```

Examples:

```txt
users/9f.../oa/preview/3aa1.../f84c....webp
users/9f.../mba/preview/7bb2.../19ad....jpg
```

## **Rules**

- `itemUuid` scopes the asset to the stable entity identity
- `sha256` makes the key content-specific and retry-safe
- file extension should match the stored preview mime type when possible
- asset replacement creates a new key rather than overwriting in place
- old preview objects can be garbage-collected later once no rows reference them

## **Why this shape**

- avoids collisions across users
- avoids collisions across OA and MBA
- allows multiple preview revisions over time
- keeps object paths deterministic enough for debugging
- avoids using mutable legacy `id` in the storage path

---

# **Local sync metadata shape**

Store sync metadata in a separate local sync store or equivalent repository boundary. Do not mix it into app-owned domain records unless necessary for transition.

```js
{
  deviceId: "",
  app: "oa" | "mba",
  lastPushCursor: "",
  lastPullCursor: "",
  records: {
    "<entityType>:<stableKey>": {
      entityType: "oaItem" | "oaSavedOutfit" | "mbaReference" | "mbaBoard" | "hubLink",
      stableKey: "",
      localId: "",
      itemUuid: "",
      syncStatus: "pending_upload" | "synced" | "pending_delete" | "error",
      lastLocalChangeAt: "",
      lastSyncedAt: "",
      lastRemoteClientUpdatedAt: "",
      lastRemoteServerReceivedAt: "",
      lastModifiedByDevice: "",
      retryCount: 0,
      lastErrorCode: "",
      lastErrorAt: "",
      previewAsset: {
        sha256: "",
        mimeType: "",
        byteSize: 0,
        width: 0,
        height: 0,
        uploadStatus: "pending" | "uploaded" | "error",
        storageKey: "",
        assetRowId: ""
      }
    }
  }
}
```

## **Rules**

- `stableKey` should use `itemUuid` or the equivalent stable entity UUID when available
- `localId` preserves the legacy/runtime key needed by current app behavior
- local metadata must not replace app-owned timestamps or provenance
- local sync metadata is disposable/rebuildable from local data plus cloud state

---

# **Outbound sync flow**

## **Trigger conditions**

- app start when authenticated
- local create/update/delete of a syncable entity
- explicit user sync action if later added
- reconnect after offline period

## **Flow**

1. User edits a local record.
2. App writes the domain record to IndexedDB first.
3. App updates local sync metadata for that record to `pending_upload` or `pending_delete`.
4. Sync worker scans pending records.
5. Sync worker builds the per-app cloud payload.
6. If a preview asset changed and is not yet uploaded:
   - compute or reuse `sha256`
   - request signed upload URL
   - upload preview to R2
   - upsert `assets` row metadata
7. Upsert the record into its app-owned Supabase table using:
   - stable cloud identity
   - `client_updated_at`
   - `last_modified_by_device`
   - `preview_asset_id` if applicable
8. On success:
   - update local sync metadata to `synced`
   - store remote timestamps/cursors
9. On failure:
   - preserve local record
   - mark sync metadata `error`
   - schedule retry

## **Delete flow**

1. Local delete writes through current local behavior first.
2. Sync metadata marks the record `pending_delete`.
3. Outbound sync writes `deleted_at` in the remote row instead of hard deleting.
4. Local metadata becomes `synced` after remote tombstone confirmation.

---

# **Inbound sync flow**

## **Trigger conditions**

- app start when authenticated
- periodic background pull while authenticated
- manual refresh if later added
- immediately after successful outbound sync batch

## **Flow**

1. Read the last pull cursor for the current app/device.
2. Query each relevant remote table for rows with:
   - `server_received_at` greater than the last pull cursor
   - including tombstoned rows
3. For each remote row:
   - locate the local record by stable identity first
   - retain `legacy_id` locally if runtime still depends on it
4. Compare remote `client_updated_at` with local authoritative edit timestamp.
5. Apply v1 conflict rules.
6. If remote wins:
   - rehydrate/update the local IndexedDB record
   - download preview asset when required for normal rendering
   - update local sync metadata
7. If local wins:
   - keep local record as-is
   - leave or return the sync metadata to outbound pending state
8. If the remote row is tombstoned and remote wins:
   - remove or tombstone the local record according to current app behavior
9. Advance the local pull cursor after the batch succeeds.

## **Local rehydration rule**

- inbound sync must write records back into existing local stores so runtime behavior continues unchanged
- local-only app state must not be overwritten by inbound record sync

---

# **Bootstrap/account-attach flow**

## **Goals**

- avoid silent destructive merges
- preserve existing local-only use
- make first cloud attachment explicit

## **First authenticated device**

When a signed-in user has no remote rows yet:

1. Detect empty remote library for that app.
2. Offer:
   - use this device as the initial cloud source
   - keep local-only for now
3. If user chooses cloud bootstrap:
   - mark all local syncable records `pending_upload`
   - upload previews
   - push all records
   - create device sync state row

## **Device with existing cloud library**

When a signed-in user already has remote rows:

1. Detect non-empty remote library.
2. If the local device is empty:
   - pull cloud data immediately after confirmation
3. If both local and remote contain data:
   - do not auto-merge silently
   - present explicit choice:
     - upload this device and overwrite remote winners by timestamp as records sync
     - pull cloud into this device
     - stay local-only until resolved

## **v1 safety rule**

- no fully automatic bidirectional first-attach merge
- the user must explicitly choose the initial direction when both sides already contain data

---

# **Conflict rules**

## **v1 strategy**

- last-write-wins per record
- compare `client_updated_at` first
- use `last_modified_by_device` for auditability
- use `server_received_at` only as a deterministic tie-breaker

## **Rules**

1. Stable identity matching uses `itemUuid` or the app-specific stable UUID first.
2. `legacy_id` is compatibility metadata, not cloud authority.
3. Newer `client_updated_at` wins.
4. If `client_updated_at` is identical, newer `server_received_at` wins.
5. If both are identical, lexicographically greater `last_modified_by_device` may act as final deterministic tie-breaker.
6. Tombstone rows participate in LWW like any other record.
7. Conflicts are resolved per record, not per field.

## **Implications**

- simultaneous edits on two devices can overwrite one another
- v1 prioritizes predictable behavior and simplicity over granular merge intelligence
- app-owned payload builders must preserve unknown fields to reduce accidental loss on overwrite

---

# **Failure/retry rules**

## **General**

- local writes never roll back because cloud sync failed
- sync failures must be visible in local sync metadata
- retries should be automatic with backoff

## **Retry policy**

- retry transient network failures automatically
- retry signed URL expiration failures by requesting a fresh signed URL
- retry Supabase write failures when they are transport-level or rate-limit related
- stop automatic retries for repeated 4xx ownership/validation failures and surface an actionable error state

## **Backoff**

- use exponential backoff with jitter
- keep retries bounded per session
- retry again on next app launch or reconnect

## **Partial failure handling**

### **Asset uploaded, row write failed**

- keep asset metadata in local sync state as uploaded
- retry row upsert without re-uploading when the hash/key match

### **Row written, asset upload failed**

- row should not point at a missing preview asset reference
- retry asset upload first, then retry row upsert with the asset reference

### **Inbound download failed**

- keep remote metadata applied if safe
- preserve existing local preview if present
- mark the asset download as pending/error for retry

---

# **Per-app payload builders**

These builders are cloud payload adapters. They should preserve app-specific data, preserve unknown fields where possible, and avoid changing current runtime ownership boundaries.

## **OA item**

### **Source**

- local OA item record

### **Stable identity**

- canonical: `itemUuid`
- compatibility: `id` -> `legacy_id`

### **Payload shape**

```js
{
  item_uuid: item.itemUuid,
  legacy_id: item.id ?? "",
  preview_asset_id: "<resolved asset row id or null>",
  image_url_mirror: item.imageUrl ?? item.images?.preview?.src ?? "",
  payload: {
    ...item,
    id: item.id,
    itemUuid: item.itemUuid,
    imageUrl: item.imageUrl ?? item.images?.preview?.src ?? ""
  },
  provenance: {
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    importedAt: item.importedAt ?? "",
    sourceOriginalFilename: item.sourceOriginalFilename ?? "",
    sourceNamespace: item.sourceNamespace ?? "",
    sourceRelativePath: item.sourceRelativePath ?? "",
    importSource: item.importSource ?? "",
    relinkStatus: item.relinkStatus ?? "unknown"
  },
  client_created_at: item.createdAt,
  client_updated_at: item.updatedAt,
  last_modified_by_device: "<deviceId>"
}
```

## **OA saved outfit**

### **Source**

- local OA saved outfit/app-state record

### **Stable identity**

- canonical: `outfitUuid` if present, otherwise additive stable UUID must be introduced before sync rollout
- compatibility: local saved outfit `id` -> `legacy_id`

### **Payload shape**

```js
{
  outfit_uuid: outfit.outfitUuid,
  legacy_id: outfit.id ?? "",
  payload: {
    ...outfit,
    id: outfit.id,
    outfitUuid: outfit.outfitUuid,
    outfitItemUuids: outfit.outfitItemUuids ?? {},
    outfitItemIds: outfit.outfitItemIds ?? {}
  },
  client_created_at: outfit.createdAt,
  client_updated_at: outfit.updatedAt,
  last_modified_by_device: "<deviceId>"
}
```

### **Important compatibility rule**

- payload should preserve both UUID sidecars and current `id`-based relationships while runtime still resolves by `id`

## **MBA reference**

### **Source**

- local MBA reference item

### **Stable identity**

- canonical: `itemUuid`
- compatibility: `id` -> `legacy_id`

### **Payload shape**

```js
{
  item_uuid: reference.itemUuid,
  legacy_id: reference.id ?? "",
  preview_asset_id: "<resolved asset row id or null>",
  image_url_mirror: reference.imageUrl ?? reference.images?.preview?.src ?? "",
  payload: {
    ...reference,
    id: reference.id,
    itemUuid: reference.itemUuid,
    imageUrl: reference.imageUrl ?? reference.images?.preview?.src ?? ""
  },
  provenance: {
    createdAt: reference.createdAt ?? "",
    updatedAt: reference.updatedAt ?? "",
    importedAt: reference.importedAt ?? "",
    sourceOriginalFilename: reference.sourceOriginalFilename ?? "",
    sourceNamespace: reference.sourceNamespace ?? "",
    sourceRelativePath: reference.sourceRelativePath ?? "",
    importSource: reference.importSource ?? "",
    relinkStatus: reference.relinkStatus ?? "unknown"
  },
  client_created_at: reference.createdAt,
  client_updated_at: reference.updatedAt,
  last_modified_by_device: "<deviceId>"
}
```

## **MBA board**

### **Source**

- local MBA board record

### **Stable identity**

- canonical: `boardUuid` if present, otherwise additive stable UUID must be introduced before sync rollout
- compatibility: `id` -> `legacy_id`

### **Payload shape**

```js
{
  board_uuid: board.boardUuid,
  legacy_id: board.id ?? "",
  payload: {
    ...board,
    id: board.id,
    boardUuid: board.boardUuid,
    images: (board.images ?? []).map((image) => ({
      ...image,
      referenceId: image.referenceId ?? "",
      referenceItemUuid: image.referenceItemUuid ?? ""
    }))
  },
  client_created_at: board.createdAt,
  client_updated_at: board.updatedAt,
  last_modified_by_device: "<deviceId>"
}
```

### **Important compatibility rule**

- board payloads must preserve current `referenceId` behavior while carrying additive `referenceItemUuid` metadata for future stable relinking

---

# **Migration phases**

## **Phase 0: preconditions**

- keep current IndexedDB runtime unchanged
- finish any missing additive stable UUID fields required for syncable entity types
- confirm normalized payload builders for OA and MBA records

## **Phase 1: cloud infrastructure**

- create Supabase tables
- enable RLS
- create server route or function layer for signed R2 URLs
- provision private R2 bucket

## **Phase 2: local sync metadata**

- add sync metadata store/repository
- add device ID generation/persistence
- add pending upload/delete tracking

## **Phase 3: preview asset pipeline**

- hash preview assets
- upload previews
- upsert `assets` rows
- preserve current local preview rendering

## **Phase 4: outbound sync**

- push OA items and saved outfits
- push MBA references and boards
- record cursors and per-record sync state

## **Phase 5: inbound sync**

- pull changed rows
- rehydrate IndexedDB
- apply LWW conflict resolution
- support tombstones

## **Phase 6: bootstrap/account-attach UI**

- detect empty vs non-empty remote library
- add explicit first-sync direction choice
- prevent silent destructive merge

## **Phase 7: hub read-side**

- sync additive hub links
- use hub as resolver/router only
- do not move ownership of app workflows

---

# **First implementation checklist**

## **Shared**

- define stable UUID requirements for every syncable entity type
- define local sync metadata repository boundary
- define signed upload/download server endpoints
- define LWW utilities and timestamp comparison helpers
- define tombstone behavior per entity type

## **OA**

- confirm OA saved outfits have additive stable UUIDs
- implement OA item payload builder
- implement OA saved outfit payload builder
- verify local rehydration does not break `id`-based outfit runtime behavior

## **MBA**

- confirm MBA boards have additive stable UUIDs
- implement MBA reference payload builder
- implement MBA board payload builder
- verify local rehydration preserves `referenceId` behavior and `referenceItemUuid` sidecars

## **Infra**

- create Supabase migrations for all v1 tables
- apply RLS policies
- provision private R2 bucket
- implement asset metadata upsert flow
- implement device sync state row lifecycle

## **Sync runtime**

- implement outbound queue processing
- implement inbound cursor-based pulls
- implement retry/backoff
- implement partial-failure recovery
- implement bootstrap/account-attach flow

## **Verification**

- test offline create/update/delete then reconnect sync
- test same-user multi-device sync
- test remote tombstone pull
- test asset upload retry without duplicate row corruption
- test conflict overwrite behavior explicitly
- test local-only state remains local-only

---

# **Open questions**

- Do OA saved outfits already have a stable additive UUID field everywhere, or does v1 need an explicit `outfitUuid` migration first?
- Do MBA boards already have a stable additive UUID field everywhere, or does v1 need an explicit `boardUuid` migration first?
- Should `hub_links` ship in the first sync rollout or immediately after the core app-owned entities are stable?
- Should preview download happen eagerly on inbound sync or lazily on first render miss?
- Should cloud bootstrap allow per-app choice, or should a signed-in user attach OA and MBA independently in v1?
- Should asset deduplication be purely hash-based in v1, or deferred to later cleanup jobs?
