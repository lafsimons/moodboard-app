import { useCallback, useEffect, useRef, useState } from 'react';
import { createBoardUuid } from '../lib/boardIdentity.js';
import { folderBoardSettings, generateFolderBoard } from '../lib/folderBoardGeneration.js';

async function boardRequest(method = 'GET', body, signal) {
  const response = await fetch('/__folder-library/boards', {
    method, signal, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Board storage needs the local app server.');
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Board storage is unavailable.'); error.status = response.status; throw error; }
  if (!result.state || typeof result.revision !== 'string') throw new Error('Invalid board storage response.');
  return result;
}

function savedCopy(current, name) {
  const id = createBoardUuid();
  return { ...structuredClone(current), id, name, createdAt: new Date().toISOString(), board: { ...structuredClone(current.board), id: `board_${id}`, boardUuid: id } };
}

export default function useFolderBoards(restoreFilters) {
  const [document, setDocument] = useState(null);
  const [settings, setSettings] = useState(() => folderBoardSettings());
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const revision = useRef(null);
  const inFlight = useRef(false);
  const restore = useCallback((result) => {
    revision.current = result.revision; setDocument(result.state); setSettings(result.state.current.settings);
    restoreFilters(result.state.current.filters); setDirty(false); setConflict(false); setError(''); setStatus('saved');
  }, [restoreFilters]);
  useEffect(() => {
    const abort = new AbortController();
    boardRequest('GET', undefined, abort.signal).then(restore).catch((failure) => {
      if (failure.name !== 'AbortError') { setError(failure.message); setStatus('error'); }
    });
    return () => abort.abort();
  }, [restore]);
  useEffect(() => {
    if (!dirty && status !== 'saving') return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, status]);

  async function persist(next, baseRevision = revision.current) {
    setDocument(next); setDirty(true); setStatus('saving'); setError(''); setConflict(false);
    try {
      const result = await boardRequest('PUT', { revision: baseRevision, state: next });
      revision.current = result.revision; setDocument(result.state); setDirty(false); setStatus('saved');
      return true;
    } catch (failure) {
      setStatus('error'); setError(failure.message); setConflict(failure.status === 409);
      return false;
    }
  }
  async function generate(items, filters) {
    if (inFlight.current || !document || dirty) return;
    inFlight.current = true; setStatus('generating'); setError('');
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const board = generateFolderBoard(items, filters, settings, { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
      const current = { board, settings: folderBoardSettings(settings), filters: structuredClone(filters) };
      await persist({ ...document, current });
    } catch (failure) { setError(failure.message); setStatus('error'); }
    finally { inFlight.current = false; }
  }
  async function saveCopy(name) {
    if (inFlight.current || !document?.current.board || dirty || !name.trim()) return;
    inFlight.current = true;
    try { await persist({ ...document, saved: [...document.saved, savedCopy(document.current, name.trim())] }); }
    finally { inFlight.current = false; }
  }
  async function openSaved(id) {
    if (inFlight.current || !document || dirty) return;
    const entry = document.saved.find((entry) => entry.id === id);
    if (!entry) return;
    inFlight.current = true;
    const current = structuredClone({ board: entry.board, settings: entry.settings, filters: entry.filters });
    setSettings(current.settings); restoreFilters(current.filters);
    try { await persist({ ...document, current }); } finally { inFlight.current = false; }
  }
  async function retry() {
    if (inFlight.current || !document || !dirty) return;
    inFlight.current = true;
    try { await persist(document); } finally { inFlight.current = false; }
  }
  async function loadSaved() {
    if (inFlight.current || (dirty && !window.confirm('Discard the unsaved board changes and load saved boards?'))) return;
    inFlight.current = true; setStatus('loading');
    try { restore(await boardRequest()); }
    catch (failure) { setError(failure.message); setStatus('error'); }
    finally { inFlight.current = false; }
  }
  async function keepAsCopy(name) {
    if (inFlight.current || !document?.current.board || !dirty) return;
    inFlight.current = true; setStatus('saving');
    try {
      const latest = await boardRequest();
      const copy = savedCopy(document.current, name.trim() || 'Recovered board');
      const next = { ...latest.state, saved: [...latest.state.saved, copy] };
      // Do not replace the other tab's current board during conflict recovery.
      const result = await boardRequest('PUT', { revision: latest.revision, state: next });
      restore(result);
    } catch (failure) { setError(failure.message); setStatus('error'); setConflict(failure.status === 409); }
    finally { inFlight.current = false; }
  }
  return { document, settings, setSettings, status, error, dirty, conflict, generate, saveCopy, openSaved, retry, loadSaved, keepAsCopy,
    busy: ['loading', 'saving', 'generating'].includes(status) };
}
