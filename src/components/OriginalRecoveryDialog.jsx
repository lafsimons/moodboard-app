import { useMemo } from "react";

function formatFileSize(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "Unknown";
  }

  if (parsedValue < 1024) {
    return `${parsedValue} B`;
  }

  if (parsedValue < 1024 * 1024) {
    return `${(parsedValue / 1024).toFixed(1)} KB`;
  }

  return `${(parsedValue / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(parsedValue));
}

function getBucketLabel(bucket) {
  switch (bucket) {
    case "ready":
      return "Ready";
    case "review":
      return "Needs review";
    case "ambiguous":
      return "Ambiguous";
    case "no_match":
      return "No match";
    case "excluded":
      return "Excluded";
    default:
      return "All";
  }
}

function getBucketForMatch(match) {
  if (match.outcome === "excluded") {
    return "excluded";
  }

  if (
    match.outcome === "exact_single"
    || match.outcome === "strong_single"
    || (match.outcome === "possible_single" && match.decision === "accepted")
  ) {
    return "ready";
  }

  if (match.outcome === "possible_single") {
    return "review";
  }

  if (match.outcome === "ambiguous_multiple") {
    return "ambiguous";
  }

  return "no_match";
}

function getDecisionLabel(decision) {
  switch (decision) {
    case "accepted":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "skipped":
      return "Skipped";
    case "needs_rescan":
      return "Needs re-scan";
    default:
      return "Undecided";
  }
}

function getSelectedCandidate(match) {
  return (Array.isArray(match?.candidates) ? match.candidates : []).find(
    (candidate) => candidate.id === match.selectedCandidateId
  ) ?? null;
}

export default function OriginalRecoveryDialog({
  isOpen,
  session,
  scanning = false,
  scanProgress = "",
  applying = false,
  feedback = "",
  error = "",
  canScan = false,
  hasLiveCandidates = false,
  bucketFilter = "all",
  onClose,
  onScan,
  onApplyApproved,
  onExportReport,
  onBucketFilterChange,
  onApproveReady,
  onResetVisible,
  onSelectCandidate,
  onDecisionChange
}) {
  const bucketCounts = useMemo(() => {
    const counts = {
      all: 0,
      ready: 0,
      review: 0,
      ambiguous: 0,
      no_match: 0,
      excluded: 0
    };

    (Array.isArray(session?.matches) ? session.matches : []).forEach((match) => {
      counts.all += 1;
      counts[getBucketForMatch(match)] += 1;
    });

    return counts;
  }, [session]);

  const visibleMatches = useMemo(() => {
    const allMatches = Array.isArray(session?.matches) ? session.matches : [];

    if (bucketFilter === "all") {
      return allMatches;
    }

    return allMatches.filter((match) => getBucketForMatch(match) === bucketFilter);
  }, [bucketFilter, session]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="floating-backdrop confirm-backdrop" onClick={onClose}>
      <div className="confirm-dialog original-recovery-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="original-recovery-header">
          <div>
            <p className="eyebrow">Archive recovery</p>
            <h2>Original Recovery v2</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={scanning || applying}>
            Close
          </button>
        </div>

        <p className="original-recovery-subtle">
          Scan one source, review provenance matches, then recover only approved missing originals.
        </p>

        <div className="original-recovery-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onScan}
            disabled={scanning || applying || !canScan}
          >
            {scanning ? "Scanning..." : session ? "Re-scan source" : "Scan source"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={onApplyApproved}
            disabled={applying || scanning || !session?.summary?.approvedCount || !hasLiveCandidates}
          >
            {applying ? "Applying..." : `Apply approved (${session?.summary?.approvedCount ?? 0})`}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={onExportReport}
            disabled={!session}
          >
            Export report
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={onApproveReady}
            disabled={!session?.summary?.outcomeCounts?.exact_single && !session?.summary?.outcomeCounts?.strong_single}
          >
            Approve ready
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={onResetVisible}
            disabled={!visibleMatches.length}
          >
            Mark for later
          </button>
        </div>

        {!canScan ? (
          <p className="image-preservation-note">
            File System Access API is unavailable in this browser. The recovery engine is adapter-based, but this v2 UI currently requires folder access support.
          </p>
        ) : null}
        {scanProgress ? <p className="original-recovery-subtle">{scanProgress}</p> : null}
        {feedback ? <p className="form-success">{feedback}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {session ? (
          <>
            <div className="original-recovery-summary" aria-label="Original recovery summary">
              <p><span>Source</span><strong>{session.sourceLabel || "Unknown"}</strong></p>
              <p><span>Scanned files</span><strong>{session.summary?.scannedFileCount ?? 0}</strong></p>
              <p><span>Eligible</span><strong>{session.summary?.eligibleItemCount ?? 0}</strong></p>
              <p><span>Excluded</span><strong>{session.summary?.excludedItemCount ?? 0}</strong></p>
              <p><span>Recovered</span><strong>{session.summary?.recoveredCount ?? 0}</strong></p>
              <p><span>Failed</span><strong>{session.summary?.failedCount ?? 0}</strong></p>
            </div>

            {!hasLiveCandidates ? (
              <p className="image-preservation-note">
                This report is persisted, but live scan files are not. Re-scan the source before applying approved recoveries.
              </p>
            ) : null}

            <div className="original-recovery-buckets" role="tablist" aria-label="Recovery result buckets">
              {["all", "ready", "review", "ambiguous", "no_match", "excluded"].map((bucket) => (
                <button
                  key={bucket}
                  type="button"
                  className={`ghost-button original-recovery-bucket ${bucketFilter === bucket ? "is-active" : ""}`}
                  onClick={() => onBucketFilterChange(bucket)}
                >
                  {getBucketLabel(bucket)} {bucketCounts[bucket]}
                </button>
              ))}
            </div>

            <div className="original-recovery-results">
              {visibleMatches.length ? (
                visibleMatches.map((match) => {
                  const selectedCandidate = getSelectedCandidate(match);

                  return (
                    <article key={match.itemId} className="original-recovery-match-card">
                      <div className="original-recovery-match-header">
                        <div>
                          <strong>{match.itemName || match.sourceOriginalFilename || match.itemId}</strong>
                          <p className="original-recovery-subtle">{match.itemId}</p>
                        </div>
                        <div className="original-recovery-pill-group">
                          <span className="original-recovery-pill">{match.outcome.replaceAll("_", " ")}</span>
                          <span className="original-recovery-pill">{getDecisionLabel(match.decision)}</span>
                          {match.applyResult?.status ? (
                            <span className={`original-recovery-pill is-${match.applyResult.status}`}>{match.applyResult.status}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="original-recovery-provenance">
                        <p><span>Stored filename</span><strong>{match.sourceOriginalFilename || "Unknown"}</strong></p>
                        <p><span>Aliases</span><strong>{match.sourceFilenameAliases?.join(", ") || "None"}</strong></p>
                        <p><span>Stored size</span><strong>{formatFileSize(match.sourceFileSize)}</strong></p>
                        <p><span>Stored dimensions</span><strong>{match.sourceImageWidth && match.sourceImageHeight ? `${match.sourceImageWidth} × ${match.sourceImageHeight}` : "Unknown"}</strong></p>
                      </div>

                      {selectedCandidate ? (
                        <div className="original-recovery-selected">
                          <p><span>Selected candidate</span><strong>{selectedCandidate.relativePath || selectedCandidate.fileName || "Unknown"}</strong></p>
                          <p><span>Candidate size</span><strong>{formatFileSize(selectedCandidate.sourceFileSize)}</strong></p>
                          <p><span>Candidate modified</span><strong>{formatTimestamp(selectedCandidate.sourceLastModified)}</strong></p>
                        </div>
                      ) : null}

                      {match.applyResult?.message ? (
                        <p className={match.applyResult.status === "failed" ? "form-error" : "original-recovery-subtle"}>
                          {match.applyResult.message}
                        </p>
                      ) : null}

                      <div className="original-recovery-decision-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onDecisionChange(match.itemId, "accepted")}
                          disabled={!selectedCandidate || match.outcome === "excluded"}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => onDecisionChange(match.itemId, "skipped")}
                          disabled={match.outcome === "excluded"}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => onDecisionChange(match.itemId, "rejected")}
                          disabled={match.outcome === "excluded"}
                        >
                          Reject
                        </button>
                      </div>

                      {match.candidates?.length ? (
                        <details className="original-recovery-candidates">
                          <summary>Review candidates ({match.candidates.length})</summary>
                          <div className="original-recovery-candidate-list">
                            {match.candidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                type="button"
                                className={`original-recovery-candidate ${match.selectedCandidateId === candidate.id ? "is-selected" : ""}`}
                                onClick={() => onSelectCandidate(match.itemId, candidate.id)}
                              >
                                <strong>{candidate.relativePath || candidate.fileName || candidate.id}</strong>
                                <span>{candidate.match?.classification || "unknown"}</span>
                                <span>{formatFileSize(candidate.sourceFileSize)}</span>
                                <span>
                                  {candidate.sourceImageWidth && candidate.sourceImageHeight
                                    ? `${candidate.sourceImageWidth} × ${candidate.sourceImageHeight}`
                                    : "Unknown dimensions"}
                                </span>
                                <span>{candidate.reasons?.join(" · ") || "No supporting reasons recorded."}</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <p className="original-recovery-subtle">
                          {match.outcome === "excluded" ? "Excluded from v2 recovery." : "No candidate matches were found in the scanned source."}
                        </p>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="editor-placeholder">
                  <p>No recovery records in this bucket.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="editor-placeholder">
            <p>No recovery report yet. Scan a source folder to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
