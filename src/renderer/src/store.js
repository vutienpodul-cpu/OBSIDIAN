/**
 * Workflow state — Zustand store.
 * Holds nodes, edges, execution state, log, selected node.
 */
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import { defaultDataFor } from './data/nodeDefs.js';

let nextId = 1;
export function nextNodeId() { return `n${Date.now()}_${nextId++}`; }

export const useStore = create((set, get) => ({
  // Project metadata
  projectName: 'Untitled Workflow',
  workflowFilePath: null,
  setProjectName: (name) => set({ projectName: name }),
  setWorkflowFilePath: (path) => set({ workflowFilePath: path }),

  // Graph state
  nodes: [],
  edges: [],
  selectedId: null,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) => set({
    edges: addEdge({ ...conn, type: 'default', animated: false }, get().edges)
  }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (kind, position) => {
    const id = nextNodeId();
    const data = defaultDataFor(kind);
    const newNode = {
      id,
      type: 'obsidian',
      position: position || { x: 200, y: 200 },
      data,
    };
    const { selectedId, nodes, bridgeSessionOpen } = get();
    let keepSelected = false;
    if (selectedId) {
      const cur = nodes.find(n => n.id === selectedId);
      if (cur?.data?.kind === 'click_seq') {
        const sid = cur.data.sessionId || cur.id;
        if (bridgeSessionOpen[sid]) keepSelected = true;
      }
    }
    set({
      nodes: [...get().nodes, newNode],
      selectedId: keepSelected ? selectedId : id,
    });
    return id;
  },

  updateNodeData: (id, patch) => set({
    nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)
  }),

  setNodeStatus: (id, status) => set({
    nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, _status: status } } : n)
  }),

  setEdgeAnimated: (sourceId, targetId, animated) => set({
    edges: get().edges.map(e =>
      e.source === sourceId && e.target === targetId ? { ...e, animated } : e
    )
  }),

  selectNode: (id) => set({ selectedId: id }),

  // Inspector tab per node + bridge session UI sync
  inspectorTabByNodeId: {},
  setInspectorTab: (nodeId, tab) => set({
    inspectorTabByNodeId: { ...get().inspectorTabByNodeId, [nodeId]: tab },
  }),

  bridgeSessionOpen: {},
  setBridgeSessionOpen: (sessionId, open) => set({
    bridgeSessionOpen: { ...get().bridgeSessionOpen, [sessionId]: open },
  }),

  removeNode: (id) => set({
    nodes: get().nodes.filter(n => n.id !== id),
    edges: get().edges.filter(e => e.source !== id && e.target !== id),
    selectedId: get().selectedId === id ? null : get().selectedId,
  }),

  clearAll: () => set({ nodes: [], edges: [], selectedId: null, workflowFilePath: null }),

  // ---------------- Execution ----------------
  running: false,
  runId: 0,
  progress: 0,
  currentStep: 0,
  totalSteps: 0,
  log: [],
  setRunning: (running) => set({ running }),
  resetRun: () => set({
    runId: get().runId + 1, progress: 0, currentStep: 0, totalSteps: 0, log: []
  }),
  setProgress: (p, current, total) => set({ progress: p, currentStep: current, totalSteps: total }),
  pushLog: (entry) => set({ log: [...get().log.slice(-200), { ...entry, t: Date.now() }] }),

  // Toasts (top-right notifications)
  toasts: [],
  pushToast: (message, type = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set({ toasts: [...get().toasts.slice(-4), { id, message, type }] });
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),

  // Serialize / load
  toJSON: () => ({
    name: get().projectName,
    nodes: get().nodes,
    edges: get().edges,
    version: '0.1.0'
  }),
  loadJSON: (data, filePath = null) => {
    const flow = isPromptFactoryFormat(data) ? normalizePromptFactoryFlow(data) : data;
    set({
      projectName: flow.name || 'Untitled',
      nodes: flow.nodes || [],
      edges: flow.edges || [],
      selectedId: null,
      workflowFilePath: filePath,
    });
  },
}));

/* ============================================================
   PROMPT FACTORY import adapter
   Converts flow_project_*.json (type-keyed nodes) → OBSIDIAN format
   ============================================================ */
function isPromptFactoryFormat(data) {
  return Array.isArray(data?.nodes) &&
    data.nodes.some(n => ['prompt','imageGen','videoGen','imageUpload','stitcher'].includes(n.type));
}

function normalizePromptFactoryFlow(raw) {
  const CAT  = { prompt:'direction', imageGen:'generation', videoGen:'generation', imageUpload:'input', stitcher:'orchestration' };
  const ICON = { prompt:'P', imageGen:'◇', videoGen:'▷', imageUpload:'⬆', stitcher:'⊞' };

  const nodes = raw.nodes.map(n => {
    const kind = n.type;
    const p    = n.data?.params || {};
    const base = {
      kind,
      label:    n.data?.label || kind,
      icon:     ICON[kind]    || '?',
      cat:      CAT[kind]     || 'input',
      _status:  null,
    };
    if (kind === 'prompt')      Object.assign(base, { text: p.text || '', lang: 'EN' });
    if (kind === 'imageGen')    Object.assign(base, { model: p.model || '🍌 Nano Banana Pro', aspectRatio: p.aspectRatio || '16:9', batchCount: p.batchCount || 1 });
    if (kind === 'videoGen')    Object.assign(base, { model: p.model || 'Omni Flash',         aspectRatio: p.aspectRatio || '16:9', duration: p.duration || 6, batchCount: p.batchCount || 1 });
    if (kind === 'imageUpload') Object.assign(base, { files: [], uploadLabel: n.data?.label || 'Ảnh nguồn' });
    if (kind === 'stitcher')    Object.assign(base, { progress: p.progress || 0 });
    return { id: n.id, type: 'obsidian', position: n.position, data: base };
  });

  const ts = raw.timestamp ? raw.timestamp.slice(0, 10) : '';
  return { name: `PF Import${ts ? ' ' + ts : ''}`, nodes, edges: raw.edges || [], version: '0.1.0' };
}
