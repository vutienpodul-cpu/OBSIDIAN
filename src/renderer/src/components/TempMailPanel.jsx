/**
 * TempMailPanel — Tạo email tạm để đăng ký tài khoản mới.
 * Dùng GuerillaMail API (miễn phí, không cần auth).
 */
import React, { useState, useEffect, useRef } from 'react';

export default function TempMailPanel({ onClose }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [inbox, setInbox] = useState([]);
  const [openEmail, setOpenEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customUser, setCustomUser] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function generateNew() {
    setLoading(true); setError('');
    try {
      const res = await window.obsidian.tempmail.newAddress();
      if (res.ok) {
        setEmail(res.email);
        setToken(res.token);
        setInbox([]);
        setOpenEmail(null);
        startPolling(res.token);
      } else {
        setError(res.error || 'Không tạo được email');
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function setCustomAddress() {
    if (!customUser.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await window.obsidian.tempmail.setAddress(customUser.trim());
      if (res.ok) {
        setEmail(res.email);
        setToken(res.token);
        setInbox([]);
        startPolling(res.token);
      } else {
        setError(res.error || 'Không đặt được địa chỉ');
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function startPolling(tok) {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(true);
    const interval = setInterval(() => fetchInbox(tok), 6000);
    pollRef.current = interval;
    fetchInbox(tok);
  }

  async function fetchInbox(tok) {
    try {
      const res = await window.obsidian.tempmail.inbox(tok || token, 0);
      if (res.ok) setInbox(res.emails || []);
    } catch {}
  }

  async function openMail(mail) {
    setLoading(true);
    try {
      const res = await window.obsidian.tempmail.read(mail.mail_id, token);
      if (res.ok) setOpenEmail({ ...mail, ...res });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function copy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function forget() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await window.obsidian.tempmail.forget();
    setEmail(''); setToken(''); setInbox([]); setOpenEmail(''); setPolling(false);
  }

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="tempmail-modal" onClick={e => e.stopPropagation()}>
        <div className="gallery-header" style={{ paddingBottom: 14 }}>
          <div>
            <div className="gallery-eyebrow">OBSIDIAN STUDIO</div>
            <h2 className="gallery-title" style={{ fontSize: 18 }}>Temp Mail</h2>
            <p className="gallery-sub">Tạo email tạm để đăng ký tài khoản mới. Inbox tự động refresh mỗi 6 giây.</p>
          </div>
          <button className="gallery-close" onClick={onClose}>✕</button>
        </div>

        <div className="tempmail-body">
          {/* Email generation */}
          <div className="tempmail-section">
            <div className="insp-group-title">ĐỊA CHỈ EMAIL TẠM</div>
            {email ? (
              <div className="tempmail-email-box">
                <div className="tempmail-address">{email}</div>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '6px 14px' }}
                  onClick={() => copy(email)}>
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            ) : (
              <div className="tempmail-placeholder">Nhấn nút bên dưới để tạo email tạm</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={generateNew} disabled={loading}>
                {loading ? '...' : email ? '🔄 Email mới' : '✉ Tạo email tạm'}
              </button>
              {email && (
                <button className="btn" style={{ fontSize: 10 }} onClick={forget} title="Hủy email này">
                  🗑 Hủy
                </button>
              )}
            </div>

            {/* Custom address */}
            <div style={{ marginTop: 12 }}>
              <div className="insp-group-title" style={{ marginBottom: 6 }}>TÙY CHỈNH TÊN EMAIL</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="insp-input" style={{ flex: 1 }}
                  value={customUser} onChange={e => setCustomUser(e.target.value)}
                  placeholder="myname123 (trước @guerrillamail.com)"
                  onKeyDown={e => e.key === 'Enter' && setCustomAddress()}
                />
                <button className="btn" onClick={setCustomAddress} disabled={!customUser.trim() || loading}>
                  Đặt
                </button>
              </div>
            </div>

            {error && <div className="tempmail-error">{error}</div>}
          </div>

          {/* Inbox */}
          {email && (
            <div className="tempmail-section">
              <div className="insp-group-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>HỘP THƯ {inbox.length > 0 && <span style={{ color: 'var(--signal)' }}>· {inbox.length} email</span>}</span>
                <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                  {polling ? '● Auto-refresh' : ''}
                </span>
              </div>

              {inbox.length === 0 ? (
                <div className="tempmail-inbox-empty">
                  <div style={{ fontSize: 22 }}>📭</div>
                  Đang chờ email... (thường mất 10-30 giây)
                </div>
              ) : (
                <div className="tempmail-inbox">
                  {inbox.map((m) => (
                    <div key={m.mail_id} className={`tempmail-mail-row ${openEmail?.mail_id === m.mail_id ? 'active' : ''}`}
                      onClick={() => openMail(m)}>
                      <div className="tempmail-mail-subject">{m.mail_subject || '(No subject)'}</div>
                      <div className="tempmail-mail-meta">
                        <span>{m.mail_from}</span>
                        <span>{m.mail_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Open email detail */}
          {openEmail && (
            <div className="tempmail-section">
              <div className="insp-group-title">
                NỘI DUNG EMAIL
                <button className="btn" style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px' }}
                  onClick={() => setOpenEmail(null)}>
                  Thu lại
                </button>
              </div>
              <div className="tempmail-mail-detail">
                <div className="tempmail-mail-header">
                  <strong>{openEmail.subject}</strong>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>From: {openEmail.from}</div>
                </div>

                {/* Extract links — most useful part */}
                {openEmail.links && openEmail.links.length > 0 && (
                  <div className="tempmail-links-box">
                    <div className="insp-group-title" style={{ marginBottom: 6 }}>🔗 LINKS TRONG EMAIL</div>
                    {openEmail.links.slice(0, 5).map((link, i) => (
                      <div key={i} className="tempmail-link-row">
                        <span className="tempmail-link-text">{link.slice(0, 60)}{link.length > 60 ? '...' : ''}</span>
                        <button className="btn btn-primary" style={{ fontSize: 9, padding: '3px 8px', flexShrink: 0 }}
                          onClick={() => copy(link)}>
                          Copy link
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw body */}
                <div className="tempmail-body-raw"
                  dangerouslySetInnerHTML={{ __html: openEmail.body?.replace(/<script[^>]*>.*?<\/script>/gi, '') }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
