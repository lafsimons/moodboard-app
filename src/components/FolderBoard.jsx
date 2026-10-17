import { useEffect, useMemo, useRef, useState } from 'react';
import { fitFolderBoard, resolveFolderBoardPlacements, zoomFolderBoard } from '../lib/folderBoardView.js';

function Placement({ entry }) {
  const [failed, setFailed] = useState(false);
  const { placement, rect, media, item, render, missingReason } = entry;
  const crop = render?.crop;
  const style = { position: 'absolute', left: rect.left, top: rect.top,
    width: Math.max(1, rect.width), height: Math.max(1, rect.height),
    transform: `rotate(${placement.rotation}deg)`, zIndex: placement.zIndex };
  const reason = missingReason || (failed ? 'Image unavailable' : '');
  return <div className="folder-board-placement" data-placement-id={placement.id} style={style}>
    {reason ? <div className="folder-board-missing" role="img" aria-label={reason}>{reason}<small>{item?.name || placement.referenceId || placement.referenceItemUuid}</small></div>
      : <span className="managed-image" style={{ width: '100%', height: '100%',
        '--managed-base-width': `${10000 / crop.width}%`, '--managed-base-height': `${10000 / crop.height}%`,
        '--managed-base-left': `${-crop.x / crop.width * 100}%`, '--managed-base-top': `${-crop.y / crop.height * 100}%`,
        '--managed-offset-x': `${render.offsetX}%`, '--managed-offset-y': `${render.offsetY}%`, '--managed-scale': render.imageScale / 100 }}>
        <img className="managed-image-content" src={media.url} alt={item.name || 'Board image'} draggable="false" onError={() => setFailed(true)} />
      </span>}
  </div>;
}

export default function FolderBoard({ board, items, mediaRevision = 0 }) {
  const viewport = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const entries = useMemo(() => resolveFolderBoardPlacements(board, items), [board, items]);
  const valid = board?.width > 0 && board?.height > 0;
  useEffect(() => {
    if (!viewport.current) return;
    const element = viewport.current;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [valid]);
  useEffect(() => { setView(fitFolderBoard(board, size)); }, [board, size]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect();
        setView((current) => zoomFolderBoard(current, Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .01), { x: event.clientX - bounds.left, y: event.clientY - bounds.top }));
      } else setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [valid]);
  if (!board) return <p className="folder-load-state">No current board was included in this export.</p>;
  if (!valid) return <p role="alert">The exported board has invalid dimensions. Its records have been kept unchanged.</p>;
  const zoom = (factor) => setView((current) => zoomFolderBoard(current, factor, { x: size.width / 2, y: size.height / 2 }));
  const endDrag = (event) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
    if (viewport.current?.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId);
  };
  return <section className="folder-board-section" aria-label="Current board viewer">
    <div className="folder-board-tools">
      <h2>Current board</h2><span>{board.images.length} placements</span>
      <button className="secondary-button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">−</button>
      <output aria-label="Board zoom">{Math.round(view.zoom * 100)}%</output>
      <button className="secondary-button" onClick={() => zoom(1.2)} aria-label="Zoom in">+</button>
      <button className="secondary-button" onClick={() => setView(fitFolderBoard(board, size))}>Fit board</button>
    </div>
    <p className="folder-library-note">Drag to pan. Use +/− to zoom, or Ctrl/⌘ + scroll. Arrow keys pan the focused canvas. Pan and zoom do not change the saved layout.</p>
    {!board.images.length ? <p>This board is empty.</p> : null}
    {entries.some((entry) => entry.missingReason) ? <p role="status">Some images are unavailable. Their placements remain on the board.</p> : null}
    <div ref={viewport} className="folder-board-viewport" tabIndex={0} role="region" aria-label="Board canvas"
      onKeyDown={(event) => {
        const delta = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
        if (delta) { event.preventDefault(); setView((current) => ({ ...current, x: current.x + delta[0], y: current.y + delta[1] })); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
        if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (drag.current?.id !== event.pointerId) return;
        const x = event.clientX - drag.current.x; const y = event.clientY - drag.current.y;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        setView((current) => ({ ...current, x: current.x + x, y: current.y + y }));
      }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}>
      <div className="folder-board-surface" style={{ width: board.width, height: board.height,
        transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        {entries.map((entry, index) => <Placement key={`${index}-${entry.placement.id}-${mediaRevision}`} entry={entry} />)}
      </div>
    </div>
  </section>;
}
