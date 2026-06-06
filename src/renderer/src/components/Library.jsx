import React, { useState, useMemo } from 'react';
import { NODE_DEFS, CATEGORIES } from '../data/nodeDefs.js';
import { useStore } from '../store.js';

// Nodes recommended for beginners
const STARTER_NODES = new Set(['brief','bridge','export','delivery','loop']);

export default function Library() {
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const addNode = useStore(s => s.addNode);

  const groups = useMemo(() => {
    const out = {};
    NODE_DEFS.forEach(d => {
      if (q && !(d.name + ' ' + d.desc).toLowerCase().includes(q.toLowerCase())) return;
      out[d.cat] = out[d.cat] || [];
      out[d.cat].push(d);
    });
    return out;
  }, [q]);

  function onDragStart(e, kind) {
    e.dataTransfer.setData('application/obsidian-node', kind);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDoubleClick(kind) {
    // Add to center of viewport (approximate)
    addNode(kind, { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 });
  }

  function toggleCat(catKey) {
    setCollapsed(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  }

  return (
    <aside className="library">
      <div className="lib-header">
        <div className="lib-title">NODE LIBRARY</div>
        <div className="lib-hint">Kéo vào canvas · hoặc double-click để thêm</div>
      </div>

      <div className="lib-search">
        <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Tìm node..." value={q} onChange={e => setQ(e.target.value)} />
        {q && <button className="lib-clear" onClick={() => setQ('')}>✕</button>}
      </div>

      {Object.entries(CATEGORIES).map(([catKey, cat]) => {
        const items = groups[catKey] || [];
        if (q && items.length === 0) return null;
        const isCollapsed = collapsed[catKey];
        return (
          <div className="lib-section" key={catKey}>
            <div className="lib-section-title" onClick={() => toggleCat(catKey)} style={{ cursor: 'pointer' }}>
              <span className="pip" style={{ color: cat.color }} />
              {cat.label}
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-dim)', userSelect: 'none' }}>
                {isCollapsed ? '▶' : '▼'}
              </span>
            </div>
            {!isCollapsed && items.map(d => (
              <div
                key={d.kind}
                className={`lib-node cat-${d.cat}`}
                draggable
                onDragStart={e => onDragStart(e, d.kind)}
                onDoubleClick={() => handleDoubleClick(d.kind)}
                title={`Double-click để thêm vào canvas\n${d.desc}`}
              >
                <div className="lib-node-icon">{d.icon}</div>
                <div className="lib-node-text">
                  <div className="lib-node-name">
                    {d.name}
                    {STARTER_NODES.has(d.kind) && <span className="lib-starter">⚡</span>}
                  </div>
                  <div className="lib-node-desc">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="lib-footer">
        <div className="lib-footer-tip">
          <strong>Bắt đầu từ đâu?</strong><br/>
          1. Kéo node <em>Brief</em> + <em>Browser Bridge</em> vào canvas<br/>
          2. Nối chúng lại<br/>
          3. Click Bridge → Inspector → RECORDING để record thao tác
        </div>
      </div>
    </aside>
  );
}
