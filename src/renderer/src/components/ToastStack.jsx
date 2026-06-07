import React from 'react';
import { useStore } from '../store.js';

const ICONS = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };

export default function ToastStack() {
  const toasts = useStore(s => s.toasts);
  const dismissToast = useStore(s => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type || 'success'}`}
          onClick={() => dismissToast(t.id)}
          role="status"
        >
          <span className="toast-icon">{ICONS[t.type] || ICONS.success}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
