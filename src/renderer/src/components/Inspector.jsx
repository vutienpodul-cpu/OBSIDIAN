import React, { useState, useEffect } from 'react';
import { useStore } from '../store.js';
import { DEFS_BY_KIND, CATEGORIES } from '../data/nodeDefs.js';
import { useAccountStore } from '../store/accountStore.js';
import { getGuide } from '../data/nodeGuides.js';

export default function Inspector() {
  const selectedId = useStore(s => s.selectedId);
  const node = useStore(s => s.nodes.find(n => n.id === selectedId));
  const updateNodeData = useStore(s => s.updateNodeData);
  const removeNode = useStore(s => s.removeNode);
  const [tab, setTab] = useState('properties');

  // Reset tab when switching nodes
  useEffect(() => { setTab('guide'); }, [selectedId]);

  if (!node) {
    return (
      <aside className="inspector">
        <div className="insp-empty">
          <div className="insp-empty-icon">◇</div>
          <h4>Chưa chọn node nào</h4>
          <p>Click một node để chỉnh sửa, hoặc kéo node mới từ thư viện.</p>
          <div className="insp-hint-box">
            <strong>Gợi ý nhanh</strong>
            <ul>
              <li>Kéo node từ panel trái vào canvas</li>
              <li>Nối nodes bằng cách kéo từ chấm tròn phải sang trái</li>
              <li>Browser Bridge: record thao tác → replay tự động</li>
              <li>Nhấn <kbd>Ctrl+R</kbd> để chạy workflow</li>
            </ul>
          </div>
        </div>
      </aside>
    );
  }

  const def = DEFS_BY_KIND[node.data.kind];
  const cat = CATEGORIES[node.data.cat];
  const isBridge = node.data.kind === 'bridge';
  const isClickSeq = node.data.kind === 'click_seq';
  const hasActions = isBridge && (node.data.actions || []).length > 0;
  const tabs = isBridge
    ? ['guide', 'props', 'record', 'accts', 'output', 'log']
    : isClickSeq
    ? ['guide', 'clicks', 'output', 'log']
    : ['guide', 'props', 'data', 'output', 'log'];

  const TAB_LABELS = { guide:'📖 guide', props:'props', record:'record', accts:'accts', output:'output', log:'log', data:'data', clicks:'👆 clicks' };

  return (
    <aside className="inspector">
      <div className="insp-header">
        <div className="insp-eyebrow" style={{ color: cat.color }}>{cat.label} NODE</div>
        <div className="insp-title">
          {node.data.label || def.name}
          {isBridge && <span className={`badge ${hasActions ? 'live' : 'warn'}`}>
            {hasActions ? 'READY' : 'NEEDS SETUP'}
          </span>}
        </div>
        <div className="insp-sub">
          ID <span style={{ color: 'var(--rose-gold)', fontFamily: 'var(--font-mono)' }}>{node.id}</span>
          {' · '}{def.schema.length} params
        </div>
      </div>

      <div className="insp-tabs">
        {tabs.map(t => (
          <div key={t} data-tab={t} className={`insp-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t] || t}
          </div>
        ))}
      </div>

      <div className="insp-body">
        {tab === 'guide'  && <GuideTab kind={node.data.kind} />}
        {tab === 'props'  && <PropertiesTab def={def} data={node.data} onChange={(k, v) => updateNodeData(node.id, { [k]: v })} />}
        {tab === 'clicks' && isClickSeq && <ClickSeqTab node={node} updateData={p => updateNodeData(node.id, p)} />}
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

// ─── Click Sequence Tab ──────────────────────────────────────────────────
function ClickSeqTab({ node, updateData }) {
  const data = node.data;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const [picking, setPicking] = useState(false);
  const [runState, setRunState] = useState('idle'); // idle | running | done | error
  const [runError, setRunError] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);

  const sessionId = data.sessionId || node.id;

  async function openBrowser() {
    const urlNode = null; // Will use sessionId-based session
    const url = data._upstreamUrl || 'about:blank';
    const res = await window.obsidian.bridge.open(node.id, url, sessionId);
    if (res.ok) setBrowserOpen(true);
    else alert('Không mở được browser: ' + res.error);
  }

  async function closeBrowser() {
    await window.obsidian.bridge.close(node.id, sessionId);
    setBrowserOpen(false);
  }

  async function pickClick() {
    if (!browserOpen) { alert('Nhấn OPEN BROWSER trước.'); return; }
    setPicking(true);
    const stepNum = steps.length + 1;
    const res = await window.obsidian.bridge.captureClick(node.id, stepNum, sessionId);
    setPicking(false);
    if (!res.ok) { alert('Không capture được: ' + res.error); return; }
    const info = res.info;
    const newStep = {
      type: info.isInput ? 'type' : 'click',
      selector: info.selector,
      label: info.text || info.tag || `step ${stepNum}`,
      value: '',
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

  async function runTest() {
    if (!browserOpen) { alert('Nhấn OPEN BROWSER trước.'); return; }
    setRunState('running'); setRunError('');
    const res = await window.obsidian.bridge.runSteps(node.id, steps, {}, sessionId);
    if (res.ok) setRunState('done');
    else { setRunState('error'); setRunError(res.error || 'Unknown error'); }
    setTimeout(() => setRunState('idle'), 3000);
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(steps, null, 2));
  }

  // ─── Empty state wizard ──────────────────────────────────────────────
  if (steps.length === 0 && !picking) {
    return (
      <div className="cs-wrap">
        <div className="cs-empty-hint">
          <div className="cs-empty-icon">👆</div>
          <div className="cs-empty-title">Chưa có bước nào</div>
          <div className="cs-empty-body">
            Mở browser, sau đó nhấn "Pick Click" để bắt đầu ghi từng thao tác.<br/>
            App sẽ highlight element khi bạn di chuột và ghi lại khi bạn click.
          </div>
        </div>

        <div className="insp-group">
          <div className="insp-group-title">BROWSER SESSION</div>
          <div className="cs-session-row">
            <div className="insp-field" style={{ flex: 1 }}>
              <div className="insp-label"><span>Session ID</span><span className="hint">riêng biệt</span></div>
              <input className="insp-input" value={data.sessionId || ''} placeholder={node.id}
                onChange={e => updateData({ sessionId: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={openBrowser}>
            🌐 OPEN BROWSER
          </button>
          <div className="wizard-hint">Login vào website 1 lần — session lưu mãi mãi.</div>
        </div>

        {browserOpen && (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={pickClick} disabled={picking}>
            {picking ? '⏳ Đang đợi bạn click trên browser...' : '📍 Pick Click 1'}
          </button>
        )}
      </div>
    );
  }

  // ─── Steps list UI ───────────────────────────────────────────────────
  const STEP_COLORS = { click: '#DC2855', type: '#4A90E2', wait: '#94A3B8', goto: '#14B8A6', press: '#8B5CF6' };

  return (
    <div className="cs-wrap">
      {/* Browser controls */}
      <div className="insp-group">
        <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>BROWSER</span>
          <span style={{ fontSize: 9, color: browserOpen ? 'var(--signal)' : 'var(--text-dim)' }}>
            {browserOpen ? '● OPEN' : '○ closed'}
          </span>
        </div>
        <div className="rec-controls">
          {!browserOpen
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={openBrowser}>🌐 OPEN</button>
            : <button className="btn" style={{ flex: 1 }} onClick={closeBrowser}>✕ CLOSE</button>}
          <button
            className={`btn btn-primary ${runState === 'running' ? 'live' : ''}`}
            style={{ flex: 1,
              background: runState === 'done' ? 'var(--signal)' :
                          runState === 'error' ? 'var(--danger)' : undefined }}
            onClick={runTest} disabled={!browserOpen || runState === 'running' || steps.length === 0}>
            {runState === 'running' ? '⏳ Running...' :
             runState === 'done'    ? '✓ Done' :
             runState === 'error'   ? '✗ Error' : '▶ RUN TEST'}
          </button>
        </div>
        {runState === 'error' && (
          <div style={{ fontSize: 9.5, color: 'var(--danger)', padding: '4px 0', lineHeight: 1.5 }}>{runError}</div>
        )}
      </div>

      {/* Steps */}
      <div className="insp-group">
        <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>STEPS · <span style={{ color: 'var(--signal)' }}>{steps.length} bước</span></span>
          <button className="btn" style={{ padding: '2px 8px', fontSize: 9 }} onClick={copyJson} title="Copy JSON">📋</button>
        </div>

        {steps.map((step, i) => (
          <div className="cs-step" key={i}>
            <div className="cs-step-head">
              <div className="cs-step-num" style={{ background: STEP_COLORS[step.type] || '#666' }}>{i + 1}</div>
              <select className="cs-type-sel" value={step.type}
                onChange={e => updateStep(i, { type: e.target.value })}>
                <option value="click">click</option>
                <option value="type">type</option>
                <option value="wait">wait</option>
                <option value="press">press</option>
                <option value="goto">goto</option>
              </select>
              <span className="cs-step-label" title={step.selector}>{step.label || step.selector?.slice(0, 28) || '—'}</span>
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
                <input className="cs-input cs-selector" placeholder="CSS selector"
                  value={step.selector || ''} onChange={e => updateStep(i, { selector: e.target.value })} />
                {step.type === 'type' && (
                  <input className="cs-input" placeholder='Giá trị (để trống = inject từ upstream)'
                    value={step.value || ''} onChange={e => updateStep(i, { value: e.target.value })} />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add step controls */}
      <div className="cs-add-row">
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={pickClick} disabled={!browserOpen || picking}>
          {picking ? '⏳ Click trên browser...' : '📍 Pick Click ' + (steps.length + 1)}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={() => addManualStep('wait')} title="Thêm bước chờ">+ wait</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => addManualStep('goto')} title="Thêm bước điều hướng">+ goto</button>
      </div>

      {picking && (
        <div className="rec-live-indicator">
          <span className="rec-dot" /> Đang chờ — hãy click vào element trên browser
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
  if (!out || (Array.isArray(out) && out.length === 0)) {
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
      <div className="insp-group-title">OUTPUT · {Array.isArray(out) ? out.length + ' items' : '1 item'}</div>
      {(Array.isArray(out) ? out : [out]).map((item, i) => (
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
