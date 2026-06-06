import React, { useState } from 'react';
import { useStore } from '../store.js';
import { useAccountStore } from '../store/accountStore.js';
import { runWorkflow } from '../engine/executor.js';

export default function Topbar({ onNewWorkflow, onOpenAccounts, onOpenTempMail }) {
  const projectName = useStore(s => s.projectName);
  const setProjectName = useStore(s => s.setProjectName);
  const running = useStore(s => s.running);
  const nodes = useStore(s => s.nodes);
  const accounts = useAccountStore(s => s.accounts);
  const [editing, setEditing] = useState(false);

  async function onRun() {
    try { await runWorkflow(); }
    catch (e) { console.error(e); alert('Workflow failed: ' + e.message); }
  }

  async function onSave() {
    const wf = useStore.getState().toJSON();
    const res = await window.obsidian.saveWorkflow(wf);
    if (res.ok) console.log('Saved:', res.path);
  }

  async function onLoad() {
    const res = await window.obsidian.loadWorkflow();
    if (res.ok) useStore.getState().loadJSON(res.workflow);
  }

  const bridgesNeedSetup = nodes.filter(n => n.data.kind === 'bridge' && !(n.data.actions || []).length).length;
  const emptyAccounts = accounts.filter(a => a.creditStatus === 'empty').length;
  const totalAccounts = accounts.length;

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark" />
        <div className="brand-text">OBSIDIAN<span>//</span></div>
      </div>

      <div className="divider-v" />

      {/* Project name */}
      <div className="project-info">
        {editing ? (
          <input
            autoFocus className="insp-input"
            style={{ width: 160, padding: '2px 6px', fontSize: 11 }}
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => e.key === 'Enter' && setEditing(false)}
          />
        ) : (
          <span className="name" onDoubleClick={() => setEditing(true)}
            style={{ cursor: 'text', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName}
          </span>
        )}
        <span className="status"><span className="status-dot" />{nodes.length}</span>
      </div>

      {/* Bridge setup warning — chỉ hiện khi có vấn đề */}
      {bridgesNeedSetup > 0 && (
        <div className="topbar-warning" title={`${bridgesNeedSetup} Bridge node chưa được record`}>
          ⚠ {bridgesNeedSetup} setup
        </div>
      )}

      <div className="topbar-spacer" />

      {/* Account chip */}
      <div className="topbar-acct-chip" onClick={onOpenAccounts} title="Quản lý tài khoản Google & credit">
        <span>👤</span>
        <span>{totalAccounts}</span>
        {emptyAccounts > 0 && <span className="acct-chip-warn">{emptyAccounts}×⚠</span>}
      </div>

      {/* Temp Mail */}
      <button className="btn btn-icon" onClick={onOpenTempMail} title="Tạo email tạm (đăng ký tài khoản mới)">
        ✉
      </button>

      <div className="divider-v" />

      {/* Workflow actions */}
      <button className="btn btn-icon" onClick={onNewWorkflow} title="Workflow mới / Templates">＋</button>
      <button className="btn btn-icon" onClick={onLoad} title="Mở workflow (.json)">📂</button>
      <button className="btn btn-icon" onClick={onSave} title="Lưu workflow">💾</button>

      <button className="btn btn-primary" onClick={onRun} disabled={running}
        style={{ padding: '7px 16px', fontSize: 11, letterSpacing: '0.04em' }}
        title="Chạy toàn bộ workflow (Ctrl+R)">
        {running ? '■ RUNNING' : '▶ RUN'}
      </button>

      <div className="avatar" title="Vũ Tiến Minh">VM</div>
    </header>
  );
}
