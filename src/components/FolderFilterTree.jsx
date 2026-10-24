import { useEffect, useMemo, useState } from 'react';

// Keep full paths as identities; only the final segment is shown in each row.
export default function FolderFilterTree({ paths, selected, onSelect, multiple = false, query = '', label }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const selectionKey = JSON.stringify(selected);
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      for (const path of JSON.parse(selectionKey)) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join('/'));
      }
      return next;
    });
  }, [selectionKey]);
  const nodes = useMemo(() => {
    const root = new Map();
    for (const path of paths) {
      let children = root;
      path.split('/').forEach((name, index, parts) => {
        const key = parts.slice(0, index + 1).join('/');
        if (!children.has(key)) children.set(key, { path: key, name, children: new Map() });
        children = children.get(key).children;
      });
    }
    const term = query.trim().toLocaleLowerCase();
    const prune = (children) => [...children.values()].sort((a, b) => a.name.localeCompare(b.name)).flatMap((node) => {
      const nested = prune(node.children);
      return !term || node.path.toLocaleLowerCase().includes(term) || nested.length ? [{ ...node, children: nested }] : [];
    });
    return prune(root);
  }, [paths, query]);
  const toggle = (path) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });
  const render = (entries) => <ul>{entries.map((node) => {
    const open = Boolean(query.trim()) || expanded.has(node.path);
    return <li key={node.path}>
      <div className="folder-tree-row">
        {node.children.length ? <button type="button" className="folder-tree-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${node.path}`} aria-expanded={open} onClick={() => toggle(node.path)}>{open ? '▾' : '▸'}</button> : <span className="folder-tree-spacer" />}
        <label title={node.path}><input type={multiple ? 'checkbox' : 'radio'} name={multiple ? undefined : 'folder-filter'} aria-label={node.path} checked={selected.includes(node.path)} onChange={() => onSelect(node.path)} /><span>{node.name}</span></label>
      </div>
      {node.children.length > 0 && open ? render(node.children) : null}
    </li>;
  })}</ul>;
  return <div className="folder-filter-tree" role="group" aria-label={label}>
    {!multiple ? <label className="folder-tree-all"><input type="radio" name="folder-filter" checked={!selected.length} onChange={() => onSelect('')} />All folders</label> : null}
    {nodes.length ? render(nodes) : <p>No matching {multiple ? 'tags' : 'folders'}.</p>}
  </div>;
}
