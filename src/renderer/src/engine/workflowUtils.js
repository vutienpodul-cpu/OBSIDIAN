/**
 * Shared workflow helpers for URL resolution, prompt injection, and click sequences.
 */

function isValidHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

export function getUpstreamNodes(nodeId, nodes, edges) {
  const sourceIds = edges.filter(e => e.target === nodeId).map(e => e.source);
  return sourceIds.map(id => nodes.find(n => n.id === id)).filter(Boolean);
}

export const WEB_TASK_KINDS = ['click_seq', 'imageGen', 'videoGen'];
export const PROMPT_SLOT_COUNT = 3;

export const WEB_TASK_HANDLE_DEFS = {
  click_seq: ['prompt-1', 'prompt-2', 'prompt-3', 'url'],
  imageGen:  ['prompt-1', 'prompt-2', 'prompt-3', 'image', 'url'],
  videoGen:  ['prompt-1', 'prompt-2', 'prompt-3', 'image', 'url'],
};

export const WEB_TASK_HANDLE_LABELS = {
  'prompt-1': 'Prompt 1',
  'prompt-2': 'Prompt 2',
  'prompt-3': 'Prompt 3',
  image: 'Image',
  url: 'URL',
};

const PROMPT_SOURCE_KINDS = ['prompt', 'brief', 'compiler', 'merge', 'analyzer'];
const IMAGE_SOURCE_KINDS = ['imageGen', 'imageUpload', 'reference', 'storyboard'];

export function webTaskNeedsSetup(node) {
  const d = node?.data;
  if (!d) return false;
  if (d.kind === 'bridge') return !(d.actions || []).length;
  if (!WEB_TASK_KINDS.includes(d.kind)) return false;
  if ((d.actions || []).length && (d.bridge_url || d.url)) return false;
  return !(d.steps || []).length;
}

export function resolveUrlForClickSeq(node, nodes, edges, upstreamOutputs = []) {
  for (const u of upstreamOutputs) {
    if (u?.type === 'url' && isValidHttpUrl(u.url)) return u.url.trim();
  }

  for (const src of getUpstreamNodes(node.id, nodes, edges)) {
    if (src.data.kind === 'url_source' && isValidHttpUrl(src.data.url)) {
      return src.data.url.trim();
    }
  }

  const { data } = node;
  if (isValidHttpUrl(data.url)) return data.url.trim();
  if (isValidHttpUrl(data.bridge_url)) return data.bridge_url.trim();

  const steps = Array.isArray(data.steps) ? data.steps : [];
  const gotoStep = steps.find(s => s.type === 'goto');
  if (gotoStep) {
    const gotoUrl = gotoStep.url || gotoStep.value;
    if (isValidHttpUrl(gotoUrl)) return gotoUrl.trim();
  }

  return null;
}

/** Alias for web task nodes (imageGen, videoGen, click_seq). */
export const resolveWebTaskUrl = resolveUrlForClickSeq;

export function findPromptText(upstream) {
  for (const u of upstream) {
    if (!u) continue;
    if (u.prompts) {
      const first = Object.values(u.prompts)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (u.text) return u.text;
  }
  return null;
}

export function buildInjectMap(steps, promptText) {
  const injectMap = {};
  if (!promptText) return injectMap;
  steps.forEach((s, i) => {
    if (s.type === 'type' && !s.value) injectMap[i] = promptText;
  });
  return injectMap;
}

export function getPromptTextFromNode(node, output) {
  if (!node) return null;
  const out = output ?? node.data?._output;
  if (out?.text) return out.text;
  if (out?.prompts) {
    const first = Object.values(out.prompts)[0];
    if (Array.isArray(first) && first[0]) return first[0];
  }
  const d = node.data || {};
  if (d.kind === 'prompt' || d.kind === 'brief') return d.text || null;
  return null;
}

export function typeStepIndices(steps) {
  return (steps || [])
    .map((s, i) => (s.type === 'type' ? i : null))
    .filter(i => i !== null);
}

export function findFirstFreePromptHandle(targetId, edges, maxSlots = PROMPT_SLOT_COUNT) {
  const used = new Set(
    edges
      .filter(e => e.target === targetId && e.targetHandle?.startsWith('prompt-'))
      .map(e => e.targetHandle)
  );
  for (let i = 1; i <= maxSlots; i++) {
    const h = `prompt-${i}`;
    if (!used.has(h)) return h;
  }
  return `prompt-${maxSlots}`;
}

export function inferWebTaskTargetHandle(sourceKind, targetId, edges) {
  if (sourceKind === 'url_source') return 'url';
  if (IMAGE_SOURCE_KINDS.includes(sourceKind)) return 'image';
  if (PROMPT_SOURCE_KINDS.includes(sourceKind)) {
    return findFirstFreePromptHandle(targetId, edges);
  }
  return null;
}

export function isValidWebTaskConnection(sourceKind, targetHandle) {
  if (!targetHandle) return false;
  if (targetHandle === 'url') return sourceKind === 'url_source';
  if (targetHandle === 'image') return IMAGE_SOURCE_KINDS.includes(sourceKind);
  if (targetHandle.startsWith('prompt-')) return PROMPT_SOURCE_KINDS.includes(sourceKind);
  return false;
}

export function syncPromptSlotsFromEdges(nodeId, nodes, edges, steps = [], existingSlots = []) {
  const typeIdx = typeStepIndices(steps);
  const promptEdges = edges
    .filter(e => e.target === nodeId && e.targetHandle?.startsWith('prompt-'))
    .sort((a, b) => {
      const na = parseInt(a.targetHandle.split('-')[1], 10) || 0;
      const nb = parseInt(b.targetHandle.split('-')[1], 10) || 0;
      return na - nb;
    });

  return promptEdges.map((edge, idx) => {
    const handle = edge.targetHandle;
    const prev = existingSlots.find(s => s.handle === handle)
      || existingSlots.find(s => s.sourceId === edge.source);
    const slotNum = handle.split('-')[1] || String(idx + 1);
    return {
      handle,
      sourceId: edge.source,
      stepIndex: prev?.stepIndex ?? typeIdx[idx] ?? typeIdx[0] ?? 0,
      label: prev?.label || `Prompt ${slotNum}`,
    };
  });
}

export function buildInjectMapFromBindings(steps, nodes, edges, targetNodeId, promptSlots, outputsById = {}) {
  const node = nodes.find(n => n.id === targetNodeId);
  const slots = (promptSlots?.length
    ? promptSlots
    : syncPromptSlotsFromEdges(targetNodeId, nodes, edges, steps, node?.data?.promptSlots || [])
  );

  const injectMap = {};
  for (const slot of slots) {
    const src = nodes.find(n => n.id === slot.sourceId);
    const text = getPromptTextFromNode(src, outputsById[slot.sourceId]);
    if (!text) continue;
    const idx = slot.stepIndex;
    if (steps[idx]?.type === 'type') injectMap[idx] = text;
  }

  if (Object.keys(injectMap).length === 0) {
    const legacyText = findPromptTextFromGraph(targetNodeId, nodes, edges);
    return buildInjectMap(steps, legacyText);
  }
  return injectMap;
}

export function migrateWebTaskEdges(nodes, edges) {
  const usedByTarget = {};
  return edges.map(e => {
    if (e.targetHandle) return e;
    const target = nodes.find(n => n.id === e.target);
    const source = nodes.find(n => n.id === e.source);
    if (!target || !source || !WEB_TASK_KINDS.includes(target.data.kind)) return e;

    const key = e.target;
    if (!usedByTarget[key]) usedByTarget[key] = new Set();
    const sk = source.data.kind;
    let handle = inferWebTaskTargetHandle(sk, e.target, edges.filter(x => x.id !== e.id));
    if (handle?.startsWith('prompt-') && usedByTarget[key].has(handle)) {
      handle = findFirstFreePromptHandle(e.target, edges.filter(x => x.id !== e.id));
    }
    if (handle) usedByTarget[key].add(handle);
    return handle ? { ...e, targetHandle: handle } : e;
  });
}

export function prepareStepsForRun(steps, url) {
  const list = Array.isArray(steps) ? [...steps] : [];
  if (!url || !isValidHttpUrl(url)) return list;
  if (list.length > 0 && list[0].type === 'goto') return list;
  return [{ type: 'goto', url, value: url, delay: 500, label: 'Navigate' }, ...list];
}

export function findPromptTextFromGraph(nodeId, nodes, edges) {
  const upstreamNodes = getUpstreamNodes(nodeId, nodes, edges);
  const pseudoUpstream = upstreamNodes.map(n => {
    if (n.data.kind === 'brief' || n.data.kind === 'prompt') {
      return { text: n.data.text };
    }
    if (n.data._output) return n.data._output;
    return null;
  }).filter(Boolean);
  return findPromptText(pseudoUpstream);
}

export function shortHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}
