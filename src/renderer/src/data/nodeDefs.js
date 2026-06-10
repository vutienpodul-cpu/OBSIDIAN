/**
 * Node type definitions for OBSIDIAN.
 * Each definition describes: visual (icon, category), schema (params),
 * and execution behavior (the executor reads `kind` to dispatch).
 */

export const CATEGORIES = {
  input:          { label: 'INPUT',          color: '#4A90E2' },
  direction:      { label: 'DIRECTION',      color: '#E8B4A0' },
  intelligence:   { label: 'INTELLIGENCE',   color: '#8B5CF6' },
  bridge:         { label: 'AI BRIDGE',      color: '#DC2855' },
  generation:     { label: 'GENERATION',     color: '#14B8A6' },
  orchestration:  { label: 'ORCHESTRATION',  color: '#94A3B8' },
};

// Thêm URL Source + Click Sequence vào đầu danh sách bridge

export const NODE_DEFS = [
  // ---------- INPUT ----------
  { kind: 'url_source', cat: 'input', icon: '🌐', name: 'URL Source', desc: 'Địa chỉ website cần mở',
    schema: [
      { key: 'url',  label: 'URL', type: 'text', default: 'https://' },
      { key: 'note', label: 'Ghi chú', type: 'text', default: '' },
    ]},
  { kind: 'brief',       cat: 'input',         icon: 'B', name: 'Brief',          desc: 'Yêu cầu thô từ client',
    schema: [
      { key: 'text',     label: 'Brief text',    type: 'textarea', default: '' },
      { key: 'tags',     label: 'Tags',          type: 'tags',     default: [] },
    ]},
  { kind: 'reference',   cat: 'input',         icon: 'R', name: 'Reference',      desc: 'Ảnh/video tham khảo',
    schema: [
      { key: 'files',    label: 'Files',         type: 'files',    default: [] },
      { key: 'note',     label: 'Note',          type: 'text',     default: '' },
    ]},
  { kind: 'moodboard',   cat: 'input',         icon: 'M', name: 'Moodboard',      desc: 'Grid + palette',
    schema: [
      { key: 'palette',  label: 'Palette hint',  type: 'text',     default: 'Earth · Mocha' },
      { key: 'mood',     label: 'Mood',          type: 'text',     default: 'Editorial' },
    ]},

  // ---------- DIRECTION ----------
  { kind: 'prompt',      cat: 'direction',     icon: 'P', name: 'Prompt',         desc: 'Định hướng style',
    schema: [
      { key: 'text',     label: 'Prompt text',   type: 'textarea', default: '' },
      { key: 'lang',     label: 'Language',      type: 'select', options: ['EN','VI','Multi'], default: 'EN' },
    ]},
  { kind: 'style',       cat: 'direction',     icon: 'S', name: 'Style Preset',   desc: 'Tech-Noir / Luxury / ...',
    schema: [
      { key: 'preset',   label: 'Preset',        type: 'select',
        options: ['Tech-Noir Pro','Luxury Editorial','Brutalist','Cinematic','Minimalist'], default: 'Tech-Noir Pro' },
      { key: 'strength', label: 'Strength',      type: 'range', min: 0, max: 1, step: 0.05, default: 0.85 },
    ]},
  { kind: 'camera',      cat: 'direction',     icon: 'C', name: 'Camera Script',  desc: 'Shot list, motion',
    schema: [
      { key: 'shots',    label: 'Shots',         type: 'number', default: 8 },
      { key: 'motion',   label: 'Motion type',   type: 'select',
        options: ['Pan','Orbit','Crane','Tilt','Morph','Static'], default: 'Orbit' },
    ]},

  // ---------- INTELLIGENCE ----------
  { kind: 'merge',       cat: 'intelligence',  icon: '⊕', name: 'Merge',          desc: 'Tổng hợp context',
    schema: [
      { key: 'strategy', label: 'Strategy',      type: 'select',
        options: ['concat','structured','priority'], default: 'structured' },
    ]},
  { kind: 'analyzer',    cat: 'intelligence',  icon: '∿', name: 'Analyzer',       desc: 'Trích intent + tone',
    schema: [
      { key: 'extract',  label: 'Extract',       type: 'tags', default: ['intent','tone','keywords'] },
    ]},
  { kind: 'compiler',    cat: 'intelligence',  icon: '⌘', name: 'Prompt Compiler', desc: 'Build prompts kỹ thuật',
    schema: [
      { key: 'targets',  label: 'Targets',       type: 'tags',
        default: ['midjourney','sora','runway'] },
      { key: 'variants', label: 'Variants',      type: 'number', default: 8 },
    ]},

  // ---------- AI BRIDGE ----------
  { kind: 'click_seq', cat: 'bridge', icon: '👆', name: 'Click Sequence', desc: 'Ghi từng click thủ công trên website',
    schema: [
      { key: 'url',      label: 'Fallback URL',         type: 'text',   default: '' },
      { key: 'steps',    label: 'Steps (JSON)',         type: 'json',   default: [] },
      { key: 'sessionId',label: 'Session ID',           type: 'text',   default: '' },
      { key: 'delay',    label: 'Delay ms/step',        type: 'number', default: 300 },
      { key: 'grabFrom', label: 'Grab output from',     type: 'text',   default: '' },
      { key: 'grabAttr', label: 'Grab attribute',       type: 'select',
        options: ['src','href','text'],                   default: 'src' },
      { key: 'waitFor',  label: 'Wait stable selector', type: 'text',   default: '' },
      { key: 'timeout',  label: 'Timeout (sec)',        type: 'number', default: 180 },
    ]},
  { kind: 'bridge',      cat: 'bridge',        icon: '▣', name: 'Browser Bridge', desc: 'Embed bất kỳ URL — record/replay',
    schema: [
      { key: 'url',        label: 'Embedded URL',     type: 'text',
        default: 'https://www.midjourney.com/imagine' },
      { key: 'mode',       label: 'Replay mode',      type: 'select',
        options: ['Manual','Hybrid','Full Auto'],     default: 'Hybrid' },
      { key: 'actions',    label: 'Recorded actions', type: 'json',  default: [] },
      { key: 'injectInto', label: 'Inject input into', type: 'text', default: '' },
      { key: 'grabFrom',   label: 'Grab output from', type: 'text',  default: '' },
      { key: 'grabAttr',   label: 'Grab attribute',   type: 'select',
        options: ['src','href','text'],               default: 'src' },
      { key: 'waitFor',    label: 'Wait stable selector', type: 'text', default: '' },
      { key: 'timeout',    label: 'Timeout (sec)',    type: 'number', default: 180 },
    ]},

  // ---------- PROMPT FACTORY NODES (import / manual gen pipeline) ----------
  { kind: 'imageGen', cat: 'generation', icon: '◇', name: 'Image Gen', desc: 'Tạo ảnh AI từ prompt + ref (PF)',
    schema: [
      { key: 'model',          label: 'Model',            type: 'text',   default: '🍌 Nano Banana Pro' },
      { key: 'aspectRatio',    label: 'Aspect',           type: 'select', options: ['16:9','9:16','1:1','2:3','3:2'], default: '16:9' },
      { key: 'batchCount',     label: 'Batch',            type: 'number', default: 1 },
      { key: 'bridge_url',     label: 'Auto URL (opt)',   type: 'text',   default: '' },
      { key: 'bridge_inject',  label: 'Inject selector',  type: 'text',   default: '' },
      { key: 'bridge_grab',    label: 'Grab selector',    type: 'text',   default: '' },
    ]},
  { kind: 'videoGen', cat: 'generation', icon: '▷', name: 'Video Gen', desc: 'Tạo video AI từ storyboard + motion (PF)',
    schema: [
      { key: 'model',          label: 'Model',            type: 'text',   default: 'Omni Flash' },
      { key: 'aspectRatio',    label: 'Aspect',           type: 'select', options: ['16:9','9:16','1:1'], default: '16:9' },
      { key: 'duration',       label: 'Duration (s)',     type: 'select', options: [4,6,8,10], default: 6 },
      { key: 'batchCount',     label: 'Batch',            type: 'number', default: 1 },
      { key: 'bridge_url',     label: 'Auto URL (opt)',   type: 'text',   default: '' },
      { key: 'bridge_inject',  label: 'Inject selector',  type: 'text',   default: '' },
      { key: 'bridge_grab',    label: 'Grab selector',    type: 'text',   default: '' },
    ]},
  { kind: 'imageUpload', cat: 'input', icon: '⬆', name: 'Image Upload', desc: 'Ảnh nguồn / kết quả đã gen',
    schema: [
      { key: 'uploadLabel', label: 'Label', type: 'text',  default: 'Ảnh nguồn' },
      { key: 'files',       label: 'Files', type: 'files', default: [] },
    ]},
  { kind: 'stitcher', cat: 'orchestration', icon: '⊞', name: 'Stitcher', desc: 'Ghép tất cả video clip thành film',
    schema: [
      { key: 'progress', label: 'Progress', type: 'range', min: 0, max: 100, step: 1, default: 0 },
    ]},

  // ---------- GENERATION (preset Bridge) ----------
  { kind: 'image_forge', cat: 'generation',    icon: '◇', name: 'Image Forge',    desc: 'Midjourney / Higgsfield',
    schema: [
      { key: 'engine',   label: 'Engine',        type: 'select',
        options: ['Midjourney','Higgsfield','Stable Diffusion XL','Flux'], default: 'Midjourney' },
      { key: 'aspect',   label: 'Aspect ratio',  type: 'select',
        options: ['16:9','9:16','1:1','2.39:1','4:3'], default: '16:9' },
      { key: 'count',    label: 'Variants',      type: 'number', default: 4 },
    ]},
  { kind: 'storyboard',  cat: 'generation',    icon: '▦', name: 'Storyboard',     desc: 'Sequence builder',
    schema: [
      { key: 'aspect',   label: 'Aspect',        type: 'select',
        options: ['16:9','9:16','1:1','2.39:1'], default: '2.39:1' },
      { key: 'annotate', label: 'Auto annotate', type: 'toggle', default: true },
    ]},
  { kind: 'video_forge', cat: 'generation',    icon: '▷', name: 'Video Forge',    desc: 'Sora / Runway / Kling',
    schema: [
      { key: 'engine',   label: 'Engine',        type: 'select',
        options: ['Sora','Runway','Kling','Hailuo'], default: 'Sora' },
      { key: 'duration', label: 'Duration (s)',  type: 'number', default: 5 },
    ]},
  { kind: 'vfx',         cat: 'generation',    icon: '⧉', name: 'VFX Compositor', desc: 'Layer + blend + motion',
    schema: [
      { key: 'particles', label: 'Particles',    type: 'tags', default: ['Dust','Lens flare'] },
      { key: 'motion_cam', label: 'Camera motion', type: 'toggle', default: true },
    ]},

  // ---------- ORCHESTRATION ----------
  { kind: 'approval',    cat: 'orchestration', icon: '⏸', name: 'Approval Gate',  desc: 'Pause for review',
    schema: [
      { key: 'channel',  label: 'Notify channel', type: 'select',
        options: ['Slack','Email','Both','None'], default: 'Slack' },
    ]},
  { kind: 'loop',        cat: 'orchestration', icon: '↻', name: 'Loop',           desc: 'Iterate variants',
    schema: [
      { key: 'count',    label: 'Iterations',    type: 'number', default: 3 },
    ]},
  { kind: 'condition',   cat: 'orchestration', icon: '?', name: 'Condition',      desc: 'If / Else logic',
    schema: [
      { key: 'expr',     label: 'Expression',    type: 'text', default: 'output.length > 0' },
    ]},
  { kind: 'export',      cat: 'orchestration', icon: '⤓', name: 'Export',         desc: 'PSD / MP4 / PPTX',
    schema: [
      { key: 'format',   label: 'Format',        type: 'select',
        options: ['PNG sequence','MP4 (H.265)','ProRes 4K','PSD','PPTX','GLB'], default: 'MP4 (H.265)' },
      { key: 'path',     label: 'Output folder', type: 'folder', default: '' },
    ]},
  { kind: 'delivery',    cat: 'orchestration', icon: '→', name: 'Delivery',       desc: 'Drive / Mail / Slack',
    schema: [
      { key: 'target',   label: 'Target',        type: 'select',
        options: ['Google Drive','Dropbox','Email','Slack'], default: 'Google Drive' },
      { key: 'message',  label: 'Message',       type: 'textarea', default: '' },
    ]},
];

export const DEFS_BY_KIND = Object.fromEntries(NODE_DEFS.map(d => [d.kind, d]));

export function defaultDataFor(kind) {
  const def = DEFS_BY_KIND[kind];
  if (!def) return {};
  const data = { kind, label: def.name, icon: def.icon, cat: def.cat };
  for (const f of def.schema) data[f.key] = f.default;
  return data;
}
