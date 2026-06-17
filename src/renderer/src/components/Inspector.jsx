import React, { useState, useEffect } from 'react';
import { useStore } from '../store.js';
import { DEFS_BY_KIND, CATEGORIES } from '../data/nodeDefs.js';
import { useAccountStore } from '../store/accountStore.js';
import { getGuide } from '../data/nodeGuides.js';
import {
  resolveUrlForClickSeq,
  buildInjectMapFromBindings,
  prepareStepsForRun,
  shortHost,
  WEB_TASK_KINDS,
  typeStepIndices,
  syncPromptSlotsFromEdges,
  getPromptTextFromNode,
  WEB_TASK_HANDLE_LABELS,
} from '../engine/workflowUtils.js';
import { WEB_TASK_PRESETS } from '../data/webTaskPresets.js';
import { fallbacksToText, textToFallbacks } from '../engine/stepHelpers.js';

export default function Inspector() {
  const selectedId = useStore(s => s.selectedId);
  const selectedIds = useStore(s => s.selectedIds);
  const nodes = useStore(s => s.nodes);
  const node = nodes.find(n => n.id === selectedId);
  const updateNodeData = useStore(s => s.updateNodeData);
  const removeNode = useStore(s => s.removeNode);
  const removeNodes = useStore(s => s.removeNodes);
  const selectNodes = useStore(s => s.selectNodes);
  const inspectorTabByNodeId = useStore(s => s.inspectorTabByNodeId);
  const setInspectorTab = useStore(s => s.setInspectorTab);

  if (selectedIds.length > 1) {
    const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
    return (
      <aside className="inspector">
        <div className="insp-multi">
          <div className="insp-eyebrow" style={{ color: 'var(--rose-gold)' }}>MULTI SELECT</div>
          <div className="insp-multi-count">{selectedIds.length} nodes đang chọn</div>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
            Kéo để di chuyển cùng lúc · <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>Del</kbd> xóa · click canvas để bỏ chọn
          </p>
          <div className="insp-multi-list">
            {selectedNodes.map(n => {
              const def = DEFS_BY_KIND[n.data.kind];
              return (
                <div key={n.id} className="insp-multi-item">
                  <strong>{def?.name || n.data.label}</strong>
                  {' · '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{n.id}</span>
                </div>
              );
            })}
          </div>
          <button
            className="btn"
            style={{ width: '100%', borderColor: 'rgba(220,40,85,0.4)', color: '#FF6B89' }}
            onClick={() => removeNodes(selectedIds)}
          >
            DELETE {selectedIds.length} NODES
          </button>
          <button className="btn" style={{ width: '100%' }} onClick={() => selectNodes([])}>
            BỎ CHỌN TẤT
          </button>
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="inspector">
        <div className="insp-empty">
          <div className="insp-empty-icon">◇</div>
          <h4>Chưa chọn node nào</h4>
          <p>Click một node để chỉnh sửa, hoặc kéo node mới từ thư viện.</p>
          <div className="insp-hint-box">
            <strong>Chọn nhiều node</strong>
            <ul>
              <li><kbd>Shift</kbd>+kéo vùng trên canvas để box-select</li>
              <li><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+click để thêm/bớt node</li>
              <li><kbd>Ctrl</kbd>+<kbd>A</kbd> chọn tất cả · <kbd>Del</kbd> xóa</li>
              <li>Kéo 1 node đã chọn → di chuyển cả nhóm</li>
            </ul>
          </div>
        </div>
      </aside>
    );
  }

  const def = DEFS_BY_KIND[node.data.kind];
  const cat = CATEGORIES[node.data.cat];
  const isBridge = node.data.kind === 'bridge';
  const isWebTask = WEB_TASK_KINDS.includes(node.data.kind);
  const hasActions = isBridge && (node.data.actions || []).length > 0;
  const hasSteps = (node.data.steps || []).length > 0;
  const webTaskReady = isWebTask && hasSteps;
  const tabs = isBridge
    ? ['guide', 'props', 'record', 'accts', 'output', 'log']
    : isWebTask
    ? ['guide', 'props', 'prompts', 'clicks', 'output', 'log']
    : ['guide', 'props', 'data', 'output', 'log'];

  const TAB_LABELS = { guide:'📖 guide', props:'props', prompts:'💬 prompts', record:'record', accts:'accts', output:'output', log:'log', data:'data', clicks:'👆 clicks' };
  const tab = inspectorTabByNodeId[node.id] ?? 'guide';

  return (
    <aside className="inspector">
      <div className="insp-header">
        <div className="insp-eyebrow" style={{ color: cat.color }}>{cat.label} NODE</div>
        <div className="insp-title">
          {node.data.label || def.name}
          {isBridge && <span className={`badge ${hasActions ? 'live' : 'warn'}`}>
            {hasActions ? 'READY' : 'NEEDS SETUP'}
          </span>}
          {isWebTask && <span className={`badge ${webTaskReady ? 'live' : 'warn'}`}>
            {webTaskReady ? 'READY' : 'NEEDS SETUP'}
          </span>}
        </div>
        <div className="insp-sub">
          ID <span style={{ color: 'var(--rose-gold)', fontFamily: 'var(--font-mono)' }}>{node.id}</span>
          {' · '}{def.schema.length} params
        </div>
      </div>

      <div className="insp-tabs">
        {tabs.map(t => (
          <div key={t} data-tab={t} className={`insp-tab ${tab === t ? 'active' : ''}`} onClick={() => setInspectorTab(node.id, t)}>
            {TAB_LABELS[t] || t}
          </div>
        ))}
      </div>

      <div className="insp-body">
        {tab === 'guide'  && <GuideTab kind={node.data.kind} />}
        {tab === 'props'  && (
          <PropertiesTab
            def={isWebTask
              ? { ...def, schema: def.schema.filter(f => !['steps', 'sessionId', 'delay'].includes(f.key)) }
              : def}
            data={node.data}
            onChange={(k, v) => updateNodeData(node.id, { [k]: v })}
          />
        )}
        {isWebTask && (
          <div style={{ display: tab === 'prompts' ? 'block' : 'none' }}>
            <PromptSlotsTab node={node} updateData={p => updateNodeData(node.id, p)} />
          </div>
        )}
        {isWebTask && (
          <div style={{ display: tab === 'clicks' ? 'block' : 'none' }}>
            <ClickSeqTab node={node} updateData={p => updateNodeData(node.id, p)} />
          </div>
        )}
        {tab === 'record' && isBridge && <RecordingTab node={node} updateData={p => updateNodeData(node.id, p)} />}
        {tab === 'accts'  && isBridge && <AccountsTab  node={node} updateData={p => updateNodeData(node.id, p)} />}
        {tab === 'output' && <OutputTab data={node.data} />}
        {tab === 'log'    && <LogTab nodeId={node.id} />}
        {tab === 'data'   && (
          <pre className="insp-textarea" style={{ minHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(node.data, null, 2)}
          </pre>
        )}

        <div className="insp-group" style={{ marginTop: 16 }}>
          <div className="insp-group-title">DANGER ZONE</div>
          <button
            className="btn"
            style={{ width: '100%', borderColor: 'rgba(220,40,85,0.4)', color: '#FF6B89' }}
            onClick={() => removeNode(node.id)}
          >
            DELETE NODE
          </button>
        </div>
      </div>
    </aside>
  );
}

function PropertiesTab({ def, data, onChange }) {
  return (
    <div className="insp-group">
      <div className="insp-group-title">CONFIGURATION</div>
      {def.schema.map(field => (
        <Field key={field.key} field={field} value={data[field.key]} onChange={v => onChange(field.key, v)} />
      ))}
    </div>
  );
}

function Field({ field, value, onChange }) {
  const { type, label, key } = field;
  switch (type) {
    case 'text':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span><span className="hint">{key}</span></div>
          <input className="insp-input" type="text" value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      );
    case 'folder':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span><span className="hint">{key}</span></div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <input
              className="insp-input"
              type="text"
              style={{ flex: 1, minWidth: 0 }}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              placeholder="Chọn thư mục lưu file export..."
            />
            <button
              type="button"
              className="btn"
              style={{ flexShrink: 0, padding: '0 12px' }}
              title="Chọn folder"
              onClick={async () => {
                try {
                  if (typeof window.obsidian?.pickFolder !== 'function') {
                    alert('Chưa load pickFolder — hãy restart app (npm run dev).');
                    return;
                  }
                  const res = await window.obsidian.pickFolder(value || undefined);
                  if (res.ok && res.path) onChange(res.path);
                } catch (e) {
                  alert('Không mở được folder picker: ' + (e.message || e));
                }
              }}
            >
              📁 Browse
            </button>
          </div>
        </div>
      );
    case 'textarea':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span><span className="hint">{key}</span></div>
          <textarea className="insp-textarea" value={value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      );
    case 'number':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span></div>
          <input className="insp-input" type="number" value={value ?? 0} onChange={e => onChange(Number(e.target.value))} />
        </div>
      );
    case 'select':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span></div>
          <select className="insp-select" value={value} onChange={e => onChange(e.target.value)}>
            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'range':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span></div>
          <div className="slider-row">
            <input type="range" min={field.min} max={field.max} step={field.step}
              value={value ?? field.default} onChange={e => onChange(Number(e.target.value))} />
            <span className="slider-val">{Number(value).toFixed(2)}</span>
          </div>
        </div>
      );
    case 'toggle':
      return (
        <div className="insp-field">
          <div className="insp-label" style={{ alignItems: 'center' }}>
            <span>{label}</span>
            <div className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)} />
          </div>
        </div>
      );
    case 'tags': {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span></div>
          <input className="insp-input" type="text" defaultValue={arr.join(', ')}
            onBlur={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="comma, separated, tags" />
        </div>
      );
    }
    case 'files':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span></div>
          <div className="insp-input" style={{ color: 'var(--text-dim)', cursor: 'pointer' }}>
            {(value || []).length > 0 ? `${value.length} files` : 'Drop files here · or click to browse'}
          </div>
        </div>
      );
    case 'json':
      return (
        <div className="insp-field">
          <div className="insp-label"><span>{label}</span><span className="hint">{Array.isArray(value) ? value.length + ' items' : 'json'}</span></div>
          <textarea className="insp-textarea" value={JSON.stringify(value || [], null, 2)}
            onChange={e => { try { onChange(JSON.parse(e.target.value)); } catch {} }} />
        </div>
      );
    default:
      return null;
  }
}

// ─── Guide Tab ───────────────────────────────────────────────────────────
function GuideTab({ kind }) {
  const guide = getGuide(kind);
  const [openSection, setOpenSection] = useState('steps');

  function Section({ id, title, children, accent }) {
    const open = openSection === id;
    return (
      <div className="guide-section">
        <div className={`guide-section-head ${open ? 'open' : ''}`}
          style={accent ? { borderLeftColor: accent } : {}}
          onClick={() => setOpenSection(open ? null : id)}>
          <span>{title}</span>
          <span className="guide-chevron">{open ? '▼' : '▶'}</span>
        </div>
        {open && <div className="guide-section-body">{children}</div>}
      </div>
    );
  }

  return (
    <div className="guide-wrap">
      {/* Summary */}
      <div className="guide-summary">{guide.summary}</div>

      {/* When to use */}
      <div className="guide-when">
        <span className="guide-when-label">KHI NÀO DÙNG</span>
        {guide.when}
      </div>

      {/* Steps */}
      {guide.steps.length > 0 && (
        <Section id="steps" title={`📋 CÁCH CÀI ĐẶT — ${guide.steps.length} bước`} accent="var(--rose-gold)">
          <ol className="guide-steps">
            {guide.steps.map((s, i) => (
              <li key={i} className="guide-step">
                <div className="guide-step-title">{s.title}</div>
                <div className="guide-step-body">{s.body}</div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Connections */}
      {(guide.inputs.length > 0 || guide.outputs.length > 0) && (
        <Section id="conn" title="🔌 KẾT NỐI VỚI NODE NÀO" accent="var(--c-intelligence)">
          {guide.inputs.length > 0 && (
            <div className="guide-conn-group">
              <div className="guide-conn-label input">← INPUT (nối từ node nào sang đây)</div>
              {guide.inputs.map((c, i) => (
                <div className="guide-conn-row" key={i}>
                  <span className="guide-conn-node input">{c.node}</span>
                  <span className="guide-conn-desc">{c.desc}</span>
                </div>
              ))}
            </div>
          )}
          {guide.outputs.length > 0 && (
            <div className="guide-conn-group">
              <div className="guide-conn-label output">→ OUTPUT (nối từ đây sang node nào)</div>
              {guide.outputs.map((c, i) => (
                <div className="guide-conn-row" key={i}>
                  <span className="guide-conn-node output">{c.node}</span>
                  <span className="guide-conn-desc">{c.desc}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Use cases */}
      {guide.usecases.length > 0 && (
        <Section id="uc" title="💡 VÍ DỤ THỰC TẾ" accent="var(--c-generation)">
          {guide.usecases.map((u, i) => (
            <div className="guide-usecase" key={i}>
              <div className="guide-usecase-title">{u.title}</div>
              <div className="guide-usecase-flow">{u.body}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Tips */}
      {guide.tips.length > 0 && (
        <Section id="tips" title="⚡ PRO TIPS" accent="var(--warning)">
          <ul className="guide-tips">
            {guide.tips.map((t, i) => (
              <li key={i} className="guide-tip">{t}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Warning */}
      {guide.warning && (
        <div className="guide-warning">
          <span className="guide-warning-icon">⚠</span>
          {guide.warning}
        </div>
      )}
    </div>
  );
}

// ─── Bridge Recording Tab (with step wizard) ─────────────────────────────
function RecordingTab({ node, updateData }) {
  const [recording, setRecording] = useState(false);
  const [opened, setOpened] = useState(false);
  const data = node.data;
  const hasActions = (data.actions || []).length > 0;

  async function openBridge() {
    try {
      await window.obsidian.bridge.open(node.id, data.url);
      setOpened(true);
    } catch (e) { alert('Open failed: ' + e.message); }
  }

  async function startRec() {
    await window.obsidian.bridge.recordStart(node.id);
    setRecording(true);
  }

  async function stopRec() {
    const res = await window.obsidian.bridge.recordStop(node.id);
    setRecording(false);
    if (res.ok) updateData({ actions: res.actions });
  }

  async function testReplay() {
    if (!hasActions) return alert('Chưa có actions nào để replay');
    await window.obsidian.bridge.replay(node.id, data.actions, {});
  }

  async function closeBridge() {
    await window.obsidian.bridge.close(node.id);
    setOpened(false);
  }

  function clearActions() {
    if (confirm('Xóa tất cả recorded actions?')) updateData({ actions: [] });
  }

  // ─── Step Wizard (when no actions yet) ────────────────────────────
  if (!hasActions) {
    return (
      <>
        <div className="bridge-wizard">
          <div className="wizard-title">Hướng dẫn setup Browser Bridge</div>
          <div className="wizard-steps">
            <WizardStep num={1} done={!!data.url} label="Nhập URL website" desc={
              <div className="insp-field" style={{ marginTop: 6 }}>
                <input className="insp-input" type="text" value={data.url || ''}
                  placeholder="https://www.canva.com/design/new"
                  onChange={e => updateData({ url: e.target.value })} />
                <div className="wizard-hint">Ví dụ: Canva, Midjourney, Runway, Higgsfield...</div>
              </div>
            } />
            <WizardStep num={2} done={opened} label="Mở trình duyệt" desc={
              <div style={{ marginTop: 6 }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={openBridge} disabled={!data.url}>
                  OPEN BROWSER
                </button>
                <div className="wizard-hint">Login vào website một lần duy nhất — session được lưu lại mãi mãi.</div>
              </div>
            } />
            <WizardStep num={3} done={false} label="Record thao tác" desc={
              <div style={{ marginTop: 6 }}>
                <button className="btn" style={{ width: '100%' }} onClick={startRec} disabled={!opened || recording}>
                  ● START RECORDING
                </button>
                <div className="wizard-hint">Sau khi record: thực hiện thao tác bình thường trên website (điền form, click nút, đợi kết quả...).</div>
              </div>
            } />
            <WizardStep num={4} done={false} label="Dừng và lưu" desc={
              <div style={{ marginTop: 6 }}>
                <button className={`btn ${recording ? 'live' : ''}`} style={{ width: '100%' }} onClick={stopRec} disabled={!recording}>
                  ■ STOP RECORDING
                </button>
              </div>
            } />
          </div>
        </div>
        {recording && (
          <div className="rec-live-indicator">
            <span className="rec-dot" /> ĐANG RECORD — Hãy thao tác trên cửa sổ browser
          </div>
        )}
      </>
    );
  }

  // ─── Has actions — show timeline + controls ────────────────────────
  return (
    <>
      <div className="insp-group">
        <div className="insp-group-title">PLAYWRIGHT SESSION</div>
        <div className="rec-controls">
          {!opened
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={openBridge}>OPEN BROWSER</button>
            : <button className="btn" style={{ flex: 1 }} onClick={closeBridge}>CLOSE BROWSER</button>}
        </div>
        <div className="rec-controls">
          {!recording
            ? <button className="btn" style={{ flex: 1 }} onClick={startRec} disabled={!opened}>● RE-RECORD</button>
            : <button className="btn live" style={{ flex: 1 }} onClick={stopRec}>■ STOP</button>}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={testReplay} disabled={!opened || recording}>
            ▶ TEST REPLAY
          </button>
        </div>
      </div>

      <div className="insp-group">
        <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>RECORDED ACTIONS · <span style={{ color: 'var(--signal)' }}>{data.actions.length} steps</span></span>
          <button className="btn" style={{ padding: '2px 8px', fontSize: 9, color: 'var(--danger)' }} onClick={clearActions}>
            CLEAR
          </button>
        </div>
        <div className="action-list">
          {data.actions.map((a, i) => (
            <div className="action-item" key={i}>
              <span className={`kind ${a.type}`}>{a.type}</span>
              <span className="sel">{a.selector || a.url || ''}</span>
              {a.value && <span className="txt-rose">"{String(a.value).slice(0, 28)}"</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="insp-group">
        <div className="insp-group-title">SESSION INFO</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Session lưu tại: <code style={{ color: 'var(--rose-gold)' }}>userData/sessions/{node.id}</code><br/>
          Login 1 lần · dùng mãi mãi · không cần re-login.
        </div>
      </div>
    </>
  );
}

// ─── Prompt Slots Tab ────────────────────────────────────────────────────
function PromptSlotsTab({ node, updateData }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const data = node.data;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const typeIdx = typeStepIndices(steps);
  const slots = syncPromptSlotsFromEdges(
    node.id, nodes, edges, steps, data.promptSlots || []
  );

  function updateSlot(handle, patch) {
    const next = slots.map(s => s.handle === handle ? { ...s, ...patch } : s);
    updateData({ promptSlots: next });
  }

  const imageEdge = edges.find(e => e.target === node.id && e.targetHandle === 'image');
  const urlEdge = edges.find(e => e.target === node.id && e.targetHandle === 'url');
  const imageSrc = imageEdge ? nodes.find(n => n.id === imageEdge.source) : null;
  const urlSrc = urlEdge ? nodes.find(n => n.id === urlEdge.source) : null;

  return (
    <div className="cs-wrap">
      <div className="insp-group">
        <div className="insp-group-title">PROMPT INPUTS</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
          Nối node <strong>Prompt</strong> vào cổng <strong>Prompt 1/2/3</strong> trên canvas.
          Chọn step <code>type</code> tương ứng trong chuỗi Pick Click.
        </div>

        {slots.length === 0 ? (
          <div className="cs-empty-hint" style={{ marginBottom: 12 }}>
            <div className="cs-empty-icon">💬</div>
            <div className="cs-empty-title">Chưa có prompt nào</div>
            <div className="cs-empty-body">
              Kéo dây từ node Prompt → cổng Prompt 1 (hoặc 2, 3) trên node này.
            </div>
          </div>
        ) : slots.map(slot => {
          const src = nodes.find(n => n.id === slot.sourceId);
          const preview = getPromptTextFromNode(src);
          return (
            <div className="insp-group" key={slot.handle} style={{ marginBottom: 10, padding: 8, border: '1px solid var(--border-soft)', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--rose-gold)', marginBottom: 6 }}>
                {slot.label || WEB_TASK_HANDLE_LABELS[slot.handle]}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 6 }}>
                Từ: <code>{src?.data?.label || slot.sourceId}</code>
                {preview && (
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--text-primary)' }}>
                    “{preview.slice(0, 80)}{preview.length > 80 ? '…' : ''}”
                  </span>
                )}
              </div>
              <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                Inject vào step
              </label>
              <select
                className="insp-input"
                value={slot.stepIndex ?? 0}
                onChange={e => updateSlot(slot.handle, { stepIndex: parseInt(e.target.value, 10) })}
              >
                {typeIdx.length === 0 ? (
                  <option value={0}>— Chưa có step type —</option>
                ) : typeIdx.map(i => (
                  <option key={i} value={i}>
                    Step {i + 1}: {steps[i]?.label || steps[i]?.selector?.slice(0, 24) || 'type'}
                  </option>
                ))}
              </select>
              <input
                className="insp-input"
                style={{ marginTop: 6 }}
                placeholder="Nhãn (vd: Motion prompt)"
                value={slot.label || ''}
                onChange={e => updateSlot(slot.handle, { label: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      <div className="insp-group">
        <div className="insp-group-title">OTHER INPUTS</div>
        <div className="node-field" style={{ marginBottom: 6 }}>
          <span className="label">Image</span>
          <span className="value">{imageSrc ? imageSrc.data.label : '— chưa nối'}</span>
        </div>
        <div className="node-field">
          <span className="label">URL</span>
          <span className="value">{urlSrc ? shortHost(urlSrc.data.url) : (data.url ? shortHost(data.url) : '— chưa nối')}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Click Sequence Tab ──────────────────────────────────────────────────
function ClickSeqTab({ node, updateData }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const bridgeSessionOpen = useStore(s => s.bridgeSessionOpen);
  const setBridgeSessionOpen = useStore(s => s.setBridgeSessionOpen);
  const data = node.data;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const [picking, setPicking] = useState(false);
  const [runState, setRunState] = useState('idle');
  const [runError, setRunError] = useState('');
  const [healthByStep, setHealthByStep] = useState({});
  const [healthSummary, setHealthSummary] = useState('');

  const sessionId = data.sessionId || node.id;
  const browserOpen = !!bridgeSessionOpen[sessionId];
  const resolvedUrl = resolveUrlForClickSeq(node, nodes, edges);
  const promptSlots = syncPromptSlotsFromEdges(
    node.id, nodes, edges, steps, data.promptSlots || []
  );

  function slotLabelForStep(stepIndex) {
    const slot = promptSlots.find(s => s.stepIndex === stepIndex);
    return slot?.label || (slot ? WEB_TASK_HANDLE_LABELS[slot.handle] : null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.obsidian.bridge.isOpen(node.id, sessionId);
        if (!cancelled && res?.ok) setBridgeSessionOpen(sessionId, res.open);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [node.id, sessionId, setBridgeSessionOpen]);

  async function syncBrowserOpen() {
    try {
      const res = await window.obsidian.bridge.isOpen(node.id, sessionId);
      if (res?.ok) {
        setBridgeSessionOpen(sessionId, res.open);
        return res.open;
      }
    } catch {}
    return !!bridgeSessionOpen[sessionId];
  }

  async function ensureBrowserOpen() {
    if (bridgeSessionOpen[sessionId]) return true;
    return syncBrowserOpen();
  }

  async function openBrowser() {
    const url = resolvedUrl || 'about:blank';
    try {
      const res = await window.obsidian.bridge.open(node.id, url, sessionId);
      if (res.ok) setBridgeSessionOpen(sessionId, true);
      else alert('Không mở được browser: ' + (res.error || 'Unknown'));
    } catch (e) {
      alert('Không mở được browser: ' + e.message);
    }
  }

  async function closeBrowser() {
    await window.obsidian.bridge.close(node.id, sessionId);
    setBridgeSessionOpen(sessionId, false);
  }

  async function pickClick() {
    if (!(await ensureBrowserOpen())) {
      alert('Nhấn OPEN BROWSER trước.');
      return;
    }
    setPicking(true);
    const stepNum = steps.length + 1;
    const res = await window.obsidian.bridge.captureClick(node.id, stepNum, sessionId);
    setPicking(false);
    if (!res.ok) { alert('Không capture được: ' + res.error); return; }
    const info = res.info;
    const stepType = info.action === 'right_click'
      ? 'right_click'
      : (info.isInput ? 'type' : 'click');
    const newStep = {
      type: stepType,
      selector: info.selector,
      selectors: (info.suggestedSelectors || []).filter(s => s && s !== info.selector),
      attrs: info.attrs || {},
      label: info.text || info.tag || `step ${stepNum}`,
      value: '',
      optional: false,
      x: info.x,
      y: info.y,
      delay: data.delay || 300,
    };
    updateData({ steps: [...steps, newStep] });
  }

  function updateStep(i, patch) {
    const next = steps.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    updateData({ steps: next });
  }

  function deleteStep(i) {
    updateData({ steps: steps.filter((_, idx) => idx !== i) });
  }

  function moveStep(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const arr = [...steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    updateData({ steps: arr });
  }

  function addManualStep(type) {
    updateData({ steps: [...steps, { type, selector: '', label: type, value: '', delay: data.delay || 300 }] });
  }

  function addManualStep(type) {
    updateData({ steps: [...steps, { type, selector: '', selectors: [], attrs: {}, label: type, value: '', optional: false, delay: data.delay || 300 }] });
  }

  async function checkStepsHealth() {
    if (!(await ensureBrowserOpen())) {
      alert('Nhấn OPEN BROWSER trước.');
      return;
    }
    setHealthSummary('Đang kiểm tra…');
    const res = await window.obsidian.bridge.checkSteps(node.id, steps, sessionId);
    if (!res.ok) {
      setHealthSummary('');
      alert('Check failed: ' + (res.error || 'Unknown'));
      return;
    }
    const map = {};
    let missing = 0;
    let optionalMiss = 0;
    for (const r of res.results || []) {
      map[r.index] = r;
      if (r.status === 'missing') missing++;
      if (r.status === 'optional_missing' || r.status === 'optional_empty') optionalMiss++;
    }
    setHealthByStep(map);
    if (missing > 0) {
      setHealthSummary(`${missing} bước thiếu element · ${optionalMiss} optional sẽ skip`);
    } else if (optionalMiss > 0) {
      setHealthSummary(`OK · ${optionalMiss} optional sẽ skip khi chạy`);
    } else {
      setHealthSummary('Tất cả selector OK');
    }
  }

  async function runTest() {
    if (!(await ensureBrowserOpen())) {
      alert('Nhấn OPEN BROWSER trước.');
      return;
    }
    const check = await window.obsidian.bridge.checkSteps(node.id, steps, sessionId);
    if (check.ok) {
      const map = {};
      const hardMissing = (check.results || []).filter(r => r.status === 'missing');
      for (const r of check.results || []) map[r.index] = r;
      setHealthByStep(map);
      if (hardMissing.length > 0) {
        const lines = hardMissing.map(r => `Step ${r.index + 1}`).join(', ');
        const go = window.confirm(
          `${hardMissing.length} bước không tìm thấy element (${lines}).\n\nChạy RUN TEST anyway?`
        );
        if (!go) {
          setHealthSummary(`${hardMissing.length} bước missing — hủy run`);
          return;
        }
      }
    }
    setRunState('running'); setRunError('');
    const stepsToRun = prepareStepsForRun(steps, resolvedUrl);
    const injectMap = buildInjectMapFromBindings(
      stepsToRun, nodes, edges, node.id, data.promptSlots || []
    );
    const res = await window.obsidian.bridge.runSteps(node.id, stepsToRun, injectMap, sessionId);
    if (res.ok) setRunState('done');
    else { setRunState('error'); setRunError(res.error || 'Unknown error'); }
    setTimeout(() => setRunState('idle'), 3000);
  }

  function urlBanner() {
    if (resolvedUrl) {
      return (
        <div style={{ fontSize: 9.5, color: 'var(--signal)', padding: '6px 0', lineHeight: 1.5 }}>
          URL: <code style={{ color: 'var(--rose-gold)' }}>{shortHost(resolvedUrl)}</code>
          <span style={{ color: 'var(--text-dim)' }}> · {resolvedUrl.slice(0, 48)}{resolvedUrl.length > 48 ? '…' : ''}</span>
        </div>
      );
    }
    return (
      <div style={{ fontSize: 9.5, color: 'var(--danger)', padding: '6px 0', lineHeight: 1.5 }}>
        Chưa có URL — nối URL Source hoặc điền Fallback URL (tab props)
      </div>
    );
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(steps, null, 2));
  }

  const STEP_COLORS = { click: '#DC2855', right_click: '#F97316', type: '#4A90E2', wait: '#94A3B8', goto: '#14B8A6', press: '#8B5CF6' };

  return (
    <div className="cs-wrap">
      {steps.length === 0 && !picking && (
        <div className="cs-empty-hint" style={{ marginBottom: 12 }}>
          <div className="cs-empty-icon">👆</div>
          <div className="cs-empty-title">Chưa có bước nào</div>
          <div className="cs-empty-body">
            Mở browser → Pick Click (trái/phải) để ghi từng thao tác.
          </div>
        </div>
      )}

      <div className="insp-group" style={{ marginBottom: 12 }}>
        <div className="insp-group-title">PRESET</div>
        <select
          className="insp-input"
          defaultValue=""
          onChange={e => {
            const key = e.target.value;
            if (!key || !WEB_TASK_PRESETS[key]) return;
            const p = WEB_TASK_PRESETS[key];
            updateData({
              steps: JSON.parse(JSON.stringify(p.steps)),
              ...(p.url ? { url: p.url } : {}),
              ...(p.grabFrom ? { grabFrom: p.grabFrom } : {}),
              ...(p.waitFor ? { waitFor: p.waitFor } : {}),
              ...(p.timeout ? { timeout: p.timeout } : {}),
            });
            e.target.value = '';
          }}
        >
          <option value="">— Load preset skeleton —</option>
          {Object.entries(WEB_TASK_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>{p.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
          Preset chỉ là khung bước — điền Tool URL (tab props) và Pick Click lại selector.
        </div>
      </div>

      {/* Browser controls */}
      <div className="insp-group">
        <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>BROWSER</span>
          <span style={{ fontSize: 9, color: browserOpen ? 'var(--signal)' : 'var(--text-dim)' }}>
            {browserOpen ? '● OPEN' : '○ closed'}
          </span>
        </div>
        {urlBanner()}
        <div className="rec-controls">
          {!browserOpen
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={openBrowser}>🌐 OPEN</button>
            : <button className="btn" style={{ flex: 1 }} onClick={closeBrowser}>✕ CLOSE</button>}
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={checkStepsHealth}
            disabled={steps.length === 0}
            title="Kiểm tra selector trước khi chạy"
          >
            ✓ CHECK
          </button>
          <button
            className={`btn btn-primary ${runState === 'running' ? 'live' : ''}`}
            style={{ flex: 1,
              background: runState === 'done' ? 'var(--signal)' :
                          runState === 'error' ? 'var(--danger)' : undefined }}
            onClick={runTest} disabled={runState === 'running' || steps.length === 0}>
            {runState === 'running' ? '⏳ Running...' :
             runState === 'done'    ? '✓ Done' :
             runState === 'error'   ? '✗ Error' : '▶ RUN TEST'}
          </button>
        </div>
        {runState === 'error' && (
          <div style={{ fontSize: 9.5, color: 'var(--danger)', padding: '4px 0', lineHeight: 1.5 }}>{runError}</div>
        )}
        {healthSummary && (
          <div style={{ fontSize: 9.5, color: 'var(--text-dim)', padding: '4px 0', lineHeight: 1.5 }}>{healthSummary}</div>
        )}
      </div>

      {/* Steps */}
      <div className="insp-group">
        <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>STEPS · <span style={{ color: 'var(--signal)' }}>{steps.length} bước</span></span>
          <button className="btn" style={{ padding: '2px 8px', fontSize: 9 }} onClick={copyJson} title="Copy JSON">📋</button>
        </div>

        {steps.map((step, i) => {
          const health = healthByStep[i];
          const healthLabel = health?.status === 'ok' ? '✓'
            : health?.status === 'missing' ? '✗'
            : health?.status === 'optional_missing' || health?.status === 'optional_empty' ? '⊘'
            : null;
          const healthColor = health?.status === 'ok' ? 'var(--signal)'
            : health?.status === 'missing' ? 'var(--danger)'
            : health?.status === 'optional_missing' || health?.status === 'optional_empty' ? 'var(--warning)'
            : 'var(--text-dim)';

          return (
          <div className={`cs-step ${step.optional ? 'cs-step-optional' : ''}`} key={i}>
            <div className="cs-step-head">
              <div className="cs-step-num" style={{ background: STEP_COLORS[step.type] || '#666' }}>{i + 1}</div>
              <select className="cs-type-sel" value={step.type}
                onChange={e => updateStep(i, { type: e.target.value })}>
                <option value="click">click</option>
                <option value="right_click">right click</option>
                <option value="type">type</option>
                <option value="wait">wait</option>
                <option value="press">press</option>
                <option value="goto">goto</option>
              </select>
              <span className="cs-step-label" title={step.selector}>
                {step.label || step.selector?.slice(0, 28) || '—'}
                {step.optional && (
                  <span className="cs-optional-badge">SKIP?</span>
                )}
                {healthLabel && (
                  <span style={{ marginLeft: 6, fontSize: 8, color: healthColor, fontWeight: 700 }} title={health?.matchedSelector || health?.status}>
                    {healthLabel}
                  </span>
                )}
                {step.type === 'type' && !step.value && (
                  <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--signal)', fontWeight: 700 }}>
                    {slotLabelForStep(i) ? `← ${slotLabelForStep(i)}` : 'INJECT?'}
                  </span>
                )}
              </span>
              <button className="cs-btn-sm" onClick={() => moveStep(i, -1)} disabled={i === 0} title="Lên">↑</button>
              <button className="cs-btn-sm" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} title="Xuống">↓</button>
              <button className="cs-btn-sm danger" onClick={() => deleteStep(i)} title="Xóa">✕</button>
            </div>

            {/* selector / url / key row */}
            {step.type === 'goto' ? (
              <input className="cs-input" placeholder="https://..." value={step.url || step.value || ''}
                onChange={e => updateStep(i, { url: e.target.value, value: e.target.value })} />
            ) : step.type === 'wait' ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="cs-input" style={{ width: 80 }} type="number" min={100} max={30000}
                  value={step.value || 1000}
                  onChange={e => updateStep(i, { value: e.target.value })} />
                <span style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>ms</span>
              </div>
            ) : step.type === 'press' ? (
              <input className="cs-input" placeholder="Enter / Tab / Escape..."
                value={step.key || ''} onChange={e => updateStep(i, { key: e.target.value })} />
            ) : (
              <>
                <input className="cs-input cs-selector" placeholder="CSS selector (primary)"
                  value={step.selector || ''} onChange={e => updateStep(i, { selector: e.target.value })} />
                <textarea
                  className="cs-input cs-fallbacks"
                  placeholder={'Fallback selectors — mỗi dòng một selector\nvd: button[aria-pressed="false"]\nvd: button[class*="jFIDjn"]'}
                  rows={2}
                  value={fallbacksToText(step.selectors)}
                  onChange={e => updateStep(i, { selectors: textToFallbacks(e.target.value) })}
                />
                <label className="cs-optional-row">
                  <input
                    type="checkbox"
                    checked={!!step.optional}
                    onChange={e => updateStep(i, { optional: e.target.checked })}
                  />
                  <span>Bỏ qua nếu không tìm thấy (optional)</span>
                </label>
                {step.attrs && Object.keys(step.attrs).length > 0 && (
                  <details className="cs-attrs-details">
                    <summary>Attrs từ Pick ({Object.keys(step.attrs).length})</summary>
                    <pre className="cs-attrs-pre">{JSON.stringify(step.attrs, null, 2)}</pre>
                  </details>
                )}
                {step.type === 'type' && (
                  <input className="cs-input" placeholder='Giá trị cố định (để trống = inject từ tab prompts)'
                    value={step.value || ''} onChange={e => updateStep(i, { value: e.target.value })} />
                )}
              </>
            )}
          </div>
          );
        })}
      </div>

      {/* Add step controls */}
      <div className="cs-add-row">
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={pickClick} disabled={picking}>
          {picking ? '⏳ Click trên browser...' : '📍 Pick Click ' + (steps.length + 1)}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={() => addManualStep('right_click')} title="Thêm right click thủ công">+ R-click</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => addManualStep('wait')} title="Thêm bước chờ">+ wait</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => addManualStep('goto')} title="Thêm bước điều hướng">+ goto</button>
      </div>

      {picking && (
        <div className="rec-live-indicator">
          <span className="rec-dot" /> Đang chờ — click trái hoặc phải vào element trên browser
        </div>
      )}

      {/* Session info */}
      <div className="insp-group">
        <div className="insp-group-title">SESSION</div>
        <div style={{ fontSize: 9.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          ID: <code style={{ color: 'var(--rose-gold)' }}>{sessionId}</code><br/>
          Lưu tại: <code style={{ color: 'var(--rose-gold)', fontSize: 9 }}>userData/sessions/{sessionId}</code>
        </div>
        <input className="insp-input" style={{ marginTop: 6 }} placeholder="Session ID (mặc định = node ID)"
          value={data.sessionId || ''} onChange={e => updateData({ sessionId: e.target.value })} />
      </div>
    </div>
  );
}

function WizardStep({ num, done, label, desc }) {
  return (
    <div className={`wizard-step ${done ? 'done' : ''}`}>
      <div className="wizard-step-head">
        <div className="wizard-step-num">{done ? '✓' : num}</div>
        <div className="wizard-step-label">{label}</div>
      </div>
      <div className="wizard-step-body">{desc}</div>
    </div>
  );
}

function OutputTab({ data }) {
  const out = data._output;

  if (out?.type === 'export') {
    const saved = out.saved || [];
    return (
      <div className="insp-group">
        <div className="insp-group-title">EXPORT · {out.count ?? saved.length} file(s)</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
          Format: <span style={{ color: 'var(--rose-gold)' }}>{out.format}</span><br/>
          Folder: <code style={{ color: 'var(--signal)', fontSize: 9.5, wordBreak: 'break-all' }}>{out.folderPath}</code>
        </div>
        {out.folderPath && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 10, justifyContent: 'center' }}
            onClick={() => window.obsidian.openPath(out.folderPath)}
          >
            📂 Mở folder
          </button>
        )}
        {saved.length === 0 ? (
          <div className="insp-empty" style={{ padding: 16 }}>Chưa có file nào được lưu.</div>
        ) : saved.map((p, i) => (
          <div className="action-item" key={i}>
            <span className="kind">file</span>
            <span className="sel" title={p}>{p.split(/[/\\]/).pop()}</span>
          </div>
        ))}
        {(out.errors || []).length > 0 && (
          <div style={{ marginTop: 10, fontSize: 9.5, color: 'var(--danger)' }}>
            {out.errors.length} lỗi khi export — xem ExecLog.
          </div>
        )}
      </div>
    );
  }

  const items = out?.items ?? (Array.isArray(out) ? out : out ? [out] : []);
  if (!items.length) {
    return (
      <div className="insp-empty" style={{ padding: 30 }}>
        <div className="insp-empty-icon">⌬</div>
        <h4>Chưa có output</h4>
        <p>Chạy workflow để thấy kết quả tại đây.</p>
      </div>
    );
  }
  return (
    <div className="insp-group">
      <div className="insp-group-title">OUTPUT · {items.length} items</div>
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          {typeof item === 'string' && /^https?:.*\.(png|jpg|jpeg|webp|gif)/i.test(item)
            ? <img src={item} alt={`out-${i}`} style={{ width: '100%', borderRadius: 5, border: '1px solid var(--border-subtle)' }} />
            : <div className="action-item"><span className="kind">item</span><span className="sel">{String(item).slice(0, 80)}</span></div>}
        </div>
      ))}
    </div>
  );
}

// ─── Accounts Tab (Bridge node) ──────────────────────────────────────────
function AccountsTab({ node, updateData }) {
  const { accounts, load } = useAccountStore();
  const assignedIds = node.data.accountIds || [];
  const rotateOnSelector = node.data.rotateOnSelector || '';

  useEffect(() => { load(); }, []);

  function toggle(id) {
    const next = assignedIds.includes(id)
      ? assignedIds.filter(x => x !== id)
      : [...assignedIds, id];
    updateData({ accountIds: next });
  }

  function moveUp(i) {
    if (i === 0) return;
    const arr = [...assignedIds];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    updateData({ accountIds: arr });
  }

  const orderedAssigned = assignedIds
    .map(id => accounts.find(a => a.id === id))
    .filter(Boolean);

  const unassigned = accounts.filter(a => !assignedIds.includes(a.id));

  const CREDIT_COLORS = { ok: 'var(--signal)', empty: 'var(--danger)', unknown: 'var(--text-dim)' };

  return (
    <>
      {/* Rotation order */}
      <div className="insp-group">
        <div className="insp-group-title">THỨ TỰ XOAY VÒNG · {orderedAssigned.length} tài khoản</div>
        {orderedAssigned.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '8px 0', lineHeight: 1.7 }}>
            Chưa assign tài khoản nào. Chọn từ danh sách bên dưới.<br/>
            Khi hết credit, workflow tự chuyển theo thứ tự này.
          </div>
        ) : orderedAssigned.map((acc, i) => (
          <div key={acc.id} className="acct-assign-row">
            <span className="acct-assign-num">{i + 1}</span>
            <span className="acct-assign-email">{acc.email || acc.id}</span>
            <span style={{ fontSize: 9, color: CREDIT_COLORS[acc.creditStatus] }}>
              {acc.creditStatus === 'ok' ? '✓' : acc.creditStatus === 'empty' ? '✗' : '?'}
            </span>
            <span style={{ fontSize: 9, color: acc.sessionReady ? 'var(--signal)' : 'var(--warning)' }}>
              {acc.sessionReady ? '🔓' : '🔒'}
            </span>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10 }}
              onClick={() => moveUp(i)} disabled={i === 0} title="Lên">↑</button>
            <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10 }}
              onClick={() => toggle(acc.id)} title="Bỏ assign">✕</button>
          </div>
        ))}
      </div>

      {/* Rotation trigger */}
      <div className="insp-group">
        <div className="insp-group-title">PHÁT HIỆN HẾT CREDIT</div>
        <div className="insp-field">
          <div className="insp-label">
            <span>CSS selector khi hết credit</span>
            <span className="hint">rotateOn</span>
          </div>
          <input className="insp-input" type="text"
            value={rotateOnSelector}
            placeholder=".out-of-credits, [data-state='limit-reached']"
            onChange={e => updateData({ rotateOnSelector: e.target.value })}
          />
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Khi workflow chạy và thấy selector này trên trang,
          sẽ tự động mở session của tài khoản tiếp theo trong danh sách.<br/>
          Để trống = chỉ chuyển khi bạn nhấn thủ công.
        </div>
      </div>

      {/* Available accounts */}
      {unassigned.length > 0 && (
        <div className="insp-group">
          <div className="insp-group-title">TÀI KHOẢN CÓ THỂ THÊM</div>
          {unassigned.map(acc => (
            <div key={acc.id} className="acct-assign-row" style={{ cursor: 'pointer', opacity: 0.7 }}
              onClick={() => toggle(acc.id)}>
              <span className="acct-assign-email">{acc.email || acc.id}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--signal)' }}>+ Thêm</span>
            </div>
          ))}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="insp-hint-box" style={{ marginTop: 0 }}>
          <strong>Chưa có tài khoản nào</strong><br/>
          Vào <em>Topbar → ACCOUNTS</em> để thêm tài khoản và đăng nhập.
        </div>
      )}
    </>
  );
}

function LogTab({ nodeId }) {
  const log = useStore(s => s.log.filter(l => l.nodeId === nodeId || !l.nodeId));
  return (
    <div className="insp-group">
      <div className="insp-group-title">EXECUTION LOG</div>
      <div className="action-list" style={{ maxHeight: 300 }}>
        {log.length === 0 && (
          <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-faint)', fontSize: 10 }}>
            Chưa có log — chạy workflow để thấy output
          </div>
        )}
        {log.map((l, i) => (
          <div className="action-item" key={i}>
            <span className={`kind ${l.level === 'error' ? 'bridge' : ''}`}>{l.level || 'info'}</span>
            <span className="sel">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
