/**
 * Universal node renderer for OBSIDIAN — one component, styling driven by data.cat.
 */
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

function summaryRowsFor(data) {
  // Small preview rows shown inside each node body
  switch (data.kind) {
    case 'brief':
      return [
        { l: 'Length', v: `${(data.text||'').length} chars` },
        { l: 'Tags', v: (data.tags||[]).slice(0,3).join(', ') || '—' },
      ];
    case 'reference':
      return [
        { l: 'Files', v: `${(data.files||[]).length} items` },
        { l: 'Note', v: data.note || '—' },
      ];
    case 'moodboard':
      return [
        { l: 'Palette', v: data.palette },
        { l: 'Mood', v: data.mood },
      ];
    case 'prompt':
      return [
        { l: 'Tokens', v: Math.round((data.text||'').split(/\s+/).length) },
        { l: 'Lang', v: data.lang },
      ];
    case 'style':
      return [
        { l: 'Preset', v: data.preset },
        { l: 'Strength', v: (data.strength*100).toFixed(0)+'%' },
      ];
    case 'camera':
      return [
        { l: 'Shots', v: data.shots },
        { l: 'Motion', v: data.motion },
      ];
    case 'merge':
      return [{ l: 'Strategy', v: data.strategy }];
    case 'analyzer':
      return [{ l: 'Extract', v: (data.extract||[]).join(', ') }];
    case 'compiler':
      return [
        { l: 'Targets', v: (data.targets||[]).join(', ') },
        { l: 'Variants', v: data.variants },
      ];
    case 'url_source':
      return [
        { l: 'URL', v: shortUrl(data.url) },
        { l: 'Note', v: data.note || '—' },
      ];
    case 'click_seq':
      return [
        { l: 'Steps', v: (data.steps||[]).length },
        { l: 'Session', v: data.sessionId || 'default' },
        { l: 'Delay', v: (data.delay||300)+'ms' },
      ];
    case 'bridge':
      return [
        { l: 'URL', v: shortUrl(data.url) },
        { l: 'Steps', v: (data.actions||[]).length },
        { l: 'Mode', v: data.mode },
      ];
    case 'image_forge':
      return [
        { l: 'Engine', v: data.engine },
        { l: 'Aspect', v: data.aspect },
        { l: 'Variants', v: data.count },
      ];
    case 'storyboard':
      return [
        { l: 'Aspect', v: data.aspect },
        { l: 'Annotate', v: data.annotate ? 'Auto' : 'Off' },
      ];
    case 'video_forge':
      return [
        { l: 'Engine', v: data.engine },
        { l: 'Duration', v: data.duration+'s' },
      ];
    case 'vfx':
      return [
        { l: 'Particles', v: (data.particles||[]).join(', ') },
        { l: 'Cam motion', v: data.motion_cam ? 'On' : 'Off' },
      ];
    case 'approval':
      return [{ l: 'Channel', v: data.channel }];
    case 'loop':
      return [{ l: 'Iterations', v: data.count }];
    case 'condition':
      return [{ l: 'Expr', v: data.expr }];
    case 'export':
      return [
        { l: 'Format', v: data.format },
        { l: 'Path', v: data.path || 'Ask on run' },
      ];
    case 'delivery':
      return [{ l: 'Target', v: data.target }];
    default:
      return [];
  }
}

function shortUrl(u) {
  if (!u) return '—';
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u.slice(0, 24); }
}

function ObsidianNode({ data, selected }) {
  const rows = summaryRowsFor(data);
  const status = data._status; // 'executing' | 'done' | 'errored'
  const classes = [
    'node',
    `cat-${data.cat}`,
    selected ? 'selected' : '',
    status || ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Handle type="target" position={Position.Left}  id="in" />
      <Handle type="source" position={Position.Right} id="out" />

      <div className="node-header">
        <div className="node-icon">{data.icon}</div>
        <div className="node-title">{data.label}</div>
        <div className="node-status" />
      </div>

      <div className="node-body">
        {rows.map((r,i) => (
          <div className="node-field" key={i}>
            <span className="label">{r.l}</span>
            <span className="value">{String(r.v ?? '—')}</span>
          </div>
        ))}

        {/* Output preview */}
        {(() => {
          const previewItems = data._output?.items
            ?? (Array.isArray(data._output) ? data._output : []);
          const first = previewItems[0];
          if (!first) return null;
          return (
            <div className="node-preview">
              {typeof first === 'string' && /\.(png|jpg|jpeg|webp|gif)/i.test(first)
                ? <img src={first} alt="preview" />
                : <span>{previewItems.length} outputs ready</span>}
            </div>
          );
        })()}

        {data.tags && data.tags.length > 0 && (
          <div className="tag-row">
            {data.tags.map((t,i) => <span className="tag" key={i}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ObsidianNode);
