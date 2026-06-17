/**
 * Workflow state — Zustand store.
 * Holds nodes, edges, execution state, log, selected node.
 */
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import { defaultDataFor } from './data/nodeDefs.js';
import {
  WEB_TASK_KINDS,
  syncPromptSlotsFromEdges,
  migrateWebTaskEdges,
  inferWebTaskTargetHandle,
  isValidWebTaskConnection,
} from './engine/workflowUtils.js';

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
  selectedIds: [],

  onNodesChange: (changes) => {
    const nodes = applyNodeChanges(changes, get().nodes);
    const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
    if (removedIds.length) {
      const rm = new Set(removedIds);
      const selectedIds = get().selectedIds.filter(id => !rm.has(id));
      set({
        nodes,
        edges: get().edges.filter(e => !rm.has(e.source) && !rm.has(e.target)),
        selectedIds,
        selectedId: selectedIds[0] || null,
      });
      return;
    }
    set({ nodes });
  },
  onEdgesChange: (changes) => {
    const prevEdges = get().edges;
    const removedIds = changes.filter(c => c.type === 'remove').map(c => c.id);
    const affectedTargets = new Set(
      prevEdges.filter(e => removedIds.includes(e.id)).map(e => e.target)
    );
    const edges = applyEdgeChanges(changes, prevEdges);
    let nodes = get().nodes;
    for (const tid of affectedTargets) {
      nodes = applyPromptSlotsToNode(tid, nodes, edges);
    }
    set({ edges, nodes });
  },

  onConnect: (conn) => {
    const nodes = get().nodes;
    const prevEdges = get().edges;
    const sourceNode = nodes.find(n => n.id === conn.source);
    const targetNode = nodes.find(n => n.id === conn.target);
    if (!sourceNode || !targetNode) return;

    let targetHandle = conn.targetHandle;
    const isWebTaskTarget = WEB_TASK_KINDS.includes(targetNode.data.kind);

    if (isWebTaskTarget) {
      if (!targetHandle) {
        targetHandle = inferWebTaskTargetHandle(sourceNode.data.kind, conn.target, prevEdges);
      }
      if (!targetHandle || !isValidWebTaskConnection(sourceNode.data.kind, targetHandle)) return;
      if (targetHandle.startsWith('prompt-') &&
        prevEdges.some(e => e.target === conn.target && e.targetHandle === targetHandle)) return;
    } else if (targetHandle && targetHandle !== 'in') {
      return;
    }

    const edges = addEdge(
      { ...conn, targetHandle: targetHandle || 'in', type: 'default', animated: false },
      prevEdges
    );
    const nextNodes = isWebTaskTarget
      ? applyPromptSlotsToNode(conn.target, nodes, edges)
      : nodes;
    set({ edges, nodes: nextNodes });
  },

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
    const { selectedIds, nodes, bridgeSessionOpen } = get();
    const primarySelected = selectedIds[0] || null;
    let keepSelected = false;
    if (primarySelected) {
      const cur = nodes.find(n => n.id === primarySelected);
      if (cur?.data?.kind === 'click_seq') {
        const sid = cur.data.sessionId || cur.id;
        if (bridgeSessionOpen[sid]) keepSelected = true;
      }
    }
    const nextSelected = keepSelected ? selectedIds : [id];
    const allNodes = [...get().nodes, newNode].map(n => ({
      ...n,
      selected: nextSelected.includes(n.id),
    }));
    set({
      nodes: allNodes,
      selectedIds: nextSelected,
      selectedId: nextSelected[0] || null,
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

  selectNode: (id) => get().selectNodes(id ? [id] : []),

  selectNodes: (ids) => {
    const idSet = new Set(ids);
    set({
      selectedIds: ids,
      selectedId: ids[0] || null,
      nodes: get().nodes.map(n => ({ ...n, selected: idSet.has(n.id) })),
    });
  },

  removeNode: (id) => get().removeNodes([id]),

  removeNodes: (ids) => {
    const idSet = new Set(ids);
    const selectedIds = get().selectedIds.filter(id => !idSet.has(id));
    const selSet = new Set(selectedIds);
    set({
      nodes: get().nodes
        .filter(n => !idSet.has(n.id))
        .map(n => ({ ...n, selected: selSet.has(n.id) })),
      edges: get().edges.filter(e => !idSet.has(e.source) && !idSet.has(e.target)),
      selectedIds,
      selectedId: selectedIds[0] || null,
    });
  },

  // Inspector tab per node + bridge session UI sync
  inspectorTabByNodeId: {},
  setInspectorTab: (nodeId, tab) => set({
    inspectorTabByNodeId: { ...get().inspectorTabByNodeId, [nodeId]: tab },
  }),

  bridgeSessionOpen: {},
  setBridgeSessionOpen: (sessionId, open) => set({
    bridgeSessionOpen: { ...get().bridgeSessionOpen, [sessionId]: open },
  }),

  clearAll: () => set({ nodes: [], edges: [], selectedId: null, selectedIds: [], workflowFilePath: null }),

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
    let nodes = (flow.nodes || []).map(migrateWebTaskNode);
    let edges = migrateWebTaskEdges(nodes, flow.edges || []);
    nodes = nodes.map(n => {
      if (!WEB_TASK_KINDS.includes(n.data?.kind)) return n;
      const slots = syncPromptSlotsFromEdges(n.id, nodes, edges, n.data.steps || [], n.data.promptSlots || []);
      return { ...n, data: { ...n.data, promptSlots: slots } };
    });
    set({
      projectName: flow.name || 'Untitled',
      nodes,
      edges,
      selectedId: null,
      selectedIds: [],
      workflowFilePath: filePath,
    });
  },
}));

function migrateWebTaskNode(n) {
  if (!['imageGen', 'videoGen'].includes(n.data?.kind)) {
    if (n.data?.kind === 'click_seq') {
      return {
        ...n,
        data: {
          ...n.data,
          promptSlots: Array.isArray(n.data.promptSlots) ? n.data.promptSlots : [],
        },
      };
    }
    return n;
  }
  const d = n.data;
  return {
    ...n,
    data: {
      ...webTaskDefaults(),
      ...d,
      url: d.url || d.bridge_url || '',
      grabFrom: d.grabFrom || d.bridge_grab || '',
      grabAttr: d.grabAttr || d.bridge_grab_attr || 'src',
      waitFor: d.waitFor || d.bridge_wait || '',
      timeout: d.timeout || d.bridge_timeout || 180,
      steps: Array.isArray(d.steps) ? d.steps : [],
      promptSlots: Array.isArray(d.promptSlots) ? d.promptSlots : [],
    },
  };
}

function applyPromptSlotsToNode(nodeId, nodes, edges) {
  return nodes.map(n => {
    if (n.id !== nodeId || !WEB_TASK_KINDS.includes(n.data.kind)) return n;
    const slots = syncPromptSlotsFromEdges(
      nodeId, nodes, edges, n.data.steps || [], n.data.promptSlots || []
    );
    return { ...n, data: { ...n.data, promptSlots: slots } };
  });
}

/* ============================================================
   PROMPT FACTORY import adapter
   Converts flow_project_*.json (type-keyed nodes) → OBSIDIAN format
   ============================================================ */
function isPromptFactoryFormat(data) {
  return Array.isArray(data?.nodes) &&
    data.nodes.some(n => ['prompt','imageGen','videoGen','imageUpload','stitcher'].includes(n.type));
}

function webTaskDefaults() {
  return {
    url: '', steps: [], sessionId: '', delay: 300,
    grabFrom: '', grabAttr: 'src', waitFor: '', timeout: 180,
    promptSlots: [],
  };
}

function normalizeGenNodeData(base, p, extra = {}) {
  const url = p.url || p.bridge_url || '';
  const grabFrom = p.grabFrom || p.bridge_grab || '';
  return {
    ...base,
    ...webTaskDefaults(),
    ...extra,
    url,
    grabFrom,
    grabAttr: p.grabAttr || p.bridge_grab_attr || 'src',
    waitFor: p.waitFor || p.bridge_wait || '',
    timeout: p.timeout || p.bridge_timeout || 180,
    steps: Array.isArray(p.steps) ? p.steps : [],
  };
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
    if (kind === 'imageGen') {
      Object.assign(base, normalizeGenNodeData(base, p, {
        model: p.model || '🍌 Nano Banana Pro',
        aspectRatio: p.aspectRatio || '16:9',
        batchCount: p.batchCount || 1,
      }));
    }
    if (kind === 'videoGen') {
      Object.assign(base, normalizeGenNodeData(base, p, {
        model: p.model || 'Omni Flash',
        aspectRatio: p.aspectRatio || '16:9',
        duration: p.duration || 6,
        batchCount: p.batchCount || 1,
      }));
    }
    if (kind === 'imageUpload') Object.assign(base, { files: [], uploadLabel: n.data?.label || 'Ảnh nguồn' });
    if (kind === 'stitcher')    Object.assign(base, { progress: p.progress || 0 });
    return { id: n.id, type: 'obsidian', position: n.position, data: base };
  });

  const ts = raw.timestamp ? raw.timestamp.slice(0, 10) : '';
  return { name: `PF Import${ts ? ' ' + ts : ''}`, nodes, edges: raw.edges || [], version: '0.1.0' };
}
