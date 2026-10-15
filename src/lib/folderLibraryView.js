import { sortLibraryItems } from './librarySort.js';

export function selectFolderLibraryItems(items, { search = '', tags = [], tagMode = 'all', folder = '', sort = 'name' } = {}) {
  const terms = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const selected = items.filter((item) => {
    const haystack = [item.name, item.description, item.folder, ...item.tags].join(' ').toLocaleLowerCase();
    const hasTag = (tag) => item.tags.some((value) => value === tag || value.startsWith(`${tag}/`));
    return terms.every((term) => haystack.includes(term)) &&
      (!folder || item.folder === folder || item.folder.startsWith(`${folder}/`)) &&
      (!tags.length || (tagMode === 'any' ? tags.some(hasTag) : tags.every(hasTag)));
  });
  return sortLibraryItems(selected, sort, { compareCreatedAt: (a, b, direction) => {
    const date = (value) => typeof value === 'number' ? value : Date.parse(value) || 0;
    const delta = date(a.createdAt) - date(b.createdAt);
    return direction === 'asc' ? delta : -delta;
  } });
}

export function folderLibraryTagOptions(items) {
  const tags = new Set();
  for (const item of items) for (const tag of item.tags) {
    const parts = tag.split('/');
    parts.forEach((_, index) => tags.add(parts.slice(0, index + 1).join('/')));
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}
