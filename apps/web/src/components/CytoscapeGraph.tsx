import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

interface NodeData {
  id: string;
  label: string;
  type: string;
  isRoot?: boolean;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
  date?: string;
}

interface GraphProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedEdgeId?: string | null;
  selectedNodeId?: string | null;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export const CytoscapeGraph: React.FC<GraphProps> = ({
  nodes,
  edges,
  selectedEdgeId,
  selectedNodeId,
  onSelectEdge,
  onSelectNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map(n => ({
        group: 'nodes' as const,
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          isRoot: n.isRoot ? 'true' : 'false'
        }
      })),
      ...edges.map(e => ({
        group: 'edges' as const,
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          status: e.status,
          date: e.date || ''
        }
      }))
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#0f172a',
            'border-color': '#38bdf8',
            'border-width': 2,
            'label': 'data(label)',
            'font-family': 'Space Grotesk, sans-serif',
            'font-weight': 600,
            'font-size': '11px',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'color': '#f8fafc',
            'text-outline-color': '#030712',
            'text-outline-width': 3,
            'width': 44,
            'height': 44,
            'transition-property': 'background-color, border-color, width, height',
            'transition-duration': 0.3
          } as any
        },
        {
          selector: 'node[type = "PERSON"]',
          style: {
            'shape': 'ellipse',
            'background-color': '#1e1b4b',
            'border-color': '#818cf8',
            'width': 40,
            'height': 40
          } as any
        },
        {
          selector: 'node[type = "ORGANIZATION"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': '#0c192c',
            'border-color': '#0284c7',
            'corner-radius': '8px'
          } as any
        },
        {
          selector: 'node[isRoot = "true"], node:selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 4,
            'width': 54,
            'height': 54,
            'color': '#38bdf8'
          } as any
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': 'rgba(56, 189, 248, 0.45)',
            'target-arrow-color': '#38bdf8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-family': 'Space Grotesk, sans-serif',
            'font-size': '10px',
            'font-weight': 500,
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'color': '#94a3b8',
            'text-outline-color': '#030712',
            'text-outline-width': 2,
            'arrow-scale': 1.2
          } as any
        },
        {
          selector: 'edge:selected, edge.active',
          style: {
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e',
            'width': 3.5,
            'color': '#fb7185',
            'font-weight': 'bold',
            'font-size': '11px',
            'arrow-scale': 1.4
          } as any
        }
      ] as any,
      layout: {
        name: 'concentric',
        concentric: (node: any) => (node.data('isRoot') === 'true' ? 10 : 2),
        levelWidth: () => 1,
        padding: 50,
        spacingFactor: 1.6,
        animate: true,
        animationDuration: 800
      },
      userZoomingEnabled: true,
      userPanningEnabled: true
    });

    cy.on('tap', 'edge', evt => {
      const edge = evt.target;
      onSelectEdge(edge.id());
    });

    cy.on('tap', 'node', evt => {
      const node = evt.target;
      onSelectNode(node.id());
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.edges().removeClass('active');
    if (selectedEdgeId) {
      const targetEdge = cyRef.current.getElementById(selectedEdgeId);
      if (targetEdge) {
        targetEdge.addClass('active');
      }
    }
  }, [selectedEdgeId]);

  useEffect(() => {
    if (!cyRef.current) return;
    if (selectedNodeId) {
      const targetNode = cyRef.current.getElementById(selectedNodeId);
      if (targetNode) {
        targetNode.select();
      }
    }
  }, [selectedNodeId]);

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 40);
  };

  const handleResetZoom = () => {
    if (cyRef.current) cyRef.current.reset();
  };

  return (
    <div className="graph-wrapper cosmic-graph">
      <div className="graph-controls">
        <button className="graph-btn cosmic-btn" onClick={handleFit}>
          <span className="ctrl-dot"></span> Re-centrar Campo
        </button>
        <button className="graph-btn cosmic-btn" onClick={handleResetZoom}>
          Resetar Zoom
        </button>
      </div>
      <div id="cy-container" ref={containerRef} />
    </div>
  );
};
