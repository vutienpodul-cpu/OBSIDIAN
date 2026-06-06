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
  setProjectName: (name) => set({ projectName: name }),

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
      type: 'obsidian',  // single custom type, data.cat drives the look
      position: position || { x: 200, y: 200 },
      data
    };
    set({ nodes: [...get().nodes, newNode], selectedId: id });
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

  removeNode: (id) => set({
    nodes: get().nodes.filter(n => n.id !== id),
    edges: get().edges.filter(e => e.source !== id && e.target !== id),
    selectedId: get().selectedId === id ? null : get().selectedId,
  }),

  clearAll: () => set({ nodes: [], edges: [], selectedId: null }),

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

  // Serialize / load
  toJSON: () => ({
    name: get().projectName,
    nodes: get().nodes,
    edges: get().edges,
    version: '0.1.0'
  }),
  loadJSON: (data) => set({
    projectName: data.name || 'Untitled',
    nodes: data.nodes || [],
    edges: data.edges || [],
    selectedId: null,
  }),
}));
