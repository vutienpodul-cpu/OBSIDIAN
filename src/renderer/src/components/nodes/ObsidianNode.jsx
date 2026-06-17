/**
 * Universal node renderer for OBSIDIAN — one component, styling driven by data.cat.
 */
import React, { memo, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { useStore } from '../../store.js';
import {
  WEB_TASK_KINDS,
  WEB_TASK_HANDLE_DEFS,
  WEB_TASK_HANDLE_LABELS,
} from '../../engine/workflowUtils.js';

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
    case 'imageGen':
      return [
        { l: 'Model', v: data.model || '—' },
        { l: 'Steps', v: (data.steps||[]).length },
        { l: 'URL', v: shortUrl(data.url || data.bridge_url) },
        { l: 'Setup', v: (data.steps||[]).length ? 'READY' : 'NEEDS SETUP' },
      ];
    case 'videoGen':
      return [
        { l: 'Model', v: data.model || '—' },
        { l: 'Duration', v: (data.duration || 6) + 's' },
        { l: 'Steps', v: (data.steps||[]).length },
        { l: 'Setup', v: (data.steps||[]).length ? 'READY' : 'NEEDS SETUP' },
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

function WebTaskHandles({ nodeId, kind, edges }) {
  const handles = WEB_TASK_HANDLE_DEFS[kind] || [];
  const connected = useMemo(() => {
    const set = new Set();
    edges.filter(e => e.target === nodeId).forEach(e => {
      if (e.targetHandle) set.add(e.targetHandle);
    });
    return set;
  }, [edges, nodeId]);

  const count = handles.length;
  return handles.map((handleId, i) => {
    const topPct = ((i + 1) / (count + 1)) * 100;
    const label = WEB_TASK_HANDLE_LABELS[handleId] || handleId;
    const isOn = connected.has(handleId);
    return (
      <React.Fragment key={handleId}>
        <Handle
          type="target"
          position={Position.Left}
          id={handleId}
          className={`node-handle-${handleId.replace('-', '')}`}
          style={{ top: `${topPct}%` }}
        />
        <span
          className={`node-handle-label ${isOn ? 'connected' : ''}`}
          style={{ top: `${topPct}%` }}
        >
          {label}
        </span>
      </React.Fragment>
    );
  });
}

function ObsidianNode({ id, data, selected }) {
  const edges = useStore(s => s.edges);
  const rows = summaryRowsFor(data);
  const isWebTask = WEB_TASK_KINDS.includes(data.kind);
  const promptSlots = data.promptSlots || [];
  const status = data._status; // 'executing' | 'done' | 'errored'
  const classes = [
    'node',
    isWebTask ? 'node-web-task' : '',
    `cat-${data.cat}`,
    selected ? 'selected' : '',
    status || ''
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {isWebTask
        ? <WebTaskHandles nodeId={id} kind={data.kind} edges={edges} />
        : <Handle type="target" position={Position.Left} id="in" />}

      <Handle type="source" position={Position.Right} id="out" />

      <div className="node-header">
        <div className="node-icon">{data.icon}</div>
        <div className="node-title">{data.label}</div>
        <div className="node-status" />
      </div>

      <div className="node-body">
        {isWebTask && promptSlots.length > 0 && (
          <div className="node-prompt-slots">
            {promptSlots.map((slot, i) => (
              <div className="node-field" key={slot.handle || i}>
                <span className="label">{slot.label || `Prompt ${i + 1}`}</span>
                <span className="value">→ step {(slot.stepIndex ?? 0) + 1}</span>
              </div>
            ))}
          </div>
        )}

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
