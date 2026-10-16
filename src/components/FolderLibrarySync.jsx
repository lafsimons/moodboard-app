import { useEffect, useState } from 'react';

const issueLabels = {
  MISSING_FILE: 'Missing file — record retained', AMBIGUOUS_MOVE: 'Uncertain move — unchanged',
  DUPLICATE_OR_AMBIGUOUS: 'Duplicate or uncertain match — skipped', CHANGED_FILE: 'File contents changed — needs review',
  UNVERIFIED_FILE: 'No saved fingerprint — unchanged', SYMLINK_SKIPPED: 'Symbolic link — skipped',
  UNSUPPORTED_FILE: 'Unsupported file — skipped', INVALID_IMAGE: 'Unreadable image — skipped'
};

export default function FolderLibrarySync({ onApplied }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!busy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  async function run(action) {
    if (busy) return;
    setBusy(action); setError(''); setMessage('');
    if (action === 'scan') setPreview(null);
    try {
      const response = await fetch(`/__folder-library/sync/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'apply' ? { revision: preview.revision } : {})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Folder sync failed. Scan again to check the current files.');
      if (action === 'scan') setPreview(result);
      else { setPreview(null); setMessage(`Sync complete: ${result.added} new images, ${result.moved} updated file locations, ${result.removed} removed images, ${result.restored} restored images, ${result.updated} edited images.`); onApplied(); }
    } catch (failure) { setError(failure.message); if (action === 'apply') setPreview(null); }
    finally { setBusy(''); }
  }
  return <section className="folder-sync" aria-label="Manual folder sync">
    <div className="folder-sync-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => run('scan')}>Scan folders</button>
      <span>Drop images in public/images/Inbox, or organize them anywhere under public/images, then scan.</span></div>
    {busy ? <p role="status">{busy === 'scan' ? 'Scanning files and checking image contents…' : 'Applying sync and creating thumbnails…'} This can take a moment for a large library.</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {preview ? <div className="folder-sync-review">
      <p role="status">{preview.additions.length} new images · {preview.moves.length} moved files · {preview.updates.length} edited images · {preview.removals.length} removed images · {preview.restores.length} restored images · {preview.issues.length} files to review</p>
      <p>Applying registers new images and updates verified file locations. Metadata, tags, and board links are preserved. Deleted originals are removed from the library view. Their metadata is retained for recovery; board placements keep a missing-image placeholder.</p>
      {preview.additions.length ? <details open><summary>New images ({preview.additions.length})</summary><ul>{preview.additions.map((item) => <li key={item.path}>{item.path}</li>)}</ul></details> : null}
      {preview.moves.length ? <details open><summary>Moved files ({preview.moves.length})</summary><ul>{preview.moves.map((item) => <li key={`${item.itemUuid}-${item.variant}`}>{item.from} → {item.to}</li>)}</ul></details> : null}
      {preview.updates.length ? <details open><summary>Edited images — refresh thumbnails ({preview.updates.length})</summary><ul>{preview.updates.map((item) => <li key={item.itemUuid}>{item.from === item.path ? item.path : `${item.from} → ${item.path}`} ({item.width} × {item.height})</li>)}</ul></details> : null}
      {preview.removals.length ? <details open><summary>Remove deleted images ({preview.removals.length})</summary><ul>{preview.removals.map((item) => <li key={item.itemUuid}>{item.name}: {item.path}</li>)}</ul></details> : null}
      {preview.issues.length ? <details><summary>Review these files ({preview.issues.length})</summary><ul>{preview.issues.map((issue, index) => <li key={index}>{issueLabels[issue.code] || issue.code}: {issue.path}</li>)}</ul></details> : null}
      <div className="folder-sync-actions"><button className="primary-button" disabled={Boolean(busy) || !(preview.additions.length || preview.updates.length || preview.moves.length || preview.removals.length || preview.restores.length)} onClick={() => run('apply')}>Apply sync</button><button className="ghost-button" disabled={Boolean(busy)} onClick={() => setPreview(null)}>Dismiss</button></div>
      {!preview.additions.length && !preview.updates.length && !preview.moves.length && !preview.removals.length && !preview.restores.length ? <p>No changes to apply.</p> : null}
    </div> : null}
  </section>;
}
