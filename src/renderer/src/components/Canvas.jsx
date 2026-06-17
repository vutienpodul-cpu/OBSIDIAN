import React, { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, useReactFlow,
} from 'reactflow';
import { useStore } from '../store.js';
import ObsidianNode from './nodes/ObsidianNode.jsx';
import {
  WEB_TASK_KINDS,
  isValidWebTaskConnection,
} from '../engine/workflowUtils.js';

const nodeTypes = { obsidian: ObsidianNode };

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function Canvas() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const onNodesChange = useStore(s => s.onNodesChange);
  const onEdgesChange = useStore(s => s.onEdgesChange);
  const onConnect = useStore(s => s.onConnect);
  const addNode = useStore(s => s.addNode);
  const selectNodes = useStore(s => s.selectNodes);
  const removeNodes = useStore(s => s.removeNodes);

  const wrapperRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback(e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('application/obsidian-node');
    if (!kind) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(kind, pos);
  }, [addNode, screenToFlowPosition]);

  const onSelectionChange = useCallback(({ nodes: selNodes }) => {
    selectNodes((selNodes || []).map(n => n.id));
  }, [selectNodes]);

  const isValidConnection = useCallback(({ source, target, targetHandle }) => {
    const { nodes, edges } = useStore.getState();
    const src = nodes.find(n => n.id === source);
    const tgt = nodes.find(n => n.id === target);
    if (!src || !tgt) return false;

    if (WEB_TASK_KINDS.includes(tgt.data.kind)) {
      if (!targetHandle) return false;
      if (!isValidWebTaskConnection(src.data.kind, targetHandle)) return false;
      if (targetHandle.startsWith('prompt-') &&
        edges.some(e => e.target === target && e.targetHandle === targetHandle)) return false;
      return true;
    }

    if (targetHandle && targetHandle !== 'in') return false;
    return true;
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (isTypingTarget(document.activeElement)) return;

      const mod = e.metaKey || e.ctrlKey;
      const { nodes: allNodes, selectedIds } = useStore.getState();

      if (mod && e.key.toLowerCase() === 'a') {
        if (allNodes.length === 0) return;
        e.preventDefault();
        selectNodes(allNodes.map(n => n.id));
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        removeNodes(selectedIds);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectNodes, removeNodes]);

  return (
    <main className="canvas-wrapper" ref={wrapperRef} tabIndex={-1}>
      <div className="canvas-hints">
        <span>Kéo trống = di chuyển canvas</span>
        <span>·</span>
        <span><kbd>Shift</kbd>+kéo = chọn vùng</span>
        <span>·</span>
        <span>Chuột phải kéo = pan</span>
        <span>·</span>
        <span><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+click thêm/bớt</span>
        <span>·</span>
        <span><kbd>Ctrl</kbd>+<kbd>A</kbd> chọn tất</span>
        <span>·</span>
        <span><kbd>Del</kbd> xóa</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'default' }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={[0, 1, 2]}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control']}
        deleteKeyCode={null}
        selectNodesOnDrag={false}
      >
        <Background gap={24} size={1} color="rgba(255,255,255,0.04)" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable zoomable
          nodeColor={(n) => {
            const cat = n.data?.cat;
            const map = {
              input: '#4A90E2', direction: '#E8B4A0', intelligence: '#8B5CF6',
              bridge: '#DC2855', generation: '#14B8A6', orchestration: '#94A3B8',
            };
            return map[cat] || '#D4A574';
          }}
        />
      </ReactFlow>
    </main>
  );
}
