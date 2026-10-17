import { useState } from 'react';
import FolderBoard from './FolderBoard.jsx';
import { folderBoardPool } from '../lib/folderBoardGeneration.js';

export default function FolderBoardWorkspace({ controller, items, filters, onEditFilters, mediaRevision }) {
  const [name, setName] = useState('');
  const { document, settings, setSettings, busy, dirty, status, error, conflict } = controller;
  const pool = folderBoardPool(items, filters);
  const summary = [filters.search && `Search: ${filters.search}`, filters.folder && `Folder: ${filters.folder}`,
    filters.tags.length && `Tags (${filters.tagMode}): ${filters.tags.join(', ')}`].filter(Boolean).join(' · ') || 'All library images';
  return <section aria-label="Folder board generator">
    <div className="folder-generator-controls">
      <label>Generation mode<select value={settings.generationMode} disabled={busy || dirty} onChange={(event) => setSettings((current) => ({ ...current, generationMode: event.target.value }))}><option value="guided">Guided</option><option value="random">Random</option></select></label>
      <label>Images<input type="number" min={1} max={30} step={1} value={settings.imageCount} disabled={busy || dirty} onChange={(event) => setSettings((current) => ({ ...current, imageCount: event.target.value === '' ? '' : Math.max(1, Math.min(30, Math.round(Number(event.target.value)) || 1)) }))} onBlur={() => { if (settings.imageCount === '') setSettings((current) => ({ ...current, imageCount: 15 })); }} /></label>
      <button className="primary-button" disabled={busy || dirty || !document || !pool.length} onClick={() => controller.generate(items, filters)}>Generate board</button>
      <button className="secondary-button" onClick={onEditFilters}>Change library filters</button>
    </div>
    <p className="folder-generator-summary">{pool.length.toLocaleString()} eligible images · {summary}</p>
    {!pool.length ? <p>No available images match these filters. The current board is kept.</p> : pool.length < settings.imageCount ? <p>Generate will use all {pool.length} available images.</p> : null}
    <p role="status">{status === 'saving' ? 'Saving board…' : status === 'generating' ? 'Generating board…' : status === 'loading' ? 'Loading boards…' : dirty ? 'Unsaved board changes' : status === 'saved' ? 'Board saved' : ''}</p>
    {error ? <div role="alert"><p>{error}</p><div className="folder-header-actions">
      {dirty ? <button className="secondary-button" disabled={busy} onClick={controller.retry}>Retry board save</button> : null}
      <button className="secondary-button" disabled={busy} onClick={controller.loadSaved}>Load saved boards</button>
      {dirty && conflict && document?.current.board ? <button className="secondary-button" disabled={busy} onClick={() => controller.keepAsCopy(name)}>Keep unsaved board as a copy</button> : null}
    </div></div> : null}
    {document ? <>
      <FolderBoard board={document.current.board} items={items} mediaRevision={mediaRevision} />
      <div className="folder-generator-controls">
        <label>Board name<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="Name a board to keep" /></label>
        <button className="secondary-button" disabled={busy || dirty || !document.current.board || !name.trim() || document.saved.length >= 500} onClick={() => controller.saveCopy(name)}>Save a copy</button>
      </div>
      <section className="folder-saved-boards" aria-label="Saved boards"><h2>Saved boards</h2>
        {!document.saved.length ? <p>No saved copies yet.</p> : <ul>{document.saved.map((entry) => <li key={entry.id}><span>{entry.name} · {entry.board.images.length} images</span><button className="secondary-button" disabled={busy || dirty} onClick={() => controller.openSaved(entry.id)} aria-label={`Open saved board ${entry.name}`}>Open</button></li>)}</ul>}
      </section>
    </> : null}
  </section>;
}
