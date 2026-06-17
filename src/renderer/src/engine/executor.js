/**
 * OBSIDIAN — WORKFLOW EXECUTOR
 * ============================
 * Reads the current graph from the store, does a topological sort,
 * executes each node in order, propagates outputs along edges, and
 * dispatches Bridge nodes to the Playwright controller in main process.
 *
 * Each node returns an `output` (any JSON-serializable value). Downstream
 * nodes see upstream outputs in `inputs` keyed by source node id.
 */
import { useStore } from '../store.js';
import {
  resolveUrlForClickSeq,
  findPromptText,
  buildInjectMapFromBindings,
  prepareStepsForRun,
  shortHost,
} from './workflowUtils.js';

let aborted = false;

export function stopWorkflow() {
  aborted = true;
  const store = useStore.getState();
  if (!store.running) return;
  store.pushLog({ level: 'warn', msg: '⏹ Stop requested — đang dừng…' });
  window.obsidian?.bridge?.abortAll?.().catch(() => {});
}

export async function runWorkflow() {
  const store = useStore.getState();
  const { nodes, edges } = store;

  if (nodes.length === 0) return;

  aborted = false;
  store.resetRun();
  store.setRunning(true);
  useStore.setState({ _startTime: Date.now() });

  store.pushLog({ level: 'info', msg: `Run #${store.runId + 1} started · ${nodes.length} nodes` });

  // Topological sort
  const order = topoSort(nodes, edges);
  if (!order) {
    store.pushLog({ level: 'error', msg: 'Cycle detected in graph — abort' });
    store.setRunning(false);
    return;
  }

  // Clear all status
  nodes.forEach(n => store.setNodeStatus(n.id, null));

  // Outputs keyed by node id
  const outputs = {};
  const incomingEdges = (nodeId) => edges.filter(e => e.target === nodeId);

  const total = order.length;
  for (let i = 0; i < total; i++) {
    if (aborted) {
      store.pushLog({ level: 'warn', msg: 'Aborted by user' });
      break;
    }
    const nodeId = order[i];
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Mark executing + animate incoming edges
    store.setNodeStatus(nodeId, 'executing');
    incomingEdges(nodeId).forEach(e => store.setEdgeAnimated(e.source, nodeId, true));

    store.setProgress(i / total, i + 1, total);
    store.pushLog({ nodeId, level: 'info', msg: `▸ ${node.data.label} executing` });

    // Build inputs map from upstream nodes
    const inputs = {};
    for (const e of incomingEdges(nodeId)) {
      inputs[e.source] = outputs[e.source];
    }

    const nodesSnapshot = useStore.getState().nodes;

    try {
      const output = await executeNode(node, inputs, store, nodesSnapshot, edges, outputs);
      if (aborted) {
        store.setNodeStatus(nodeId, null);
        store.pushLog({ nodeId, level: 'warn', msg: `⏹ ${node.data.label} stopped` });
        break;
      }
      outputs[nodeId] = output;
      useStore.getState().updateNodeData(nodeId, { _output: output });
      store.setNodeStatus(nodeId, 'done');
      store.pushLog({ nodeId, level: 'info', msg: `✓ ${node.data.label} done` });
    } catch (err) {
      if (aborted || err.message === 'Aborted by user') {
        store.setNodeStatus(nodeId, null);
        store.pushLog({ nodeId, level: 'warn', msg: `⏹ ${node.data.label} stopped` });
        break;
      }
      store.setNodeStatus(nodeId, 'errored');
      store.pushLog({ nodeId, level: 'error', msg: `✗ ${node.data.label}: ${err.message}` });
      // Stop the whole pipeline on error unless node opts to continue
      break;
    } finally {
      incomingEdges(nodeId).forEach(e => store.setEdgeAnimated(e.source, nodeId, false));
    }
  }

  if (!aborted) store.setProgress(1, total, total);
  store.setRunning(false);
  store.pushLog({
    level: aborted ? 'warn' : 'info',
    msg: aborted ? 'Workflow stopped by user' : 'Workflow finished',
  });
}

/* ============================================
   Topological sort (Kahn's algorithm)
   ============================================ */
function topoSort(nodes, edges) {
  const inDeg = {};
  const adj   = {};
  nodes.forEach(n => { inDeg[n.id] = 0; adj[n.id] = []; });
  edges.forEach(e => {
    if (inDeg[e.target] === undefined) return;
    inDeg[e.target]++;
    adj[e.source].push(e.target);
  });

  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const out = [];
  while (queue.length) {
    const id = queue.shift();
    out.push(id);
    adj[id].forEach(t => {
      inDeg[t]--;
      if (inDeg[t] === 0) queue.push(t);
    });
  }
  return out.length === nodes.length ? out : null;
}

/* ============================================
   NODE EXECUTORS — one per kind
   ============================================ */
async function executeNode(node, inputs, store, nodes, edges, outputsById = {}) {
  const { kind, data } = { kind: node.data.kind, data: node.data };
  const upstream = Object.values(inputs);

  switch (kind) {
    // ---------- INPUT ----------
    case 'url_source':
      return { type: 'url', url: data.url, note: data.note };
    case 'brief':
      return { type: 'brief', text: data.text, tags: data.tags };
    case 'reference':
      return { type: 'reference', files: data.files, note: data.note };
    case 'moodboard':
      return { type: 'moodboard', palette: data.palette, mood: data.mood };

    // ---------- DIRECTION ----------
    case 'prompt':
      return { type: 'prompt', text: data.text, lang: data.lang };
    case 'style':
      return { type: 'style', preset: data.preset, strength: data.strength };
    case 'camera':
      return { type: 'camera', shots: data.shots, motion: data.motion };

    // ---------- INTELLIGENCE ----------
    case 'merge':
      return mergeContexts(upstream, data.strategy);
    case 'analyzer':
      return analyzeContext(upstream, data.extract);
    case 'compiler':
      return compilePrompts(upstream, data.targets, data.variants);

    // ---------- AI BRIDGE ----------
    case 'bridge':
      return await runBridge(node, upstream, store);
    case 'click_seq':
      return await runClickSeq(node, upstream, store, nodes, edges, outputsById);

    // ---------- GENERATION ----------
    case 'image_forge':
    case 'video_forge':
      return { type: kind, engine: data.engine, variants: data.count || 1, items: upstream.flatMap(u => u?.items || []) };
    case 'storyboard':
      return buildStoryboard(upstream, data.aspect);
    case 'vfx':
      return { type: 'vfx', layers: upstream.length, particles: data.particles };

    // ---------- PROMPT FACTORY GENERATION NODES ----------
    case 'imageGen': {
      if (data.actions?.length && (data.bridge_url || data.url)) {
        return await runBridge(legacyBridgeNode(node, data), upstream, store);
      }
      const refImages = upstream.flatMap(u => u?.items || []).filter(Boolean);
      return await runWebTask(node, upstream, store, nodes, edges, {
        outputType: 'imageGen',
        logLabel: `imageGen (${data.model || 'AI'})`,
        extra: { model: data.model, aspectRatio: data.aspectRatio, refImages },
        outputsById,
      });
    }

    case 'videoGen': {
      if (data.actions?.length && (data.bridge_url || data.url)) {
        return await runBridge(legacyBridgeNode(node, data), upstream, store);
      }
      const inputImages = upstream.flatMap(u => u?.items || []).filter(Boolean);
      return await runWebTask(node, upstream, store, nodes, edges, {
        outputType: 'videoGen',
        logLabel: `videoGen (${data.model || 'AI'} · ${data.duration || 6}s)`,
        extra: {
          model: data.model,
          duration: data.duration,
          aspectRatio: data.aspectRatio,
          inputImages,
        },
        outputsById,
      });
    }

    case 'imageUpload': {
      const files = data.files || data._output?.items || [];
      if (!files.length) {
        store.pushLog({ nodeId: node.id, level: 'warn', msg: '[imageUpload] No files loaded — add images in Inspector' });
      }
      return { type: 'imageUpload', items: files };
    }

    case 'stitcher': {
      const clips = upstream.flatMap(u => u?.items || []).filter(Boolean);
      store.pushLog({ nodeId: node.id, level: 'info', msg: `[stitcher] ${clips.length} clip(s) collected` });
      return { type: 'stitcher', items: clips, count: clips.length };
    }

    // ---------- ORCHESTRATION ----------
    case 'approval': {
      // Pause workflow until user clicks resume.
      // For MVP we just show a confirm dialog.
      const ok = window.confirm(`APPROVAL GATE\n\nReview upstream output and approve?`);
      if (!ok) throw new Error('Rejected by reviewer');
      return { type: 'approved', forwardedFrom: upstream };
    }
    case 'loop': {
      return { type: 'loop', iterations: data.count, expanded: upstream };
    }
    case 'condition': {
      // eslint-disable-next-line no-new-func
      const fn = new Function('output','upstream', `try{return Boolean(${data.expr})}catch(e){return false}`);
      const pass = fn(upstream[0], upstream);
      if (!pass) throw new Error(`Condition false: ${data.expr}`);
      return { type: 'condition', pass: true, forwardedFrom: upstream };
    }
    case 'export':
      return await runExport(data, upstream, store);
    case 'delivery':
      return { type: 'delivered', target: data.target, items: upstream.flatMap(u => u?.items || []) };

    default:
      throw new Error(`Unknown node kind: ${kind}`);
  }
}

/* ---- Intelligence helpers (local — no API) ---- */
function mergeContexts(upstream, strategy = 'structured') {
  if (strategy === 'concat') {
    return { type: 'context', text: upstream.map(u => JSON.stringify(u)).join('\n\n') };
  }
  // structured: group by type
  const grouped = {};
  upstream.forEach(u => {
    if (!u) return;
    const t = u.type || 'unknown';
    grouped[t] = grouped[t] || [];
    grouped[t].push(u);
  });
  return { type: 'context', strategy, grouped };
}

function analyzeContext(upstream, fields = ['intent','tone','keywords']) {
  const ctx = upstream[0] || {};
  const text = JSON.stringify(ctx);
  const result = {};
  if (fields.includes('intent'))   result.intent = guessIntent(text);
  if (fields.includes('tone'))     result.tone = 'aspirational · cinematic';
  if (fields.includes('keywords')) result.keywords = extractKeywords(text).slice(0, 8);
  if (fields.includes('color_palette')) result.color_palette = ['#1A1208','#D4A574','#0A0A0F'];
  return { type: 'analysis', ...result };
}

function guessIntent(text) {
  const t = text.toLowerCase();
  if (t.includes('hero') || t.includes('campaign') || t.includes('launch')) return 'hero campaign';
  if (t.includes('product')) return 'product showcase';
  if (t.includes('tutorial') || t.includes('how to')) return 'instructional';
  return 'editorial';
}

function extractKeywords(text) {
  const stop = new Set(['the','and','for','with','from','this','that','have','will']);
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !stop.has(w));
  const freq = {};
  words.forEach(w => freq[w] = (freq[w]||0)+1);
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).map(([w]) => w);
}

function compilePrompts(upstream, targets = ['midjourney'], variants = 4) {
  const ctx = mergeContextsToText(upstream);
  const prompts = {};
  targets.forEach(t => {
    prompts[t] = compileForTarget(t, ctx, variants);
  });
  return { type: 'prompts', targets, variants, prompts };
}

function mergeContextsToText(upstream) {
  const parts = [];
  upstream.forEach(u => {
    if (!u) return;
    if (u.text) parts.push(u.text);
    if (u.preset) parts.push(`style: ${u.preset}`);
    if (u.motion) parts.push(`camera: ${u.motion}, ${u.shots||8} shots`);
    if (u.palette) parts.push(`palette: ${u.palette}`);
    if (u.intent) parts.push(`intent: ${u.intent}`);
    if (u.tone) parts.push(`tone: ${u.tone}`);
    if (u.keywords) parts.push(`keywords: ${u.keywords.join(', ')}`);
    if (u.grouped) {
      Object.values(u.grouped).flat().forEach(x => {
        if (x.text) parts.push(x.text);
        if (x.preset) parts.push(`style: ${x.preset}`);
      });
    }
  });
  return parts.join(' · ');
}

function compileForTarget(target, ctx, variants) {
  const base = ctx.slice(0, 400);
  switch (target) {
    case 'midjourney':
      return Array.from({ length: variants }, (_, i) =>
        `${base}, cinematic, ultra-detailed, --ar 16:9 --style raw --v 6 --seed ${1000+i}`);
    case 'sora':
      return Array.from({ length: Math.min(variants, 4) }, (_, i) =>
        `${base}. Smooth camera motion, photoreal, 5 second clip. Variation ${i+1}.`);
    case 'runway':
      return Array.from({ length: Math.min(variants, 4) }, (_, i) =>
        `Motion brief: ${base}. Style ref: cinematic. Variation ${i+1}.`);
    default:
      return [base];
  }
}

function buildStoryboard(upstream, aspect = '16:9') {
  const items = upstream.flatMap(u => u?.items || []);
  return { type: 'storyboard', aspect, panels: items.map((src, i) => ({ index: i+1, src })) };
}

/* ---- BRIDGE EXECUTION ---- */
async function runBridge(node, upstream, store) {
  const { data, id } = node;
  const bridge = window.obsidian.bridge;

  if (!data.actions || data.actions.length === 0) {
    throw new Error('Bridge has no recorded actions — open the node and record first');
  }

  store.pushLog({ nodeId: id, level: 'info', msg: `Opening bridge → ${shortHost(data.url)}` });
  await bridge.open(id, data.url);

  // Build params: if injectInto is set, take text from upstream
  const params = {};
  if (data.injectInto) {
    const promptText = findPromptText(upstream);
    if (promptText) params[data.injectInto] = promptText;
  }

  store.pushLog({ nodeId: id, level: 'info', msg: `Replaying ${data.actions.length} actions` });
  const replayRes = await bridge.replay(id, data.actions, params);
  if (!replayRes.ok) {
    if (replayRes.aborted || replayRes.error === 'Aborted by user') throw new Error('Aborted by user');
    throw new Error(replayRes.error || 'Replay failed');
  }

  // Wait for stable output
  if (data.waitFor) {
    store.pushLog({ nodeId: id, level: 'info', msg: `Waiting for ${data.waitFor}` });
    await bridge.waitStable(id, data.waitFor, (data.timeout || 180) * 1000);
  }

  // Grab outputs
  let items = [];
  if (data.grabFrom) {
    const grab = await bridge.grabOutput(id, data.grabFrom, data.grabAttr || 'src');
    if (grab.ok) items = grab.result.filter(Boolean);
  }

  store.pushLog({ nodeId: id, level: 'info', msg: `Grabbed ${items.length} outputs` });
  return { type: 'bridge_output', source: data.url, items };
}

async function runClickSeq(node, upstream, store, nodes, edges, outputsById = {}) {
  return runWebTask(node, upstream, store, nodes, edges, {
    outputType: 'click_seq_output',
    logLabel: 'click_seq',
    outputsById,
  });
}

function legacyBridgeNode(node, data) {
  return {
    ...node,
    data: {
      ...data,
      url: data.bridge_url || data.url,
      injectInto: data.bridge_inject || '',
      grabFrom: data.bridge_grab || data.grabFrom || '',
      grabAttr: data.bridge_grab_attr || data.grabAttr || 'src',
      waitFor: data.bridge_wait || data.waitFor || '',
      timeout: data.bridge_timeout || data.timeout || 180,
    },
  };
}

async function runWebTask(node, upstream, store, nodes, edges, opts = {}) {
  const { data, id } = node;
  const bridge = window.obsidian.bridge;
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const outputType = opts.outputType || 'click_seq_output';
  const logLabel = opts.logLabel || data.label || data.kind;

  if (steps.length === 0) {
    throw new Error('Chưa có steps — mở Inspector tab clicks và Pick Click');
  }

  const url = resolveUrlForClickSeq(node, nodes, edges, upstream);
  const sessionId = data.sessionId || id;
  const grabFrom = data.grabFrom || data.bridge_grab;
  const grabAttr = data.grabAttr || data.bridge_grab_attr || 'src';
  const waitFor = data.waitFor || data.bridge_wait;
  const timeout = data.timeout || data.bridge_timeout || 180;

  store.pushLog({
    nodeId: id,
    level: 'info',
    msg: `[${logLabel}] Running ${steps.length} steps → ${url ? shortHost(url) : 'no URL'}`,
  });

  await bridge.open(id, url || 'about:blank', sessionId);
  useStore.getState().setBridgeSessionOpen(sessionId, true);

  const stepsToRun = prepareStepsForRun(steps, url);
  const injectMap = buildInjectMapFromBindings(
    stepsToRun,
    nodes,
    edges,
    id,
    data.promptSlots || [],
    opts.outputsById || {}
  );

  const runRes = await bridge.runSteps(id, stepsToRun, injectMap, sessionId);
  if (!runRes.ok) {
    if (runRes.aborted || runRes.error === 'Aborted by user') throw new Error('Aborted by user');
    throw new Error(runRes.error || 'Web task failed');
  }

  if (waitFor) {
    store.pushLog({ nodeId: id, level: 'info', msg: `Waiting for ${waitFor}` });
    await bridge.waitStable(id, waitFor, timeout * 1000, sessionId);
  }

  let items = [];
  if (grabFrom) {
    const grab = await bridge.grabOutput(id, grabFrom, grabAttr, sessionId);
    if (grab.ok) items = grab.result.filter(Boolean);
  }

  store.pushLog({
    nodeId: id,
    level: 'info',
    msg: `Grabbed ${items.length} outputs · browser left open`,
  });

  return {
    type: outputType,
    source: url,
    items,
    ...(opts.extra || {}),
  };
}

/* ---- EXPORT ---- */
function collectExportItems(upstream) {
  return upstream.flatMap(u => {
    if (!u) return [];
    if (Array.isArray(u.items) && u.items.length) return u.items;
    if (Array.isArray(u.panels)) return u.panels.map(p => p.src).filter(Boolean);
    return [];
  }).filter(item => item != null && String(item).trim() !== '');
}

async function runExport(data, upstream, store) {
  const items = collectExportItems(upstream);

  let folderPath = (data.path || '').trim();
  if (!folderPath) {
    if (typeof window.obsidian?.pickFolder !== 'function') {
      throw new Error('pickFolder chưa sẵn sàng — restart app (npm run dev)');
    }
    const picked = await window.obsidian.pickFolder();
    if (!picked?.ok || !picked.path) {
      throw new Error('Export hủy — chưa chọn thư mục output');
    }
    folderPath = picked.path;
  }

  store.pushLog({
    level: 'info',
    msg: `Exporting ${items.length} item(s) → ${folderPath}`,
  });

  if (typeof window.obsidian?.exportFiles !== 'function') {
    throw new Error('exportFiles chưa sẵn sàng — restart app (npm run dev)');
  }

  const res = await window.obsidian.exportFiles({
    folderPath,
    items,
    format: data.format,
  });

  if (!res.ok) throw new Error(res.error || 'Export thất bại');

  if (res.errors?.length) {
    store.pushLog({
      level: 'warn',
      msg: `${res.errors.length} file(s) lỗi khi export`,
    });
  }

  store.pushLog({
    level: 'info',
    msg: `Đã lưu ${res.count} file vào ${folderPath}`,
  });

  return {
    type: 'export',
    format: data.format,
    count: res.count,
    folderPath,
    saved: res.saved,
    items,
    errors: res.errors,
  };
}
