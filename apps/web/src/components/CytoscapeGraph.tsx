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
  predicate?: string;
  date?: string;
}

export type LayoutMode = 'concentric' | 'breadthfirst' | 'cose' | 'circle';

interface GraphProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedEdgeId?: string | null;
  selectedNodeId?: string | null;
  layoutMode?: LayoutMode;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onChangeLayout?: (mode: LayoutMode) => void;
}

export const CytoscapeGraph: React.FC<GraphProps> = ({
  nodes,
  edges,
  selectedEdgeId,
  selectedNodeId,
  layoutMode = 'concentric',
  onSelectEdge,
  onSelectNode,
  onChangeLayout
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
          predicate: e.predicate || '',
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
            'background-color': '#312e81',
            'border-color': '#a5b4fc',
            'border-width': 2.5,
            'width': 42,
            'height': 42
          } as any
        },
        {
          selector: 'node[type = "ORGANIZATION"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': '#082f49',
            'border-color': '#38bdf8',
            'border-width': 2.5,
            'corner-radius': '8px',
            'width': 48,
            'height': 48
          } as any
        },
        {
          selector: 'node[type = "AIRCRAFT"]',
          style: {
            'shape': 'diamond',
            'background-color': '#701a75',
            'border-color': '#f472b6',
            'border-width': 3,
            'width': 46,
            'height': 46
          } as any
        },
        {
          selector: 'node[isRoot = "true"], node:selected',
          style: {
            'border-color': '#f43f5e',
            'border-width': 4,
            'width': 56,
            'height': 56,
            'color': '#f43f5e'
          } as any
        },
        {
          selector: 'edge',
          style: {
            'width': 2.5,
            'line-color': 'rgba(148, 163, 184, 0.5)',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-family': 'Space Grotesk, sans-serif',
            'font-size': '10px',
            'font-weight': 600,
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'color': '#cbd5e1',
            'text-outline-color': '#020617',
            'text-outline-width': 3,
            'arrow-scale': 1.3
          } as any
        },
        {
          selector: 'edge[predicate = "CONTRACTED_WITH"]',
          style: {
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'width': 3
          } as any
        },
        {
          selector: 'edge[predicate = "PAID_TO"]',
          style: {
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e',
            'width': 3.5,
            'line-style': 'dashed'
          } as any
        },
        {
          selector: 'edge[predicate = "OWNS_AIRCRAFT"], edge[predicate = "OPERATES_AIRCRAFT"]',
          style: {
            'line-color': '#d946ef',
            'target-arrow-color': '#d946ef',
            'width': 3
          } as any
        },
        {
          selector: 'edge[predicate = "DIRECTOR_OF"], edge[predicate = "ADMINISTRATOR_OF"]',
          style: {
            'line-color': '#eab308',
            'target-arrow-color': '#eab308',
            'width': 3
          } as any
        },
        {
          selector: 'edge:selected, edge.active',
          style: {
            'line-color': '#f43f5e',
            'target-arrow-color': '#f43f5e',
            'width': 4.5,
            'color': '#fb7185',
            'font-weight': 'bold',
            'font-size': '12px',
            'arrow-scale': 1.6
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

  const getLayoutConfig = (mode: LayoutMode) => {
    switch (mode) {
      case 'breadthfirst':
        return {
          name: 'breadthfirst',
          directed: true,
          padding: 60,
          spacingFactor: 1.8,
          avoidOverlap: true,
          animate: true,
          animationDuration: 600
        };
      case 'cose':
        return {
          name: 'cose',
          animate: true,
          animationDuration: 800,
          refresh: 20,
          fit: true,
          padding: 60,
          randomize: false,
          nodeRepulsion: () => 1200000,
          idealEdgeLength: () => 180,
          edgeElasticity: () => 100,
          nestingFactor: 5,
          gravity: 0.15,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95
        };
      case 'circle':
        return {
          name: 'circle',
          padding: 60,
          avoidOverlap: true,
          animate: true,
          animationDuration: 600
        };
      case 'concentric':
      default:
        return {
          name: 'concentric',
          concentric: (node: any) => {
            if (node.data('isRoot') === 'true') return 12;
            const type = node.data('type');
            if (type === 'ORGANIZATION') return 8;
            if (type === 'PERSON') return 5;
            return 2;
          },
          levelWidth: () => 3,
          padding: 60,
          spacingFactor: 2.2,
          avoidOverlap: true,
          animate: true,
          animationDuration: 800
        };
    }
  };

  useEffect(() => {
    if (!cyRef.current) return;
    const layout = cyRef.current.layout(getLayoutConfig(layoutMode) as any);
    layout.run();
  }, [layoutMode]);

  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 40);
  };

  const handleResetZoom = () => {
    if (cyRef.current) cyRef.current.reset();
  };

  return (
    <div className="graph-wrapper cosmic-graph">
      <div className="graph-controls">
        <div className="layout-switcher-bar">
          <button
            className={`layout-chip ${layoutMode === 'concentric' ? 'active' : ''}`}
            onClick={() => onChangeLayout && onChangeLayout('concentric')}
            title="Órbita Cósmica Concêntrica"
          >
            Órbita
          </button>
          <button
            className={`layout-chip ${layoutMode === 'breadthfirst' ? 'active' : ''}`}
            onClick={() => onChangeLayout && onChangeLayout('breadthfirst')}
            title="Hierarquia de Controle e Poder"
          >
            Hierarquia
          </button>
          <button
            className={`layout-chip ${layoutMode === 'cose' ? 'active' : ''}`}
            onClick={() => onChangeLayout && onChangeLayout('cose')}
            title="Rede Gravitacional de Força"
          >
            Força
          </button>
          <button
            className={`layout-chip ${layoutMode === 'circle' ? 'active' : ''}`}
            onClick={() => onChangeLayout && onChangeLayout('circle')}
            title="Anel Periférico Circular"
          >
            Anel
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="graph-btn cosmic-btn" onClick={handleFit}>
            <span className="ctrl-dot"></span> Re-centrar
          </button>
          <button className="graph-btn cosmic-btn" onClick={handleResetZoom}>
            Resetar
          </button>
        </div>
      </div>
      <div id="cy-container" ref={containerRef} />
    </div>
  );
};
