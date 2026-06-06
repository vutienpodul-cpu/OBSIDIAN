/**
 * AccountManager — Quản lý danh sách tài khoản.
 * Mỗi tài khoản = 1 session Playwright độc lập.
 * Bridge node có thể gán 1 hoặc nhiều tài khoản → tự động xoay vòng khi hết credit.
 */
import React, { useState, useEffect } from 'react';
import { useAccountStore } from '../store/accountStore.js';

const SERVICE_ICONS = {
  Google: '🔵',
  Midjourney: '🟣',
  Canva: '🟦',
  Runway: '⬛',
  Sora: '🟤',
  Kling: '🔶',
  Other: '⚪',
};

const CREDIT_COLORS = {
  ok: 'var(--signal)',
  empty: 'var(--danger)',
  unknown: 'var(--text-dim)',
};

export default function AccountManager({ onClose }) {
  const { accounts, load, add, update, remove, deleteSession, refreshSessionStatus } = useAccountStore();
  const [showForm, setShowForm] = useState(false);
  const [openBrowserId, setOpenBrowserId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function handleOpenSession(acc) {
    setOpenBrowserId(acc.id);
    try {
      await window.obsidian.bridge.open(`__acc_${acc.id}`, 'https://accounts.google.com', acc.id);
      update(acc.id, { sessionReady: true });
    } catch (e) {
      alert('Không mở được browser: ' + e.message);
    } finally {
      setOpenBrowserId(null);
    }
  }

  async function handleCloseSession(acc) {
    await window.obsidian.bridge.close(`__acc_${acc.id}`, acc.id);
  }

  async function handleDeleteSession(acc) {
    if (!confirm(`Xóa session của ${acc.email || acc.id}? Login sẽ bị mất.`)) return;
    await deleteSession(acc.id);
  }

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="acct-modal" onClick={e => e.stopPropagation()}>
        <div className="gallery-header" style={{ paddingBottom: 16 }}>
          <div>
            <div className="gallery-eyebrow">OBSIDIAN STUDIO</div>
            <h2 className="gallery-title" style={{ fontSize: 18 }}>Account Manager</h2>
            <p className="gallery-sub">
              Mỗi tài khoản có session browser độc lập. Login 1 lần — dùng mãi mãi trên Bridge nodes.
            </p>
          </div>
          <button className="gallery-close" onClick={onClose}>✕</button>
        </div>

        {/* Account list */}
        <div style={{ padding: '0 24px' }}>
          {accounts.length === 0 && !showForm && (
            <div className="acct-empty">
              <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
              <div>Chưa có tài khoản nào.</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                Thêm tài khoản → assign vào Browser Bridge node → tự động rotate khi hết credit.
              </div>
            </div>
          )}

          {accounts.map(acc => (
            <AccountRow
              key={acc.id}
              acc={acc}
              onUpdate={(p) => update(acc.id, p)}
              onRemove={() => remove(acc.id)}
              onOpenSession={() => handleOpenSession(acc)}
              onCloseSession={() => handleCloseSession(acc)}
              onDeleteSession={() => handleDeleteSession(acc)}
              opening={openBrowserId === acc.id}
            />
          ))}

          {/* Add form */}
          {showForm
            ? <AddAccountForm onAdd={(f) => { add(f); setShowForm(false); }} onCancel={() => setShowForm(false)} />
            : (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, marginBottom: 8, justifyContent: 'center' }}
                onClick={() => setShowForm(true)}>
                + Thêm tài khoản mới
              </button>
            )
          }
        </div>

        {/* Usage tip */}
        <div className="acct-tip">
          <strong>Cách dùng với Bridge node:</strong>
          Click node Bridge → Inspector → tab ACCOUNTS → chọn tài khoản.
          Khi credit hết (app phát hiện qua selector), workflow tự chuyển sang tài khoản tiếp theo.
        </div>
      </div>
    </div>
  );
}

function AccountRow({ acc, onUpdate, onRemove, onOpenSession, onCloseSession, onDeleteSession, opening }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="acct-row">
      <div className="acct-row-left">
        <div className="acct-service-icon">{SERVICE_ICONS[acc.service] || '⚪'}</div>
        <div className="acct-info">
          {editing ? (
            <input className="insp-input" style={{ fontSize: 11, padding: '2px 6px', marginBottom: 2 }}
              value={acc.email} placeholder="email@gmail.com"
              onChange={e => onUpdate({ email: e.target.value })}
              onBlur={() => setEditing(false)}
              autoFocus
            />
          ) : (
            <div className="acct-email" onDoubleClick={() => setEditing(true)}>
              {acc.email || <span style={{ color: 'var(--text-faint)' }}>Double-click để nhập email</span>}
            </div>
          )}
          <div className="acct-meta">
            <select className="acct-select-sm" value={acc.service}
              onChange={e => onUpdate({ service: e.target.value })}>
              {Object.keys(SERVICE_ICONS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="acct-status" style={{ color: CREDIT_COLORS[acc.creditStatus] }}>
              ● {acc.creditStatus === 'ok' ? 'Credit OK' : acc.creditStatus === 'empty' ? 'Hết credit' : 'Chưa biết'}
            </span>
            <span className="acct-session" style={{ color: acc.sessionReady ? 'var(--signal)' : 'var(--text-dim)' }}>
              {acc.sessionReady ? '🔓 Session sẵn' : '🔒 Chưa login'}
            </span>
          </div>
          {acc.notes && <div className="acct-notes">{acc.notes}</div>}
        </div>
      </div>

      <div className="acct-row-actions">
        {/* Credit status toggle */}
        <button className="btn" style={{ fontSize: 9, padding: '3px 7px' }}
          title="Đánh dấu trạng thái credit"
          onClick={() => {
            const next = acc.creditStatus === 'ok' ? 'empty' : 'ok';
            onUpdate({ creditStatus: next });
          }}>
          {acc.creditStatus === 'ok' ? '✓ OK' : acc.creditStatus === 'empty' ? '✗ Empty' : '? Status'}
        </button>

        {/* Open/login session */}
        <button className="btn btn-primary" style={{ fontSize: 9, padding: '3px 8px' }}
          onClick={onOpenSession} disabled={opening} title="Mở browser để login">
          {opening ? '...' : acc.sessionReady ? '🔄 Re-login' : '🔑 Login'}
        </button>

        {/* Delete session */}
        {acc.sessionReady && (
          <button className="btn" style={{ fontSize: 9, padding: '3px 7px', color: 'var(--warning)' }}
            onClick={onDeleteSession} title="Xóa session (logout)">
            🗑 Session
          </button>
        )}

        {/* Remove account */}
        <button className="btn" style={{ fontSize: 9, padding: '3px 7px', color: 'var(--danger)' }}
          onClick={onRemove} title="Xóa tài khoản này">
          ✕
        </button>
      </div>
    </div>
  );
}

function AddAccountForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ email: '', password: '', service: 'Google', notes: '' });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="acct-add-form">
      <div className="insp-group-title" style={{ marginBottom: 10 }}>THÊM TÀI KHOẢN MỚI</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div className="insp-field" style={{ marginBottom: 0 }}>
          <div className="insp-label">Email</div>
          <input className="insp-input" value={form.email} onChange={f('email')} placeholder="user@gmail.com" />
        </div>
        <div className="insp-field" style={{ marginBottom: 0 }}>
          <div className="insp-label">Password (tùy chọn)</div>
          <input className="insp-input" type="password" value={form.password} onChange={f('password')} placeholder="••••••••" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
        <div className="insp-field" style={{ marginBottom: 0 }}>
          <div className="insp-label">Service</div>
          <select className="insp-select" value={form.service} onChange={f('service')}>
            {Object.keys(SERVICE_ICONS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="insp-field" style={{ marginBottom: 0 }}>
          <div className="insp-label">Notes (tùy chọn)</div>
          <input className="insp-input" value={form.notes} onChange={f('notes')} placeholder="Account chính / backup #1 / temp..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => onAdd(form)} disabled={!form.email}>
          + Thêm
        </button>
        <button className="btn" onClick={onCancel}>Hủy</button>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>
        Password lưu local trên máy bạn, không gửi đi đâu. Sau khi thêm, nhấn <strong>Login</strong> để mở browser và đăng nhập thủ công.
      </div>
    </div>
  );
}
