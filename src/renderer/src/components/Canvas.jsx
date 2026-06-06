import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, useReactFlow,
} from 'reactflow';
import { useStore } from '../store.js';
import ObsidianNode from './nodes/ObsidianNode.jsx';

const nodeTypes = { obsidian: ObsidianNode };

export default function Canvas() {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const onNodesChange = useStore(s => s.onNodesChange);
  const onEdgesChange = useStore(s => s.onEdgesChange);
  const onConnect = useStore(s => s.onConnect);
  const addNode = useStore(s => s.addNode);
  const selectNode = useStore(s => s.selectNode);

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

  const onSelectionChange = useCallback(({ nodes }) => {
    if (nodes && nodes.length) selectNode(nodes[0].id);
    else selectNode(null);
  }, [selectNode]);

  return (
    <main className="canvas-wrapper" ref={wrapperRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
