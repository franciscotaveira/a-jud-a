import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

interface NodeData {
  id: string;
  label: string;
  type: string;
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  status: string;
}

interface GraphProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedEdgeId?: string | null;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export const CytoscapeGraph: React.FC<GraphProps> = ({
  nodes,
  edges,
  selectedEdgeId,
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
        data: { id: n.id, label: n.label, type: n.type }
      })),
      ...edges.map(e => ({
        group: 'edges' as const,
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          status: e.status
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
            'background-color': '#ffffff',
            'border-color': '#19382c',
            'border-width': 2,
            'label': 'data(label)',
            'font-family': 'Newsreader, Georgia, serif',
            'font-size': '12px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'color': '#1c1b18',
            'width': 36,
            'height': 36
          }
        },
        {
          selector: 'node[type = "PERSON"]',
          style: {
            'shape': 'ellipse',
            'border-color': '#2c4d6f'
          }
        },
        {
          selector: 'node[type = "ORGANIZATION"]',
          style: {
            'shape': 'round-rectangle',
            'border-color': '#19382c'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#a3b8ad',
            'target-arrow-color': '#a3b8ad',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-family': 'Inter, sans-serif',
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'color': '#68645c'
          }
        },
        {
          selector: 'edge:selected, edge.active',
          style: {
            'line-color': '#19382c',
            'target-arrow-color': '#19382c',
            'width': 3,
            'color': '#19382c',
            'font-weight': 'bold'
          }
        }
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 40,
        spacingFactor: 1.5
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

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 30);
  };

  const handleResetZoom = () => {
    if (cyRef.current) cyRef.current.reset();
  };

  return (
    <div className="graph-wrapper">
      <div className="graph-controls">
        <button className="graph-btn" onClick={handleFit}>Enquadrar</button>
        <button className="graph-btn" onClick={handleResetZoom}>Resetar</button>
      </div>
      <div id="cy-container" ref={containerRef} />
    </div>
  );
};
