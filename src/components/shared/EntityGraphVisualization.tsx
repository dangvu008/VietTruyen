/**
 * File: EntityGraphVisualization.tsx
 * Purpose: Entity graph visualization component for narrative graph
 * Layer: Components / Shared
 * 
 * Visualizes narrative nodes and edges from the narrative graph system
 */

import { useEffect, useRef, useState } from 'react';
import type { NarrativeNode, NarrativeEdge } from '../../types/narrative_graph';

interface EntityGraphVisualizationProps {
  nodes: NarrativeNode[];
  edges: NarrativeEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NarrativeNode) => void;
  onEdgeClick?: (edge: NarrativeEdge) => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
  node: NarrativeNode;
}

interface EdgePosition {
  source: NodePosition;
  target: NodePosition;
  edge: NarrativeEdge;
}

export function EntityGraphVisualization({
  nodes,
  edges,
  width = 800,
  height = 600,
  onNodeClick,
  onEdgeClick
}: EntityGraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const [edgePositions, setEdgePositions] = useState<EdgePosition[]>([]);

  // Calculate node positions using simple force-directed layout
  useEffect(() => {
    if (nodes.length === 0) return;

    // Initialize positions randomly
    const positions: NodePosition[] = nodes.map((node) => ({
      id: node.id,
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50,
      node
    }));

    // Simple force-directed layout simulation
    const iterations = 50;
    const k = Math.sqrt((width * height) / nodes.length); // Optimal distance
    const repulsion = 1000;
    const attraction = 0.01;

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          positions[i].x -= fx;
          positions[i].y -= fy;
          positions[j].x += fx;
          positions[j].y += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const sourcePos = positions.find(p => p.id === edge.fromNodeId);
        const targetPos = positions.find(p => p.id === edge.toNodeId);
        if (!sourcePos || !targetPos) continue;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (distance - k) * attraction;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        sourcePos.x += fx;
        sourcePos.y += fy;
        targetPos.x -= fx;
        targetPos.y -= fy;
      }

      // Keep nodes within bounds
      for (const pos of positions) {
        pos.x = Math.max(30, Math.min(width - 30, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      }
    }

    setNodePositions(positions);

    // Calculate edge positions
    const edgePos: EdgePosition[] = edges
      .map(edge => {
        const source = positions.find(p => p.id === edge.fromNodeId);
        const target = positions.find(p => p.id === edge.toNodeId);
        if (!source || !target) return null;
        return { source, target, edge };
      })
      .filter((e): e is EdgePosition => e !== null);

    setEdgePositions(edgePos);
  }, [nodes, edges, width, height]);

  const getNodeColor = (node: NarrativeNode): string => {
    switch (node.nodeType) {
      case 'character': return '#f0c59a'; // amber
      case 'world': return '#2dd4bf'; // teal
      case 'faction': return '#e8708a'; // rose
      case 'arc': return '#a78bfa'; // purple
      case 'chapter': return '#34d399'; // green
      case 'scene': return '#fbbf24'; // yellow
      case 'beat': return '#60a5fa'; // blue
      default: return '#94a3b8'; // slate
    }
  };

  const getNodeSize = (node: NarrativeNode): number => {
    // Size based on importance/connections
    const connectionCount = edges.filter(e => e.fromNodeId === node.id || e.toNodeId === node.id).length;
    return 20 + Math.min(connectionCount * 5, 30);
  };

  return (
    <div className="relative bg-surface rounded-lg border border-border overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-surface"
      >
        {/* Draw edges */}
        {edgePositions.map(({ source, target, edge }, index) => (
          <g key={`edge-${index}`} onClick={() => onEdgeClick?.(edge)} className="cursor-pointer">
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={2}
            />
            {/* Edge label */}
            <text
              x={(source.x + target.x) / 2}
              y={(source.y + target.y) / 2}
              fill="rgba(255,255,255,0.5)"
              fontSize={10}
              textAnchor="middle"
              className="pointer-events-none"
            >
              {edge.edgeType}
            </text>
          </g>
        ))}

        {/* Draw nodes */}
        {nodePositions.map(({ id, x, y, node }) => (
          <g
            key={id}
            onClick={() => onNodeClick?.(node)}
            className="cursor-pointer transition-transform hover:scale-110"
          >
            {/* Node circle */}
            <circle
              cx={x}
              cy={y}
              r={getNodeSize(node)}
              fill={getNodeColor(node)}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
              className="hover:stroke-white transition-colors"
            />
            
            {/* Node label */}
            <text
              x={x}
              y={y + getNodeSize(node) + 15}
              fill="rgba(255,255,255,0.8)"
              fontSize={12}
              textAnchor="middle"
              className="pointer-events-none"
            >
              {node.label}
            </text>

            {/* Node type indicator */}
            <text
              x={x}
              y={y + 4}
              fill="rgba(0,0,0,0.6)"
              fontSize={10}
              textAnchor="middle"
              className="pointer-events-none font-medium"
            >
              {node.nodeType[0].toUpperCase()}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-surface-dim rounded-lg p-3 border border-border">
        <div className="text-xs text-text-muted mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f0c59a]" />
            <span className="text-xs text-text-secondary">Character</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#2dd4bf]" />
            <span className="text-xs text-text-secondary">Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#e8708a]" />
            <span className="text-xs text-text-secondary">Organization</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#a78bfa]" />
            <span className="text-xs text-text-secondary">Item</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#34d399]" />
            <span className="text-xs text-text-secondary">Concept</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 bg-surface-dim rounded-lg p-3 border border-border">
        <div className="text-xs text-text-muted">Graph Stats</div>
        <div className="text-sm text-text-primary mt-1">
          {nodes.length} nodes, {edges.length} edges
        </div>
      </div>
    </div>
  );
}

/**
 * Simplified version for basic entity visualization
 */
export function SimpleEntityGraph({
  entities,
  relations,
  projectId = 'default'
}: {
  entities: Array<{ id: string; name: string; type?: string }>;
  relations: Array<{ from: string; to: string; type?: string }>;
  projectId?: string;
}) {
  const nodes: NarrativeNode[] = entities.map(e => ({
    id: e.id,
    projectId,
    nodeType: (e.type as any) || 'character',
    refId: e.id,
    label: e.name,
    salience: 1,
    updatedAt: new Date().toISOString()
  }));

  const edges: NarrativeEdge[] = relations.map((r, i) => ({
    id: `edge-${i}`,
    projectId,
    fromNodeId: r.from,
    toNodeId: r.to,
    edgeType: (r.type as any) || 'co_presence',
    weight: 1,
    evidenceChapterIds: [],
    updatedAt: new Date().toISOString()
  }));

  return (
    <EntityGraphVisualization
      nodes={nodes}
      edges={edges}
      width={600}
      height={400}
    />
  );
}