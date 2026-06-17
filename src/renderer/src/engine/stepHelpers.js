/** Helpers for click-sequence step selectors (renderer). */

export function stepSelectorList(step) {
  const primary = step?.selector?.trim() ? [step.selector.trim()] : [];
  const extra = Array.isArray(step?.selectors)
    ? step.selectors.map(s => String(s).trim()).filter(Boolean)
    : [];
  return [...new Set([...primary, ...extra])];
}

export function fallbacksToText(selectors) {
  if (!Array.isArray(selectors) || !selectors.length) return '';
  return selectors.join('\n');
}

export function textToFallbacks(text) {
  return String(text || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

export function stepNeedsSelector(step) {
  return ['click', 'right_click', 'type'].includes(step?.type);
}
