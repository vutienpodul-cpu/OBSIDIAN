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

  const steps = Array.isArray(data.steps) ? data.steps : [];
  const gotoStep = steps.find(s => s.type === 'goto');
  if (gotoStep) {
    const gotoUrl = gotoStep.url || gotoStep.value;
    if (isValidHttpUrl(gotoUrl)) return gotoUrl.trim();
  }

  return null;
}

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
