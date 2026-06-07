/**
 * TemplateGallery — Modal overlay to pick a workflow template.
 * Opens on first run or when clicking "NEW WORKFLOW" in the topbar.
 */
import React from 'react';
import { TEMPLATES } from '../seed.js';
import { useStore } from '../store.js';

export default function TemplateGallery({ onClose }) {
  const loadJSON = useStore(s => s.loadJSON);

  function load(tplFn) {
    const wf = tplFn();
    loadJSON(wf, null);
    onClose();
  }

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gallery-header">
          <div>
            <div className="gallery-eyebrow">OBSIDIAN STUDIO</div>
            <h2 className="gallery-title">Chọn workflow template</h2>
            <p className="gallery-sub">
              Mỗi template là một quy trình hoàn chỉnh, sẵn sàng chạy sau khi bạn record thao tác cho Browser Bridge.
            </p>
          </div>
          <button className="gallery-close" onClick={onClose}>✕</button>
        </div>

        {/* How it works */}
        <div className="gallery-howto">
          <div className="howto-step">
            <div className="howto-num">1</div>
            <div>
              <strong>Chọn template</strong>
              <span>Phù hợp với công việc của bạn</span>
            </div>
          </div>
          <div className="howto-arrow">→</div>
          <div className="howto-step">
            <div className="howto-num">2</div>
            <div>
              <strong>Record một lần</strong>
              <span>Mở Browser Bridge → thao tác bình thường trên web tool</span>
            </div>
          </div>
          <div className="howto-arrow">→</div>
          <div className="howto-step">
            <div className="howto-num">3</div>
            <div>
              <strong>Chạy tự động</strong>
              <span>Nhấn ▶ RUN WORKFLOW — app tự làm hết</span>
            </div>
          </div>
        </div>

        {/* Template cards */}
        <div className="gallery-grid">
          {TEMPLATES.map(tpl => {
            const data = tpl.fn();
            return (
              <div key={tpl.id} className="gallery-card" onClick={() => load(tpl.fn)}>
                <div className="gallery-card-icon" style={{ color: tpl.color, borderColor: tpl.color + '44' }}>
                  {tpl.icon}
                </div>
                <div className="gallery-card-body">
                  <div className="gallery-card-name">{data.name}</div>
                  <div className="gallery-card-desc">{data.desc}</div>
                  <div className="gallery-card-tags">
                    {(data.tags || []).map(t => (
                      <span key={t} className={`gallery-tag ${t === 'Beginner' ? 'green' : t === 'Advanced' ? 'rose' : ''}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="gallery-card-nodes">{data.nodes.length} nodes</div>
              </div>
            );
          })}
        </div>

        {/* Blank canvas option */}
        <div className="gallery-blank" onClick={() => { useStore.getState().clearAll(); useStore.getState().setProjectName('Untitled Workflow'); onClose(); }}>
          <span>+ Bắt đầu từ canvas trống</span>
        </div>
      </div>
    </div>
  );
}
