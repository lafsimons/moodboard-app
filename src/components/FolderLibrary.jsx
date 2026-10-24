import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { folderLibraryTagOptions, selectFolderLibraryItems } from '../lib/folderLibraryView.js';
import { getReferencePreviewNavigation } from '../lib/referencePreview.js';
import './FolderLibrary.css';
import FolderBoardWorkspace from './FolderBoardWorkspace.jsx';
import useFolderBoards from '../hooks/useFolderBoards.js';
import FolderLibrarySync from './FolderLibrarySync.jsx';
import FolderFilterTree from './FolderFilterTree.jsx';

const LOAD_BATCH_SIZE = 80;
const badge = (item) => !item.assets.image ? 'Image unavailable' : item.imageKind === 'preview-fallback' ? 'Preview fallback' : '';

function LibraryImage({ item, large = false }) {
  const [failed, setFailed] = useState(false);
  const desktop = item.assets['image-thumbs']?.url;
  const mobile = item.assets['image-thumbs-mobile']?.url;
  const src = large ? desktop || item.assets.image?.url : mobile || desktop || item.assets.image?.url;
  const dimensions = item.assets['image-thumbs'] || item.assets.image || item.assets['image-thumbs-mobile'];
  if (!src || failed) return <span className="folder-image-missing">Image unavailable</span>;
  return <picture>
    {!large && desktop && mobile ? <source media="(min-width: 768px)" srcSet={desktop} /> : null}
    <img src={src} width={dimensions?.width} height={dimensions?.height} alt={item.name} loading={large ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
  </picture>;
}

const metadataDraft = (item) => ({ name: item.name, description: item.description, tags: item.tags.join('\n'), favorite: item.favorite });

function ItemViewer({ item, navigation, onSelect, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => metadataDraft(item));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(metadataDraft(item));
  const update = (field, value) => { setDraft((current) => ({ ...current, [field]: value })); setMessage(''); };
  const leave = (action) => { if (!busy && (!dirty || window.confirm('Discard unsaved metadata changes?'))) action(); };
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/__folder-library/items/${encodeURIComponent(item.itemUuid)}/metadata`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: item.metadataRevision, metadata: { ...draft, tags: draft.tags === item.tags.join('\n') ? item.tags : [...new Set(draft.tags.split('\n').map((tag) => tag.trim()).filter(Boolean))] } })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Metadata could not be saved.');
      onSaved(result); setDraft(metadataDraft(result)); setMessage('Saved to library metadata.');
    } catch (failure) { setError(failure.message || 'Save failed. Your draft is still here.'); }
    finally { setBusy(false); }
  }
  async function loadSaved() {
    if (busy || (dirty && !window.confirm('Replace your draft with the saved metadata?'))) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/__folder-library/catalog', { cache: 'no-store' });
      if (!response.ok) throw new Error('The saved metadata could not be loaded.');
      const result = (await response.json()).items.find((entry) => entry.itemUuid === item.itemUuid);
      if (!result) throw new Error('This image is no longer registered. Your draft is still here.');
      onSaved(result); setDraft(metadataDraft(result)); setMessage('Loaded saved metadata.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    return () => { element.close(); trigger?.focus?.(); };
  }, []);
  return <dialog className="folder-viewer" ref={dialog} onCancel={(event) => { event.preventDefault(); leave(onClose); }} aria-labelledby="folder-item-title">
    <header>
      <button className="secondary-button" disabled={busy} onClick={() => leave(onClose)}>Close preview</button>
      <span>{navigation.activeIndex >= 0 ? `${navigation.activeIndex + 1} / ${navigation.total}` : 'Outside current filters'}</span>
      <button className="secondary-button" disabled={busy || !navigation.hasPrevious} onClick={() => leave(() => onSelect(navigation.previousItem.id))}>Previous</button>
      <button className="secondary-button" disabled={busy || !navigation.hasNext} onClick={() => leave(() => onSelect(navigation.nextItem.id))}>Next</button>
    </header>
    <div className="folder-viewer-body">
      <div className="folder-viewer-image"><LibraryImage key={item.id} item={item} large /></div>
      <section>
        <p className="eyebrow">Library metadata</p>
        <h2 id="folder-item-title">{item.name || 'Untitled'}</h2>
        <p>{item.folder}</p>
        {badge(item) ? <p className="folder-status">{badge(item)} — {item.imageKind === 'preview-fallback' ? 'the original is unresolved.' : 'metadata is preserved.'}</p> : null}
        <form className="folder-metadata-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="folder-metadata-field"><label htmlFor="folder-edit-name">Name</label><input id="folder-edit-name" value={draft.name} maxLength={1000} onChange={(event) => update('name', event.target.value)} /></div>
            <div className="folder-metadata-field"><label htmlFor="folder-edit-description">Description</label><textarea id="folder-edit-description" rows={4} value={draft.description} maxLength={20000} onChange={(event) => update('description', event.target.value)} /></div>
            <div className="folder-metadata-field"><label htmlFor="folder-edit-tags">Tags (one per line)</label><textarea id="folder-edit-tags" rows={5} value={draft.tags} onChange={(event) => update('tags', event.target.value)} /></div>
            <label className="folder-favorite"><input type="checkbox" checked={draft.favorite} onChange={(event) => update('favorite', event.target.checked)} />Favorite</label>
          </fieldset>
          <p className="folder-library-note">Tags can describe several categories. Editing metadata keeps the image in its current folder.</p>
          <div className="folder-metadata-actions">
            <button type="submit" className="primary-button" disabled={busy || !dirty}>Save metadata</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={loadSaved}>Load saved version</button>
          </div>
          <p role="status">{busy ? 'Working…' : dirty ? 'Unsaved changes' : message || 'Saved metadata'}</p>
          {error ? <p role="alert">{error}</p> : null}
        </form>
        <p className="folder-item-id">ID: {item.itemUuid}</p>
        {item.assets.image ? <a href={item.assets.image.url} target="_blank" rel="noreferrer">{item.imageKind === 'original' ? 'Open original image' : 'Open available preview'}</a> : null}
      </section>
    </div>
  </dialog>;
}

export default function FolderLibrary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagMode, setTagMode] = useState('all');
  const [folder, setFolder] = useState('');
  const [sort, setSort] = useState('name');
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH_SIZE);
  const scrollRoot = useRef(null);
  const loadMore = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [viewMode, setViewMode] = useState('library');
  const [gridSize, setGridSize] = useState('medium');
  const restoreBoardFilters = useCallback((filters) => {
    setSearch(filters.search); setTags(filters.tags); setFolder(filters.folder); setTagMode(filters.tagMode); setSort(filters.sort);
  }, []);
  const boards = useFolderBoards(restoreBoardFilters);

  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError(''); setActiveId(null);
    fetch('/__folder-library/catalog', { signal: abort.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('The folder library is unavailable. Check the local server and library location, then retry.');
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Folder browsing needs the local app server.');
        const result = await response.json();
        if (!Array.isArray(result.items)) throw new Error('The library response is invalid.');
        return result;
      }).then(setData).catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => abort.abort();
  }, [reload]);
  useEffect(() => { setVisibleCount(LOAD_BATCH_SIZE); }, [search, tags, folder, sort, tagMode, reload]);
  const items = data?.items ?? [];
  const visible = useMemo(() => selectFolderLibraryItems(items, { search, tags, tagMode, folder, sort }), [data, search, tags, tagMode, folder, sort]);
  const tagOptions = useMemo(() => folderLibraryTagOptions(items), [data]);
  const folders = useMemo(() => [...new Set(items.flatMap((item) => item.folder.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))))].filter(Boolean).sort(), [data]);
  useEffect(() => {
    if (viewMode !== 'library' || !loadMore.current || visibleCount >= visible.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        setVisibleCount((count) => Math.min(count + LOAD_BATCH_SIZE, visible.length));
      }
    }, { root: scrollRoot.current, rootMargin: '800px 0px' });
    observer.observe(loadMore.current);
    return () => observer.disconnect();
  }, [viewMode, visibleCount, visible.length, data]);
  const active = items.find((item) => item.id === activeId);
  const toggleTag = (tag) => setTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  const clear = () => { setSearch(''); setTags([]); setFolder(''); setTagSearch(''); };
  return <main className="folder-library" ref={scrollRoot}>
    <header className="folder-library-header">
      <div><p className="eyebrow">Moodboard</p><h1>Folder library <span className="folder-readonly">Local files</span></h1></div>
      <div className="folder-header-actions">
        <button className="secondary-button" onClick={() => setReload((n) => n + 1)}>Reload library</button>
        <a className="secondary-button" href={window.location.pathname}>Return to browser library</a>
      </div>
    </header>
    <p className="folder-library-note">Edit names, descriptions, tags, and favorites with Save metadata. Edits and versioned backups stay in the library folder. Generate boards from your library filters and save copies to keep. Use Scan folders to review new or moved images.</p>
    {boards.dirty && viewMode !== 'board' ? <p role="status">{boards.busy ? 'Saving board…' : 'Your board has unsaved changes.'} <button className="secondary-button" onClick={() => setViewMode('board')}>View board save status</button></p> : null}
    <FolderLibrarySync onApplied={() => setReload((n) => n + 1)} />
    {error ? <div role="alert" className="folder-load-state"><p>{error}</p><button className="primary-button" onClick={() => setReload((n) => n + 1)}>Retry</button></div>
      : !data ? <p role="status" className="folder-load-state">Loading folder library…</p>
      : <>
        <nav className="folder-library-tabs" aria-label="Folder library views">
          <button className="secondary-button" aria-pressed={viewMode === 'library'} onClick={() => setViewMode('library')}>Library</button>
          <button className="secondary-button" aria-pressed={viewMode === 'board'} onClick={() => { setActiveId(null); setViewMode('board'); }}>Current board</button>
        </nav>
        {viewMode === 'board' ? <FolderBoardWorkspace controller={boards} items={items} filters={{ search, tags, tagMode, folder, sort }} mediaRevision={reload} onEditFilters={() => setViewMode('library')} /> : null}
        <div hidden={viewMode !== 'library'}>
        <div className="folder-tools">
          <label>Search<input type="search" placeholder="Names, descriptions, tags…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="favorites">Favorites first</option></select></label>
          <button className="ghost-button" onClick={clear}>Clear filters</button>
        </div>
        <div className="folder-filter-panels">
        <details className="folder-tag-filter">
          <summary>Folders · {folder || 'All folders'}</summary>
          <FolderFilterTree paths={folders} selected={folder ? [folder] : []} onSelect={setFolder} label="Filter folders" />
        </details>
        <details className="folder-tag-filter">
          <summary>Filter tags{tags.length ? ` (${tags.length})` : ''}</summary>
          <div className="folder-tag-tools"><label>Find a tag<input type="search" value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} /></label><label>Match<select value={tagMode} onChange={(event) => setTagMode(event.target.value)}><option value="all">All selected tags</option><option value="any">Any selected tag</option></select></label></div>
          <FolderFilterTree paths={tagOptions} selected={tags} onSelect={toggleTag} multiple query={tagSearch} label="Filter tags" />
        </details>
        </div>
        {tags.length ? <div className="folder-active-tags">{tags.map((tag) => <button key={tag} className="secondary-button" onClick={() => toggleTag(tag)} aria-label={`Remove filter ${tag}`}>{tag} ×</button>)}</div> : null}
        <div className="folder-results-summary"><p role="status">{visible.length.toLocaleString()} of {items.length.toLocaleString()} images</p><p>{data.inventory.previewFallbacks} preview fallbacks · {data.inventory.metadataOnly} metadata-only</p></div>
        {Object.keys(data.warningCounts).some((code) => !['ORIGINAL_UNRESOLVED', 'NO_MAIN_IMAGE', 'NO_THUMBNAIL'].includes(code)) ? <details><summary>Library warnings</summary><ul>{Object.entries(data.warningCounts).map(([code, count]) => <li key={code}>{code}: {count}</li>)}</ul></details> : null}
        <div className="folder-grid-controls" role="group" aria-label="Photo grid size">
          {['small', 'medium', 'large'].map((size) => <button key={size} type="button" aria-label={`${size[0].toUpperCase() + size.slice(1)} photos`} aria-pressed={gridSize === size} onClick={() => setGridSize(size)}>{size[0].toUpperCase()}</button>)}
        </div>
        <div className={`folder-grid folder-grid-${gridSize}`}>
          {visible.slice(0, visibleCount).map((item) => <button type="button" className="folder-card" key={item.id} onClick={() => setActiveId(item.id)} title={item.name || 'Untitled'} aria-label={`View ${item.name || 'Untitled'}`}>
            <div className="folder-card-image"><LibraryImage key={`${reload}-${item.id}`} item={item} /></div>
            {badge(item) ? <span className="folder-status">{badge(item)}</span> : null}
          </button>)}
        </div>
        {!visible.length ? <p className="folder-load-state">No images match these filters.</p> : null}
        {visibleCount < visible.length ? <div className="folder-load-more" ref={loadMore}>
          <button className="secondary-button" onClick={() => setVisibleCount((count) => Math.min(count + LOAD_BATCH_SIZE, visible.length))}>Load more images</button>
        </div> : visible.length > 0 ? <p className="folder-scroll-end">All {visible.length.toLocaleString()} matching images shown</p> : null}
        {active ? <ItemViewer key={active.itemUuid} item={active} onSaved={(updated) => setData((current) => ({ ...current, items: current.items.map((entry) => entry.itemUuid === updated.itemUuid ? { ...entry, ...updated } : entry) }))} navigation={getReferencePreviewNavigation(visible, active.id)} onSelect={setActiveId} onClose={() => setActiveId(null)} /> : null}
        </div>
      </>}
  </main>;
}
