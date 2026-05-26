function getCollapsedGroupsStorageKey(storageKey = "default") {
  return `tag-tree-collapsed:${storageKey}`;
}

export function normalizeTagTreeCollapsedGroups(value, storageKey = "default") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const keyPrefix = `${storageKey}:`;

  return Object.fromEntries(
    Object.entries(value).filter(([groupKey, isCollapsed]) =>
      typeof groupKey === "string" && groupKey.startsWith(keyPrefix) && typeof isCollapsed === "boolean"
    )
  );
}

export function loadStoredTagTreeCollapsedGroups(storageKey = "default", storage = globalThis?.window?.localStorage) {
  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(getCollapsedGroupsStorageKey(storageKey));

    if (!rawValue) {
      return {};
    }

    return normalizeTagTreeCollapsedGroups(JSON.parse(rawValue), storageKey);
  } catch {
    return {};
  }
}

export function saveStoredTagTreeCollapsedGroups(
  storageKey = "default",
  collapsedGroups = {},
  storage = globalThis?.window?.localStorage
) {
  if (!storage) {
    return;
  }

  const normalizedCollapsedGroups = normalizeTagTreeCollapsedGroups(collapsedGroups, storageKey);

  try {
    if (!Object.keys(normalizedCollapsedGroups).length) {
      storage.removeItem(getCollapsedGroupsStorageKey(storageKey));
      return;
    }

    storage.setItem(
      getCollapsedGroupsStorageKey(storageKey),
      JSON.stringify(normalizedCollapsedGroups)
    );
  } catch {
    // Best-effort UI persistence only.
  }
}
