import { useEffect, useMemo, useState } from "react";
import {
  clearSafeModeGeneratedBoards,
  createSafeModeMetadataBackup,
  deleteSafeModeReferences,
  getMostRecentReferenceIds,
  loadSafeModeLibraryMetadata
} from "../repositories/safeModeRepository.js";

function formatTimestamp(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(parsedValue));
}

function formatFileSize(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "";
  }

  if (parsedValue < 1024) {
    return `${parsedValue} B`;
  }

  if (parsedValue < 1024 * 1024) {
    return `${(parsedValue / 1024).toFixed(1)} KB`;
  }

  return `${(parsedValue / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSearchText(item) {
  return [
    item.id,
    item.name,
    item.originalFilename,
    item.mimeType,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ]
    .join(" ")
    .toLowerCase();
}

function downloadJsonFile(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}

export default function SafeModeRecovery() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    savedBoardCount: 0,
    currentBoardImageCount: 0,
    hasCurrentBoard: false,
    excludedCount: 0
  });
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSafeMode() {
      setLoading(true);
      setFeedback("");
      setItems([]);
      setLoadedCount(0);

      try {
        const result = await loadSafeModeLibraryMetadata({
          batchSize: 25,
          onBatch: ({ items: batchItems, loaded }) => {
            if (cancelled) {
              return;
            }

            setItems((current) => [...current, ...batchItems]);
            setLoadedCount(loaded);
          }
        });

        if (cancelled) {
          return;
        }

        setSummary(result.summary);
      } catch (error) {
        if (!cancelled) {
          setFeedback(error?.message || "Safe Mode could not load library metadata.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrapSafeMode();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => buildSearchText(item).includes(normalizedQuery));
  }, [items, query]);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds]
  );

  function toggleSelection(itemId) {
    setSelectedIds((current) => ({
      ...current,
      [itemId]: !current[itemId]
    }));
  }

  function selectAllFiltered() {
    setSelectedIds((current) => ({
      ...current,
      ...Object.fromEntries(filteredItems.map((item) => [item.id, true]))
    }));
  }

  function clearSelection() {
    setSelectedIds({});
  }

  async function runDelete(referenceIds, successMessage) {
    if (!referenceIds.length) {
      return;
    }

    setWorking(true);
    setFeedback("");

    try {
      const result = await deleteSafeModeReferences(referenceIds);
      const deletedReferenceIdSet = new Set(referenceIds);

      setItems((current) => current.filter((item) => !deletedReferenceIdSet.has(item.id)));
      setSelectedIds((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([referenceId, isSelected]) => isSelected && !deletedReferenceIdSet.has(referenceId)
          )
        )
      );
      setLoadedCount((current) => Math.max(0, current - referenceIds.length));
      setSummary(result.summary);
      setFeedback(successMessage);
    } catch (error) {
      setFeedback(error?.message || "Deletion failed.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteSelected() {
    const referenceIds = Object.entries(selectedIds)
      .filter(([, isSelected]) => isSelected)
      .map(([referenceId]) => referenceId);

    if (!referenceIds.length) {
      return;
    }

    if (!window.confirm(`Delete ${referenceIds.length} selected references from IndexedDB?`)) {
      return;
    }

    await runDelete(referenceIds, `Deleted ${referenceIds.length} selected references.`);
  }

  async function handleDeleteMostRecent(count) {
    const referenceIds = getMostRecentReferenceIds(items, count);

    if (!referenceIds.length) {
      return;
    }

    if (!window.confirm(`Delete the most recent ${referenceIds.length} references from IndexedDB?`)) {
      return;
    }

    await runDelete(referenceIds, `Deleted the most recent ${referenceIds.length} references.`);
  }

  async function handleClearBoards() {
    if (!window.confirm("Clear the current generated board and all saved boards?")) {
      return;
    }

    setWorking(true);
    setFeedback("");

    try {
      const result = await clearSafeModeGeneratedBoards();
      setSummary(result.summary);
      setFeedback("Cleared generated boards.");
    } catch (error) {
      setFeedback(error?.message || "Generated boards could not be cleared.");
    } finally {
      setWorking(false);
    }
  }

  function handleExportMetadataBackup() {
    const payload = createSafeModeMetadataBackup(items, summary);
    const date = new Date().toISOString().slice(0, 10);

    downloadJsonFile(payload, `moodboard-safe-mode-metadata-${date}.json`);
    setFeedback("Metadata backup exported.");
  }

  return (
    <main className="safe-mode-recovery-shell">
      <section className="safe-mode-recovery-panel panel">
        <div className="safe-mode-recovery-header">
          <div>
            <p className="eyebrow">Emergency Recovery</p>
            <h1>Safe Mode Metadata Rescue</h1>
          </div>
          <div className="safe-mode-recovery-status">
            <strong>{loading ? `Loaded ${loadedCount} references...` : `Loaded ${items.length} references.`}</strong>
            <span>Only metadata is loaded. Images, previews, boards, and blob payloads are not rendered.</span>
          </div>
        </div>

        <div className="safe-mode-recovery-summary">
          <span>{items.length} references</span>
          <span>{summary.excludedCount} excluded</span>
          <span>{summary.savedBoardCount} saved boards</span>
          <span>{summary.currentBoardImageCount} current board images</span>
        </div>

        <div className="safe-mode-recovery-actions">
          <button type="button" className="primary-button" onClick={handleExportMetadataBackup} disabled={loading || working || !items.length}>
            Export metadata backup
          </button>
          <button type="button" className="ghost-button danger" onClick={handleDeleteSelected} disabled={loading || working || !selectedCount}>
            Delete selected
          </button>
          <button type="button" className="ghost-button" onClick={handleClearBoards} disabled={loading || working}>
            Clear generated boards
          </button>
        </div>

        <div className="safe-mode-recovery-actions">
          {[100, 250, 500, 1000].map((count) => (
            <button
              key={count}
              type="button"
              className="ghost-button"
              onClick={() => void handleDeleteMostRecent(count)}
              disabled={loading || working || !items.length}
            >
              Delete recent {count}
            </button>
          ))}
        </div>

        <div className="safe-mode-recovery-toolbar">
          <label className="safe-mode-recovery-search">
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, file, tag, or id"
            />
          </label>
          <div className="safe-mode-recovery-selection">
            <span>{selectedCount} selected</span>
            <button type="button" className="ghost-button" onClick={selectAllFiltered} disabled={!filteredItems.length || working}>
              Select filtered
            </button>
            <button type="button" className="ghost-button" onClick={clearSelection} disabled={!selectedCount || working}>
              Clear selection
            </button>
          </div>
        </div>

        {feedback ? <p className="safe-mode-recovery-feedback">{feedback}</p> : null}

        <div className="safe-mode-recovery-table-wrap">
          <table className="safe-mode-recovery-table">
            <thead>
              <tr>
                <th aria-label="Select reference" />
                <th>Name</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Imported</th>
                <th>Updated</th>
                <th>File</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds[item.id])}
                      onChange={() => toggleSelection(item.id)}
                      disabled={working}
                      aria-label={`Select ${item.name || item.originalFilename || item.id}`}
                    />
                  </td>
                  <td>
                    <strong>{item.name || item.originalFilename || item.id}</strong>
                    <span className="safe-mode-recovery-subtle">{item.id}</span>
                  </td>
                  <td>{item.tags.length ? item.tags.join(", ") : "No tags"}</td>
                  <td>
                    <span>{item.favorite ? "Favorite" : "Normal"}</span>
                    <span className="safe-mode-recovery-subtle">{item.excluded ? "Excluded" : "Included"}</span>
                  </td>
                  <td>{formatTimestamp(item.importedAt || item.createdAt) || "Unknown"}</td>
                  <td>{formatTimestamp(item.updatedAt) || "Unknown"}</td>
                  <td>
                    <span>{item.originalFilename || "Unnamed file"}</span>
                    <span className="safe-mode-recovery-subtle">{formatFileSize(item.fileSize) || item.mimeType || "Unknown file"}</span>
                  </td>
                  <td>{item.imageWidth && item.imageHeight ? `${item.imageWidth} × ${item.imageHeight}` : "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredItems.length ? (
            <div className="editor-placeholder safe-mode-recovery-empty">
              <p>{loading ? "Loaded 0 references..." : "No references match the current filter."}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
