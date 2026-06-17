import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store.js';

/* ================================================================
   PURE CORE — ported from PROMPT_FACTORY_STUDIO.html
   ================================================================ */
const COL_X = { upload:0, ref_prompt:480, ref_gen:960, sb_prompt:1440, sb_gen:1920, vid_prompt:2400, vid_gen:2880, stitch:3360 };
const Y_GEN = 360;
let _seq = Date.now();
const nid = () => `node-${++_seq}`;
const mkEdge = (s, t, opts = {}) => ({
  type: 'default',
  markerEnd: { type: 'arrowclosed', color: 'rgba(255,255,255,0.35)' },
  source: s, target: t,
  targetHandle: opts.targetHandle,
  id: `xy-edge__${s}-${t}${opts.targetHandle ? '-' + opts.targetHandle : ''}`,
});
const pNode = (text, x, y) => ({ id: nid(), type: 'prompt',      position: { x, y }, data: { label: 'Prompt Nhập liệu', status: 'idle', params: { text } } });
const iNode = (model, aspect, x, y) => ({ id: nid(), type: 'imageGen',   position: { x, y }, data: { label: 'Tạo Ảnh AI',   status: 'idle', params: { aspectRatio: aspect, model, batchCount: 1 } } });
const vNode = (model, aspect, dur, x, y) => ({ id: nid(), type: 'videoGen',   position: { x, y }, data: { label: 'Tạo Video AI', status: 'idle', params: { aspectRatio: aspect, model, duration: dur, batchCount: 1 } } });
const uNode = (label, x, y) => ({ id: nid(), type: 'imageUpload', position: { x, y }, data: { label: label || 'Nguồn Ảnh Tải lên', status: 'idle', params: {} } });
const sNode = (x, y) => ({ id: nid(), type: 'stitcher',   position: { x, y }, data: { label: 'Ghép Video', status: 'idle', params: { progress: 0 } } });

function compileFlow(m) {
  const imgM = (m.models && m.models.image) || '🍌 Nano Banana Pro';
  const vidM = (m.models && m.models.video) || 'Omni Flash';
  const asp  = m.aspect || '16:9';
  const nodes = [], edges = [], idMap = {};

  (m.uploads || []).forEach((up, i) => {
    const n = uNode(up.label, COL_X.upload, i * Y_GEN);
    nodes.push(n); idMap[up.id] = n.id;
  });

  const assets = [...(m.ref_assets || []), ...(m.env_plates || [])];
  assets.forEach((a, i) => {
    const y = i * Y_GEN;
    const p = pNode(a.prompt, COL_X.ref_prompt, y);
    const g = iNode(imgM, a.aspect || asp, COL_X.ref_gen, y);
    nodes.push(p, g); edges.push(mkEdge(p.id, g.id, { targetHandle: 'prompt-1' }));
    if (a.use_upload && (m.uploads || []).length) edges.push(mkEdge(idMap[m.uploads[0].id], g.id, { targetHandle: 'image' }));
    idMap[a.id] = g.id;
  });

  const vids = [];
  (m.shots || []).forEach((s, i) => {
    const y = i * Y_GEN, dur = parseInt(s.duration);
    if (![4, 6, 8, 10].includes(dur)) throw new Error(`Shot ${s.id}: duration ${s.duration} không thuộc 4/6/8/10`);
    const sp = pNode(s.storyboard_prompt, COL_X.sb_prompt, y);
    const sg = iNode(imgM, s.aspect || asp, COL_X.sb_gen, y);
    const vp = pNode(s.video_prompt, COL_X.vid_prompt, y);
    const vg = vNode(vidM, s.aspect || asp, dur, COL_X.vid_gen, y);
    nodes.push(sp, sg, vp, vg);
    edges.push(mkEdge(sp.id, sg.id, { targetHandle: 'prompt-1' }));
    (s.refs || []).forEach(r => {
      if (!idMap[r]) throw new Error(`Shot ${s.id}: ref '${r}' không tồn tại`);
      edges.push(mkEdge(idMap[r], sg.id, { targetHandle: 'image' }));
    });
    if (s.env) {
      if (!idMap[s.env]) throw new Error(`Shot ${s.id}: env '${s.env}' không tồn tại`);
      edges.push(mkEdge(idMap[s.env], sg.id, { targetHandle: 'image' }));
    }
    edges.push(mkEdge(sg.id, vg.id, { targetHandle: 'image' }));
    edges.push(mkEdge(vp.id, vg.id, { targetHandle: 'prompt-1' }));
    (s.refs_to_video || []).forEach(r => edges.push(mkEdge(idMap[r], vg.id, { targetHandle: 'image' })));
    if (s.upload_to_video && (m.uploads || []).length) edges.push(mkEdge(idMap[m.uploads[0].id], vg.id, { targetHandle: 'image' }));
    vids.push(vg.id);
  });

  if (m.stitch !== false && vids.length) {
    const st = sNode(COL_X.stitch, Math.floor((vids.length - 1) * Y_GEN / 2));
    nodes.push(st); vids.forEach(v => edges.push(mkEdge(v, st.id)));
  }

  // validate
  const byId = {}; nodes.forEach(n => byId[n.id] = n);
  const promptFan = {};
  edges.forEach(e => {
    const src = byId[e.source];
    if (!src || src.type !== 'prompt') return;
    if (e.targetHandle?.startsWith('prompt-') || !e.targetHandle) {
      promptFan[e.target] = (promptFan[e.target] || 0) + 1;
    }
  });
  const linked = new Set(); edges.forEach(e => { linked.add(e.source); linked.add(e.target); });
  const errs = [];
  nodes.forEach(n => {
    if (n.type === 'imageGen' && (promptFan[n.id] || 0) < 1)
      errs.push(`${n.id} (imageGen): cần ít nhất 1 prompt vào cổng Prompt`);
    if (n.type === 'videoGen') {
      if ((promptFan[n.id] || 0) < 1)
        errs.push(`${n.id} (videoGen): cần ít nhất 1 prompt vào cổng Prompt`);
      if (!edges.some(e => e.target === n.id && e.targetHandle === 'image' && ['imageGen', 'imageUpload'].includes(byId[e.source]?.type)))
        errs.push(`${n.id} (videoGen): không có dây ảnh vào cổng Image`);
    }
    if (!linked.has(n.id)) errs.push(`${n.id} (${n.type}): node mồ côi`);
  });
  if (errs.length) throw new Error('COMPILE FAIL:\n  ' + errs.join('\n  '));
  return { nodes, edges, timestamp: new Date().toISOString() };
}

function buildMegaPrompt(f) {
  const style = f.style && f.style.trim()
    ? f.style.trim()
    : 'Luxury - Elegant - Mysterious: cinematic tech-noir, chiaroscuro, rose gold + obsidian, brushed metal, 35mm anamorphic, slow seamless camera moves';
  const hasImg = f.img === 'yes';
  const uploadsLine = hasImg
    ? '  "uploads": [ { "id": "UP_PRODUCT", "label": "Ảnh sản phẩm thật" } ],'
    : '  "uploads": [],';
  const uploadRule = hasImg
    ? '□ uploads có UP_PRODUCT → ít nhất 1 ref_assets (ref sản phẩm) phải use_upload:true'
    : '□ uploads phải là [] — mọi use_upload và upload_to_video phải false';
  return [
    'Bạn là PROMPT FACTORY ENGINE — hệ thống sản xuất prompt TVC chuyên nghiệp. Thực hiện đúng quy trình, đầu ra CHỈ là 1 khối JSON manifest, không giải thích thêm.',
    '',
    '=== INPUT DỰ ÁN ===',
    'TÊN: ' + (f.name || 'TVC_Project'),
    'BRIEF: ' + f.idea,
    'TỔNG THỜI LƯỢNG: ~' + (f.dur || '30') + 's | ASPECT: ' + f.aspect,
    'STYLE: ' + style,
    'MODEL: image="' + f.imodel + '", video="' + f.vmodel + '"',
    hasImg
      ? 'ẢNH SẢN PHẨM: ĐÍNH KÈM — phân tích kỹ (hình dáng, chất liệu, màu, chi tiết đặc trưng, đèn, bánh...) để viết Product Block chính xác. Trong manifest đặt uploads=[{id:\'UP_PRODUCT\',label:\'Ảnh sản phẩm thật\'}] và use_upload=true cho ref sheet sản phẩm chính.'
      : 'ẢNH SẢN PHẨM: KHÔNG CÓ — mô tả từ brief, uploads=[].',
    f.vid === 'yes'
      ? 'VIDEO MẪU: ĐÍNH KÈM — phân tích style (lighting, palette, nhịp camera) và hòa vào Style DNA.'
      : 'VIDEO MẪU: KHÔNG CÓ.',
    '',
    '=== QUY TRÌNH (chạy nội bộ, không in ra) ===',
    '1. Viết kịch bản chia shot, mỗi shot thời lượng thuộc {4,6,8,10}s, tổng ≈ thời lượng yêu cầu. 1 shot = 1 hành động + 1 camera move (pan/orbit/dolly/crane/tracking), seamless không cut.',
    '2. Bóc tách entities: nhân vật / sản phẩm / bối cảnh (xuất hiện ≥2 shot) / cơ chế-tính năng cần sheet riêng.',
    '3. Viết STYLE DNA BLOCK (40-60 từ) + CHARACTER BLOCK (40-60 từ, bắt buộc 3 đặc điểm khuôn mặt) + PRODUCT BLOCK (30-50 từ, \'plain unbranded body\'). Block nhúng NGUYÊN VĂN vào mọi prompt liên quan.',
    '4. Viết prompt tiếng Anh cho: (a) mỗi entity 1 reference sheet (character: turnaround 4 góc + 3 biểu cảm + chi tiết 2 bàn tay đủ 5 ngón; product: 5 góc + macro; tính năng: 5 trạng thái tuần tự); (b) mỗi shot 1 storyboard grid — số panel: 4s=4 (2x2), 6s=6 (2x3), 8s=8 (2x4), 10s=10 (2x5), mô tả TỪNG panel theo diễn tiến đều của 1 cú máy, nhúng đủ Block; (c) mỗi shot 1 video motion prompt dạng: [Subject Action] / [Camera Move] / [Tempo] / [Maintain] / [Duration] / [Negative Motion].',
    '5. LỌC ToS: không tên người thật/celebrity, không logo-thương hiệu bên thứ 3, không IP bản quyền, không nội dung 18+/bạo lực/trẻ em nhạy cảm, không từ kích hoạt filter. Mọi prompt kèm NEGATIVE.',
    '',
    '=== OUTPUT: CHỈ 1 KHỐI JSON THEO SCHEMA NÀY (giữ nguyên keys, chỉ điền nội dung) ===',
    '{',
    '  "project": "' + (f.name || 'TVC_Project') + '",',
    '  "models": { "image": "' + f.imodel + '", "video": "' + f.vmodel + '" },',
    '  "aspect": "' + f.aspect + '",',
    uploadsLine,
    '  "ref_assets": [ { "id": "REF_...", "prompt": "<full EN prompt + NEGATIVE>", "use_upload": true|false } ],',
    '  "env_plates": [ { "id": "ENV_...", "prompt": "<full EN prompt + NEGATIVE>" } ],',
    '  "shots": [ { "id": "S01", "duration": 4|6|8|10,',
    '      "storyboard_prompt": "<full EN grid prompt, đủ từng panel + Blocks + NEGATIVE>",',
    '      "video_prompt": "<motion prompt 6 phần>",',
    '      "refs": ["REF_..."], "env": "ENV_..." hoặc null,',
    '      "refs_to_video": ["REF_..."], "upload_to_video": true|false } ],',
    '  "stitch": true',
    '}',
    '',
    '=== CHECKLIST COMPILE (bắt buộc trước khi xuất) ===',
    '□ CHỈ 1 object JSON — không text trước/sau, không 2 khối JSON',
    '□ duration mỗi shot là số nguyên thuộc {4,6,8,10}',
    '□ mọi refs trong shots tồn tại trong ref_assets',
    '□ mọi env trong shots tồn tại trong env_plates (hoặc null)',
    uploadRule,
    '□ JSON hợp lệ, xuất trong 1 code block ```json',
  ].join('\n');
}

function extractBalancedJSONObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function extractJSON(s) {
  s = s.trim().replace(/```(?:json)?/gi, '').trim();
  try {
    const parsed = JSON.parse(s);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  const block = extractBalancedJSONObject(s);
  if (!block) throw new Error('Không tìm thấy JSON trong nội dung dán vào.');
  const rest = s.slice(s.indexOf(block) + block.length).trim();
  if (rest.startsWith('{')) {
    throw new Error('Có nhiều khối JSON — chỉ giữ 1 object manifest.');
  }
  try {
    return JSON.parse(block);
  } catch (e) {
    throw new Error('JSON không hợp lệ: ' + e.message);
  }
}

function hasUploadWire(m) {
  if ((m.ref_assets || []).some(r => r.use_upload)) return true;
  if ((m.shots || []).some(s => s.upload_to_video)) return true;
  return false;
}

function findProductRef(refs) {
  return refs.find(r => /product/i.test(r.id))
    || refs.find(r => r.id.startsWith('REF_') && !/char|character/i.test(r.id));
}

function normalizeManifest(raw, opts = {}) {
  const warnings = [];
  const m = JSON.parse(JSON.stringify(raw));
  const wantsUpload = opts.hasProductImage === true || opts.hasProductImage === 'yes';

  if (!m.project) {
    m.project = opts.name || 'TVC_Project';
    warnings.push('Thêm project từ Brief.');
  }
  if (!m.models) {
    m.models = { image: opts.imodel || '🍌 Nano Banana Pro', video: opts.vmodel || 'Omni Flash' };
    warnings.push('Thêm models mặc định từ Brief.');
  }
  if (!m.aspect) {
    m.aspect = opts.aspect || '16:9';
    warnings.push('Thêm aspect mặc định.');
  }
  if (m.stitch === undefined) {
    m.stitch = true;
    warnings.push('Thêm stitch: true.');
  }
  if (!Array.isArray(m.uploads)) {
    m.uploads = [];
    warnings.push('uploads không hợp lệ — đặt [].');
  }
  if (!Array.isArray(m.ref_assets)) m.ref_assets = [];
  if (!Array.isArray(m.env_plates)) m.env_plates = [];
  if (!Array.isArray(m.shots)) m.shots = [];

  m.ref_assets.forEach(r => {
    if (r.use_upload === undefined) r.use_upload = false;
  });

  m.shots.forEach(s => {
    if (s.upload_to_video === undefined) s.upload_to_video = false;
    if (!Array.isArray(s.refs)) s.refs = [];
    if (!Array.isArray(s.refs_to_video)) s.refs_to_video = [];
    const dur = parseInt(s.duration, 10);
    if (!Number.isNaN(dur) && s.duration !== dur) {
      warnings.push(`Shot ${s.id || '?'}: duration ${s.duration} → ${dur}`);
      s.duration = dur;
    }
  });

  if (!wantsUpload && m.uploads.length > 0) {
    warnings.push('Brief không có ảnh sản phẩm — xóa uploads[].');
    m.uploads = [];
  }

  if (m.uploads.length > 0 && !hasUploadWire(m)) {
    const productRef = findProductRef(m.ref_assets);
    if (productRef) {
      productRef.use_upload = true;
      warnings.push(`Tự bật use_upload:true cho ${productRef.id}.`);
    } else {
      warnings.push('uploads không được nối dây — xóa uploads[].');
      m.uploads = [];
    }
  }

  if (wantsUpload && m.uploads.length === 0) {
    m.uploads = [{ id: 'UP_PRODUCT', label: 'Ảnh sản phẩm thật' }];
    warnings.push('Brief có ảnh sản phẩm — thêm uploads UP_PRODUCT.');
    const productRef = findProductRef(m.ref_assets);
    if (productRef && !productRef.use_upload) {
      productRef.use_upload = true;
      warnings.push(`Tự bật use_upload:true cho ${productRef.id}.`);
    }
  }

  if (m.uploads.length === 0) {
    m.ref_assets.forEach(r => {
      if (r.use_upload) {
        r.use_upload = false;
        warnings.push(`${r.id}: tắt use_upload (không có uploads).`);
      }
    });
    m.shots.forEach(s => {
      if (s.upload_to_video) {
        s.upload_to_video = false;
        warnings.push(`Shot ${s.id}: tắt upload_to_video.`);
      }
    });
  }

  return { manifest: m, warnings };
}

function validateManifestSchema(m) {
  const errors = [];
  if (!m.project) errors.push('Thiếu project.');
  if (!m.models?.image || !m.models?.video) errors.push('Thiếu models.image hoặc models.video.');
  if (!m.aspect) errors.push('Thiếu aspect.');
  if (!Array.isArray(m.shots) || m.shots.length === 0) errors.push('shots phải có ít nhất 1 shot.');

  const refIds = new Set((m.ref_assets || []).map(r => r.id));
  const envIds = new Set((m.env_plates || []).map(e => e.id));

  (m.ref_assets || []).forEach(r => {
    if (!r.id) errors.push('ref_assets có entry thiếu id.');
    else if (!r.prompt) errors.push(`ref ${r.id}: thiếu prompt.`);
  });

  (m.env_plates || []).forEach(e => {
    if (!e.id) errors.push('env_plates có entry thiếu id.');
    else if (!e.prompt) errors.push(`env ${e.id}: thiếu prompt.`);
  });

  (m.shots || []).forEach(s => {
    const dur = parseInt(s.duration, 10);
    if (![4, 6, 8, 10].includes(dur)) {
      errors.push(`Shot ${s.id || '?'}: duration ${s.duration} không thuộc 4/6/8/10.`);
    }
    if (!s.storyboard_prompt) errors.push(`Shot ${s.id || '?'}: thiếu storyboard_prompt.`);
    if (!s.video_prompt) errors.push(`Shot ${s.id || '?'}: thiếu video_prompt.`);
    (s.refs || []).forEach(r => {
      if (!refIds.has(r)) errors.push(`Shot ${s.id}: ref '${r}' không tồn tại trong ref_assets.`);
    });
    if (s.env && !envIds.has(s.env)) {
      errors.push(`Shot ${s.id}: env '${s.env}' không tồn tại trong env_plates.`);
    }
    (s.refs_to_video || []).forEach(r => {
      if (!refIds.has(r)) errors.push(`Shot ${s.id}: refs_to_video '${r}' không tồn tại trong ref_assets.`);
    });
  });

  if ((m.uploads || []).length > 0 && !hasUploadWire(m)) {
    errors.push('uploads có dữ liệu nhưng không ref/shot nào use_upload hoặc upload_to_video.');
  }

  return errors;
}

function buildSkeletonManifest(imodel, vmodel, aspect, hasProductImage) {
  const hasImg = hasProductImage === true || hasProductImage === 'yes';
  return {
    ...SKELETON,
    models: { image: imodel, video: vmodel },
    aspect,
    uploads: hasImg ? [{ id: 'UP_PRODUCT', label: 'Ảnh sản phẩm thật' }] : [],
    ref_assets: SKELETON.ref_assets.map(r =>
      r.id === 'REF_PRODUCT' ? { ...r, use_upload: hasImg } : { ...r }
    ),
  };
}

function prepareManifestFromText(text, opts) {
  const raw = extractJSON(text);
  const { manifest, warnings } = normalizeManifest(raw, opts);
  const errors = validateManifestSchema(manifest);
  if (errors.length) throw new Error(errors.join('\n  '));
  return { manifest, warnings };
}

const SKELETON = {
  project: 'TVC_Demo',
  models: { image: '🍌 Nano Banana Pro', video: 'Omni Flash' },
  aspect: '16:9',
  uploads: [{ id: 'UP_PRODUCT', label: 'Ảnh sản phẩm thật' }],
  ref_assets: [
    { id: 'REF_CHAR_A',  prompt: '<character sheet prompt>',  use_upload: false },
    { id: 'REF_PRODUCT', prompt: '<product sheet prompt>',    use_upload: true  },
  ],
  env_plates: [{ id: 'ENV_MAIN', prompt: '<environment plate prompt>' }],
  shots: [{
    id: 'S01', duration: 6,
    storyboard_prompt: '<6-panel 2x3 grid prompt>',
    video_prompt: '<motion prompt>',
    refs: ['REF_CHAR_A', 'REF_PRODUCT'], env: 'ENV_MAIN',
    refs_to_video: ['REF_PRODUCT'], upload_to_video: false,
  }],
  stitch: true,
};

/* ================================================================
   COMPONENT
   ================================================================ */
const STORE_KEYS = ['pf_name','pf_dur','pf_aspect','pf_imodel','pf_vmodel','pf_idea','pf_style','pf_img','pf_vid'];

export default function StudioPanel({ onClose }) {
  const loadJSON     = useStore(s => s.loadJSON);
  const pushToast    = useStore(s => s.pushToast);
  const setWorkflowFilePath = useStore(s => s.setWorkflowFilePath);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('brief');

  // Tab 1 form state
  const [name,   setName]   = useState(() => localStorage.getItem('pf_name')   || '');
  const [dur,    setDur]    = useState(() => localStorage.getItem('pf_dur')    || '30');
  const [aspect, setAspect] = useState(() => localStorage.getItem('pf_aspect') || '16:9');
  const [imodel, setImodel] = useState(() => localStorage.getItem('pf_imodel') || '🍌 Nano Banana Pro');
  const [vmodel, setVmodel] = useState(() => localStorage.getItem('pf_vmodel') || 'Omni Flash');
  const [idea,   setIdea]   = useState(() => localStorage.getItem('pf_idea')   || '');
  const [style,  setStyle]  = useState(() => localStorage.getItem('pf_style')  || '');
  const [img,    setImg]    = useState(() => localStorage.getItem('pf_img')    || 'yes');
  const [vid,    setVid]    = useState(() => localStorage.getItem('pf_vid')    || 'no');

  const [megaOut,  setMegaOut]  = useState('');
  const [megaMsg,  setMegaMsg]  = useState(null);

  // Tab 2 state
  const [manifest, setManifest] = useState(() => localStorage.getItem('pf_manifest') || '');
  const [compileMsg, setCompileMsg] = useState(null);
  const [compileWarnings, setCompileWarnings] = useState([]);
  const [flow, setFlow] = useState(null);
  const [stats, setStats] = useState(null);

  const manifestOpts = { hasProductImage: img === 'yes', imodel, vmodel, aspect, name };

  // Persist form fields to localStorage
  useEffect(() => { localStorage.setItem('pf_name',   name);   }, [name]);
  useEffect(() => { localStorage.setItem('pf_dur',    dur);    }, [dur]);
  useEffect(() => { localStorage.setItem('pf_aspect', aspect); }, [aspect]);
  useEffect(() => { localStorage.setItem('pf_imodel', imodel); }, [imodel]);
  useEffect(() => { localStorage.setItem('pf_vmodel', vmodel); }, [vmodel]);
  useEffect(() => { localStorage.setItem('pf_idea',   idea);   }, [idea]);
  useEffect(() => { localStorage.setItem('pf_style',  style);  }, [style]);
  useEffect(() => { localStorage.setItem('pf_img',    img);    }, [img]);
  useEffect(() => { localStorage.setItem('pf_vid',    vid);    }, [vid]);
  useEffect(() => { localStorage.setItem('pf_manifest', manifest); }, [manifest]);

  function handleBuildMega() {
    if (!idea.trim()) { setMegaMsg({ ok: false, text: 'Chưa nhập brief.' }); return; }
    const mp = buildMegaPrompt({ name, dur, aspect, imodel, vmodel, idea, style, img, vid });
    setMegaOut(mp);
    setMegaMsg({ ok: true, text: 'Đã tạo. Bấm COPY → dán vào Claude Desktop kèm ảnh/video.' });
  }

  function handleCopyMega() {
    if (!megaOut) { setMegaMsg({ ok: false, text: 'Chưa có Mega Prompt.' }); return; }
    navigator.clipboard.writeText(megaOut).then(() => setMegaMsg({ ok: true, text: 'Đã copy vào clipboard.' }));
  }

  function handleCompile() {
    setFlow(null); setStats(null); setCompileMsg(null); setCompileWarnings([]);
    try {
      const { manifest: m, warnings } = prepareManifestFromText(manifest, manifestOpts);
      if (warnings.length) {
        setManifest(JSON.stringify(m, null, 2));
        setCompileWarnings(warnings);
      }
      const compiled = compileFlow(m);
      const sz = Math.round(JSON.stringify(compiled).length / 1024);
      setFlow({ ...compiled, _projectName: m.project || 'project' });
      setStats({
        nodes: compiled.nodes.length,
        edges: compiled.edges.length,
        shots: (m.shots || []).length,
        durations: (m.shots || []).map(s => s.duration + 's').join(' · '),
        size: sz,
      });
      const passText = warnings.length
        ? `✔ VALIDATE PASS — bấm ⬇ DOWNLOAD .JSON → mở Flow AI → Import workflow.\n⚠ Đã tự sửa ${warnings.length} mục (xem bên dưới).`
        : '✔ VALIDATE PASS — bấm ⬇ DOWNLOAD .JSON, lưu file flow_project_*.json, rồi Import vào Flow AI.';
      setCompileMsg({ ok: true, text: passText });
    } catch (e) {
      setCompileMsg({ ok: false, text: '✗ ' + e.message });
    }
  }

  function handleSanitize() {
    setFlow(null); setStats(null); setCompileMsg(null); setCompileWarnings([]);
    try {
      const { manifest: m, warnings } = prepareManifestFromText(manifest, manifestOpts);
      setManifest(JSON.stringify(m, null, 2));
      setCompileWarnings(warnings);
      setCompileMsg({
        ok: true,
        text: warnings.length
          ? `✔ Đã chuẩn hóa manifest — ${warnings.length} mục tự sửa. Bấm VALIDATE + COMPILE để tạo flow.`
          : '✔ Manifest hợp lệ — không cần sửa. Bấm VALIDATE + COMPILE để tạo flow.',
      });
    } catch (e) {
      setCompileMsg({ ok: false, text: '✗ ' + e.message });
    }
  }

  function handleDownloadManifest() {
    try {
      const { manifest: m } = prepareManifestFromText(manifest, manifestOpts);
      const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `manifest_${m.project || 'project'}.json`;
      a.click();
    } catch (e) {
      setCompileMsg({ ok: false, text: '✗ ' + e.message });
    }
  }

  function handleImportToCanvas() {
    if (!flow) return;
    const { _projectName, ...flowData } = flow;
    flowData.name = _projectName || 'PF Import';
    loadJSON(flowData, null);
    pushToast(`Import "${flowData.name}" — ${flowData.nodes.length} nodes`, 'success');
    onClose();
  }

  function handleDownload() {
    if (!flow) return;
    const { _projectName, ...flowData } = flow;
    const blob = new Blob([JSON.stringify(flowData, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flow_project_${_projectName || 'project'}.json`;
    a.click();
    pushToast('Đã tải flow JSON — mở Flow AI → Import workflow', 'info');
  }

  function handleLoadSkeleton() {
    setFlow(null); setStats(null); setCompileMsg(null); setCompileWarnings([]);
    setManifest(JSON.stringify(buildSkeletonManifest(imodel, vmodel, aspect, img), null, 2));
  }

  function handleFileLoad(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setManifest(r.result);
    r.readAsText(f);
  }

  const sel = { background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', color: 'var(--rose-gold)' };
  const norm = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' };

  return (
    <div className="gallery-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="gallery-modal" onClick={e => e.stopPropagation()}
        style={{ width: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div className="gallery-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="gallery-eyebrow">PROMPT FACTORY</div>
            <h2 className="gallery-title">Studio</h2>
            <p className="gallery-sub">Brief → Mega Prompt → Claude → Manifest → Export Flow → Import Flow AI</p>
          </div>
          <button className="gallery-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '0 24px 12px', flexShrink: 0 }}>
          {[
            { id: 'brief',    label: '① BRIEF → PROMPT' },
            { id: 'compile',  label: '② MANIFEST → FLOW' },
            { id: 'guide',    label: 'HƯỚNG DẪN' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '7px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                borderRadius: 6, cursor: 'pointer', transition: 'all .15s',
                ...(activeTab === t.id ? sel : norm),
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

          {/* ===== TAB 1: BRIEF ===== */}
          {activeTab === 'brief' && (
            <div>
              <Card title="NHẬP BRIEF DỰ ÁN">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Field label="TÊN DỰ ÁN"><input className="insp-input" value={name} onChange={e => setName(e.target.value)} placeholder="TVC_YenNangHa_T6" /></Field>
                  <Field label="TỔNG THỜI LƯỢNG (giây)"><input className="insp-input" value={dur} onChange={e => setDur(e.target.value)} placeholder="30" /></Field>
                  <Field label="ASPECT">
                    <select className="insp-input" value={aspect} onChange={e => setAspect(e.target.value)}>
                      <option>16:9</option><option>9:16</option><option>1:1</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Field label="MODEL ẢNH"><input className="insp-input" value={imodel} onChange={e => setImodel(e.target.value)} /></Field>
                  <Field label="MODEL VIDEO"><input className="insp-input" value={vmodel} onChange={e => setVmodel(e.target.value)} /></Field>
                </div>
                <Field label="Ý TƯỞNG / BRIEF (bắt buộc)">
                  <textarea className="insp-input" rows={5} value={idea} onChange={e => setIdea(e.target.value)}
                    placeholder="Sản phẩm gì, tính năng gì, thông điệp, đối tượng, yêu cầu của khách..." />
                </Field>
                <Field label="PHONG CÁCH (bỏ trống = Luxury–Elegant–Mysterious mặc định)">
                  <textarea className="insp-input" rows={2} value={style} onChange={e => setStyle(e.target.value)}
                    placeholder="VD: ấm áp gia đình, ánh hoàng hôn..." />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <Field label="ẢNH SẢN PHẨM">
                    <select className="insp-input" value={img} onChange={e => setImg(e.target.value)}>
                      <option value="yes">CÓ ảnh sản phẩm (sẽ đính kèm vào Claude)</option>
                      <option value="no">KHÔNG có ảnh sản phẩm</option>
                    </select>
                  </Field>
                  <Field label="VIDEO MẪU">
                    <select className="insp-input" value={vid} onChange={e => setVid(e.target.value)}>
                      <option value="no">KHÔNG có video mẫu</option>
                      <option value="yes">CÓ video mẫu (sẽ đính kèm vào Claude)</option>
                    </select>
                  </Field>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleBuildMega}>TẠO MEGA PROMPT</button>
                  <button className="btn" onClick={handleCopyMega} disabled={!megaOut}>COPY</button>
                </div>

                {megaMsg && (
                  <div style={{ marginTop: 8, fontSize: 11, color: megaMsg.ok ? 'var(--signal)' : 'var(--danger)' }}>
                    {megaMsg.text}
                  </div>
                )}

                {megaOut && (
                  <pre style={{
                    marginTop: 10, padding: 12, background: 'rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-subtle)', borderRadius: 6,
                    fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap',
                    maxHeight: 280, overflow: 'auto', color: '#c9c9c9',
                  }}>
                    {megaOut}
                  </pre>
                )}

                <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Dán Mega Prompt vào Claude Desktop (đính kèm ảnh sản phẩm + video mẫu nếu có). Claude trả về MANIFEST JSON → chuyển sang tab ②.
                </p>
              </Card>
            </div>
          )}

          {/* ===== TAB 2: COMPILE ===== */}
          {activeTab === 'compile' && (
            <div>
              <Card title="DÁN MANIFEST JSON TỪ CLAUDE">
                <textarea className="insp-input" rows={12} value={manifest} onChange={e => setManifest(e.target.value)}
                  placeholder={'{"project":"...", "models":{...}, "uploads":[...], "ref_assets":[...], "env_plates":[...], "shots":[...], "stitch":true}'}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />

                <div style={{ marginTop: 8 }}>
                  <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileLoad} />
                  <button className="btn" onClick={() => fileInputRef.current.click()} style={{ fontSize: 10 }}>📁 NẠP FILE</button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleCompile}>VALIDATE + COMPILE</button>
                  <button className="btn" onClick={handleSanitize}>CHUẨN HÓA</button>
                  <button className="btn" onClick={handleLoadSkeleton}>NẠP KHUNG MẪU</button>
                  <button className="btn" onClick={handleDownloadManifest} style={{ fontSize: 10 }}>⬇ MANIFEST</button>
                </div>

                {compileMsg && (
                  <div style={{ marginTop: 10, fontSize: 11, whiteSpace: 'pre-wrap',
                    color: compileMsg.ok ? 'var(--signal)' : 'var(--danger)' }}>
                    {compileMsg.text}
                  </div>
                )}

                {compileWarnings.length > 0 && (
                  <div style={{
                    marginTop: 10, padding: 10, fontSize: 11, whiteSpace: 'pre-wrap',
                    background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.25)',
                    borderRadius: 6, color: 'var(--text-secondary)', lineHeight: 1.6,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#e6b84d' }}>⚠ Tự sửa khi chuẩn hóa</div>
                    {compileWarnings.map((w, i) => <div key={i}>· {w}</div>)}
                  </div>
                )}

                {stats && (
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
                    {[
                      ['NODES', stats.nodes],
                      ['EDGES', stats.edges],
                      ['SHOTS', stats.shots],
                      ['DURATIONS', stats.durations],
                      ['SIZE (KB)', stats.size],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--rose-gold)', lineHeight: 1.2 }}>{v}</div>
                        {k}
                      </div>
                    ))}
                  </div>
                )}

                {flow && (
                  <>
                    <div style={{
                      marginTop: 16, padding: 12, borderRadius: 8,
                      background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.28)',
                      fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.65,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--rose-gold)', marginBottom: 6, letterSpacing: '0.06em' }}>
                        BƯỚC TIẾP THEO — ĐƯA VÀO FLOW AI
                      </div>
                      <div>1. Bấm <strong>⬇ DOWNLOAD .JSON</strong> — lưu file <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>flow_project_*.json</code> xuống máy.</div>
                      <div>2. Mở <strong>Flow AI</strong> → menu Import / Load workflow → chọn file vừa tải.</div>
                      <div>3. Chạy pipeline trên Flow AI theo cột trái → phải (upload → ref → storyboard → video → stitch).</div>
                      <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>
                        <strong>IMPORT TO CANVAS</strong> chỉ mở preview trên OBSIDIAN — không thay cho bước Import trên Flow AI.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={handleDownload}>
                        ⬇ DOWNLOAD .JSON → FLOW AI
                      </button>
                      <button className="btn" onClick={handleImportToCanvas}>
                        ⬆ IMPORT TO CANVAS (OBSIDIAN)
                      </button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* ===== TAB 3: GUIDE ===== */}
          {activeTab === 'guide' && (
            <div>
              <Card title="QUY TRÌNH 6 BƯỚC">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                  {[
                    ['1 · BRIEF', 'Điền tab ① → bấm TẠO MEGA PROMPT → COPY.'],
                    ['2 · CLAUDE DESKTOP', 'Dán vào Claude, đính kèm ảnh sản phẩm + video mẫu. Claude trả về 1 khối MANIFEST JSON.'],
                    ['3 · COMPILE', 'Tab ②: CHUẨN HÓA → VALIDATE + COMPILE → ⬇ DOWNLOAD flow_project_*.json.'],
                    ['4 · FLOW AI', 'Mở Flow AI → Import workflow → chọn file .json vừa tải. Manifest không import trực tiếp được.'],
                    ['5 · CANVAS / CHẠY', 'Trên Flow AI: upload ảnh → ref sheets → storyboards → videos → stitcher. OBSIDIAN canvas chỉ để preview tùy chọn.'],
                    ['6 · VALIDATE', 'Mỗi tầng kiểm: mặt/tay/tỷ lệ (ảnh) · flicker/morph/drift (video). Fail → sửa prompt trong node.'],
                  ].map(([title, desc]) => (
                    <div key={title} style={{
                      background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)',
                      borderRadius: 8, padding: 12,
                    }}>
                      <div style={{ color: 'var(--rose-gold)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Luật cứng:</strong> 1 shot = 1 hành động + 1 camera move · panel storyboard: 4s=2×2, 6s=2×3, 8s=2×4, 10s=2×5 · không feed nguyên grid vào video · không người thật/logo/IP trong prompt.
                </p>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, padding: '12px 24px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em',
        }}>
          PROMPT FACTORY STUDIO v1.0 — PROMPT LÀ SẢN PHẨM, VIDEO LÀ HỆ QUẢ
        </div>
      </div>
    </div>
  );
}

/* ---- helpers ---- */
function Card({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      borderRadius: 10, padding: 18, marginBottom: 14,
    }}>
      {title && <div style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--rose-gold)', marginBottom: 14, fontWeight: 700 }}>{title}</div>}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
