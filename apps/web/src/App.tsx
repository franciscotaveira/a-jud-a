import { useState, useEffect } from 'react';
import {
  Search, FileText, ExternalLink,
  RefreshCw, AlertTriangle, Bot, Sparkles,
  Globe2, Orbit, Calendar, Layers, Activity, ChevronRight,
  ShieldAlert, Zap
} from 'lucide-react';
import { CytoscapeGraph, type LayoutMode } from './components/CytoscapeGraph.tsx';

interface Identifier {
  scheme: string;
  normalized_value: string;
}

interface Fact {
  field_name: string;
  value: string;
}

interface EntityDetail {
  id: string;
  canonical_name: string;
  entity_type: string;
  jurisdiction: string;
  identifiers: Identifier[];
  facts: Fact[];
}

interface EvidenceItem {
  id: string;
  role: string;
  excerpt: string;
  locator: {
    page?: number;
    section?: string;
    exactText?: string;
  };
  extractionMethod: string;
  reviewStatus: string;
  document: {
    id: string;
    title: string;
    type: string;
    date: string;
  };
  artifact: {
    id: string;
    sha256: string;
    storagePath: string;
    mediaType: string;
  };
  source: {
    name: string;
    official: boolean;
  };
}

interface RelationshipItem {
  id: string;
  subjectEntityId: string;
  predicate: string;
  objectEntityId: string;
  verificationStatus: string;
  subjectName: string;
  objectName: string;
  timelineDate?: string;
  evidences: EvidenceItem[];
}

interface GraphData {
  rootEntity?: {
    id: string;
    canonical_name: string;
    entity_type: string;
  };
  nodes: Array<{
    id: string;
    canonical_name: string;
    entity_type: string;
    isRoot?: boolean;
    metrics?: {
      degree: number;
      inDegree: number;
      outDegree: number;
      isHub: boolean;
    };
  }>;
  relationships: RelationshipItem[];
  forensicAlerts?: Array<{
    id: string;
    level: 'HIGH' | 'MEDIUM' | 'INFO';
    title: string;
    description: string;
    relatedEntityIds: string[];
  }>;
  topology?: {
    totalEntities: number;
    totalRelationships: number;
    density: string;
  };
}

export function App() {
  const [viewMode, setViewMode] = useState<'UNIVERSAL' | 'FOCUS'>('UNIVERSAL');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('concentric');
  const [searchQuery, setSearchQuery] = useState('33.923.798/0001-00');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('50000000-0000-0000-0000-000000000001'); // Banco Master
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados do Hermes Copilot
  const [hermesLoading, setHermesLoading] = useState(false);
  const [hermesStatus, setHermesStatus] = useState<any | null>(null);
  const [hermesResult, setHermesResult] = useState<any | null>(null);

  // Carregar dados conforme o modo de visualização
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const loadData = async () => {
      try {
        if (viewMode === 'UNIVERSAL') {
          // Carregar visão universal com todo o grafo interligado
          const [uGraphRes, entRes] = await Promise.all([
            fetch('/api/graph/universal').then(r => r.json()),
            selectedEntityId ? fetch(`/api/entities/${selectedEntityId}`).then(r => r.json()) : Promise.resolve(null)
          ]);

          if (!isMounted) return;
          setGraphData(uGraphRes);
          if (entRes) setEntityDetail(entRes);

          if (uGraphRes.relationships && uGraphRes.relationships.length > 0 && !selectedRelId) {
            setSelectedRelId(uGraphRes.relationships[0].id);
          }
        } else {
          // Modo Foco em 1 Salto na entidade
          if (!selectedEntityId) return;
          const [entity, graph] = await Promise.all([
            fetch(`/api/entities/${selectedEntityId}`).then(r => r.json()),
            fetch(`/api/entities/${selectedEntityId}/graph`).then(r => r.json())
          ]);

          if (!isMounted) return;
          setEntityDetail(entity);
          setGraphData(graph);
          if (graph.relationships && graph.relationships.length > 0) {
            setSelectedRelId(graph.relationships[0].id);
          } else {
            setSelectedRelId(null);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error(err);
        setErrorMsg(err.message || 'Erro ao carregar dados do grafo');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [viewMode, selectedEntityId]);

  const handleRunHermes = async () => {
    if (!selectedRelId) return;
    setHermesLoading(true);
    setHermesStatus({ status: 'INICIANDO', progressPercent: 10, currentStepDescription: 'Enviando ao Hermes Copilot (Nemotron 120B)...' });
    setHermesResult(null);

    try {
      const startRes = await fetch('/api/analysis/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRelationshipId: selectedRelId })
      });

      if (!startRes.ok) throw new Error('Falha ao iniciar análise no Hermes');
      const { runId } = await startRes.json();

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/analysis/runs/${runId}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          setHermesStatus(statusData);

          if (statusData.status === 'SUCCEEDED') {
            clearInterval(interval);
            const resRes = await fetch(`/api/analysis/runs/${runId}/result`);
            if (resRes.ok) {
              const resData = await resRes.json();
              setHermesResult(resData);
            }
            setHermesLoading(false);
          } else if (statusData.status === 'FAILED' || statusData.status === 'CANCELLED') {
            clearInterval(interval);
            setHermesLoading(false);
          }
        } catch (pollErr) {
          console.error('Erro no polling do Hermes:', pollErr);
        }
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar análise Hermes');
      setHermesLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error('Erro na consulta');
      const data = await res.json();
      setSearchResults(data.results || []);

      if (data.results && data.results.length > 0) {
        setSelectedEntityId(data.results[0].id);
        setViewMode('FOCUS');
      } else {
        setErrorMsg('Nenhuma entidade encontrada para a consulta.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao pesquisar');
    } finally {
      setLoading(false);
    }
  };

  // Elementos formatados para o Cytoscape
  const cyNodes = graphData?.nodes.map(n => ({
    id: n.id,
    label: n.canonical_name,
    type: n.entity_type,
    isRoot: n.id === selectedEntityId
  })) || [];

  const cyEdges = graphData?.relationships.map(r => ({
    id: r.id,
    source: r.subjectEntityId,
    target: r.objectEntityId,
    label: r.predicate.replace(/_/g, ' '),
    predicate: r.predicate,
    status: r.verificationStatus,
    date: r.timelineDate
  })) || [];

  const activeRelation = graphData?.relationships.find(r => r.id === selectedRelId);

  // Ordenar linha do tempo completa cronologicamente
  const timelineEvents = [...(graphData?.relationships || [])].sort((a, b) => {
    const da = a.timelineDate || '2024-01-01';
    const db = b.timelineDate || '2024-01-01';
    return da.localeCompare(db);
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);

  return (
    <div className="cosmos-station">
      {/* 1. UNIVERSO DE NAVEGAÇÃO ESPACIAL 360° (FULL-VIEWPORT 100VW / 100VH) */}
      <div className="universe-canvas-container">
        <CytoscapeGraph
          nodes={cyNodes}
          edges={cyEdges}
          selectedEdgeId={selectedRelId}
          selectedNodeId={selectedEntityId}
          layoutMode={layoutMode}
          onSelectEdge={id => {
            setSelectedRelId(id);
            setSidebarOpen(true);
          }}
          onSelectNode={id => {
            setSelectedEntityId(id);
            setSidebarOpen(true);
            fetch(`/api/entities/${id}`).then(r => r.json()).then(setEntityDetail);
          }}
          onChangeLayout={mode => setLayoutMode(mode)}
        />
      </div>

      {/* Notificação de Erro Flutuante */}
      {errorMsg && (
        <div style={{ position: 'absolute', top: '74px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '8px 16px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', backdropFilter: 'blur(12px)' }}>
          <AlertTriangle size={15} />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', marginLeft: '8px' }}>✕</button>
        </div>
      )}

      {/* 2. HUD SUPERIOR FLUTUANTE (BRAND + STATUS + VIEW-SWITCH + BUSCA) */}
      <header className="hud-topbar">
        <div className="hud-left">
          <div className="logo-brand">
            <Orbit size={22} color="var(--neon-cyan)" className="animate-spin-slow" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.05rem', margin: 0 }}>PIG-BR // COSMOS</h1>
                <span className="logo-badge">V2.0 UNIVERSAL</span>
              </div>
              <div className="hud-subtitle">
                {cyNodes.length} NÓS ORBITAIS • {cyEdges.length} VÍNCULOS VERIFICADOS • STF PET. 16.662
              </div>
            </div>
          </div>

          <div className="view-mode-tabs">
            <button
              className={`mode-tab-btn ${viewMode === 'UNIVERSAL' ? 'active' : ''}`}
              onClick={() => setViewMode('UNIVERSAL')}
            >
              <Globe2 size={13} />
              <span>Universo Completo</span>
            </button>
            <button
              className={`mode-tab-btn ${viewMode === 'FOCUS' ? 'active' : ''}`}
              onClick={() => setViewMode('FOCUS')}
            >
              <Layers size={13} />
              <span>Foco Radial</span>
            </button>
          </div>
        </div>

        {/* Busca Cósmica Flutuante */}
        <div className="hud-center-search">
          <form className="search-cosmos-group" onSubmit={handleSearch}>
            <input
              type="text"
              className="search-cosmos-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rastrear CNPJ, Razão Social ou Pessoa (ex: Banco Master, Daniel Vorcaro, Barci de Moraes)..."
            />
            <button type="submit" className="search-cosmos-btn" disabled={loading}>
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
              <span>Rastrear</span>
            </button>
          </form>

          {searchResults.length > 1 && (
            <div className="hud-candidates-dropdown">
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Candidatos:</span>
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedEntityId(r.id);
                    setViewMode('FOCUS');
                  }}
                  className="cosmic-btn"
                  style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                >
                  {r.canonical_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hud-right-actions">
          {/* Botão Alertas Forenses */}
          {graphData?.forensicAlerts && graphData.forensicAlerts.length > 0 && (
            <button
              className={`cosmic-btn ${alertsOpen ? 'active' : ''}`}
              onClick={() => setAlertsOpen(!alertsOpen)}
              style={{ borderColor: '#f43f5e', color: '#f43f5e' }}
            >
              <ShieldAlert size={14} />
              <span>{graphData.forensicAlerts.length} Sinais de Alerta</span>
            </button>
          )}

          {/* Botão Alternar Linha do Tempo */}
          <button
            className={`cosmic-btn ${timelineOpen ? 'active' : ''}`}
            onClick={() => setTimelineOpen(!timelineOpen)}
          >
            <Calendar size={14} />
            <span>Linha do Tempo</span>
          </button>

          {/* Botão Alternar Gaveta Hermes / Evidências */}
          <button
            className={`cosmic-btn ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Bot size={14} />
            <span>{sidebarOpen ? 'Ocultar Dossiê' : 'Abrir Dossiê'}</span>
          </button>
        </div>
      </header>

      {/* 3. MODAL / OVERLAY DE ALERTAS FORENSES FLUTUANTE */}
      {alertsOpen && graphData?.forensicAlerts && (
        <div className="hud-alerts-overlay glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#f43f5e" />
              <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.84rem', letterSpacing: '0.05em', color: '#f8fafc' }}>
                SINAIS FORENSES & ALERTAS DE TOPOLOGIA ({graphData.forensicAlerts.length})
              </span>
            </div>
            <button className="cosmic-btn" style={{ padding: '2px 8px' }} onClick={() => setAlertsOpen(false)}>
              ✕ Fechar
            </button>
          </div>
          <div className="forensic-alerts-grid">
            {graphData.forensicAlerts.map(alert => (
              <div
                key={alert.id}
                className={`forensic-alert-banner level-${alert.level}`}
                onClick={() => {
                  if (alert.relatedEntityIds && alert.relatedEntityIds.length > 0) {
                    setSelectedEntityId(alert.relatedEntityIds[0]);
                    setSidebarOpen(true);
                    fetch(`/api/entities/${alert.relatedEntityIds[0]}`).then(r => r.json()).then(setEntityDetail);
                  }
                }}
              >
                <span className={`alert-badge badge-${alert.level}`}>{alert.level}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <Zap size={14} color={alert.level === 'HIGH' ? '#f43f5e' : '#38bdf8'} />
                    <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.76rem', fontWeight: 700, color: '#f1f5f9' }}>
                      {alert.title}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    {alert.description}
                  </p>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. LINHA DO TEMPO ESPACIAL HORIZONTAL FLUTUANTE (BOTTOM DOCK) */}
      {timelineOpen && (
        <div className="hud-bottom-timeline glass-panel">
          <div className="timeline-cosmos-title" style={{ padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} color="var(--neon-cyan)" />
              <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.05em' }}>
                ÓRBITA TEMPORAL CRONOLÓGICA ({timelineEvents.length} EVENTOS)
              </span>
            </div>
            <button
              onClick={() => setTimelineOpen(false)}
              className="cosmic-btn"
              style={{ padding: '2px 6px', fontSize: '0.65rem' }}
            >
              Minimizar
            </button>
          </div>

          <div className="timeline-rail-dock">
            {timelineEvents.map((evt) => (
              <div
                key={evt.id}
                className={`timeline-dock-node ${evt.id === selectedRelId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRelId(evt.id);
                  setSidebarOpen(true);
                }}
              >
                <div className="timeline-dock-date">
                  <span className="ctrl-dot"></span>
                  <span>{evt.timelineDate || 'DATA N/D'}</span>
                </div>
                <div className="timeline-dock-pred">{evt.predicate.replace(/_/g, ' ')}</div>
                <div className="timeline-dock-actors">
                  <strong>{evt.subjectName}</strong> → {evt.objectName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. GAVETA LATERAL FLUTUANTE (INSPETOR DE EVIDÊNCIAS & HERMES COPILOT) */}
      {sidebarOpen && (
        <aside className="hud-right-drawer glass-panel">
          <div className="drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--neon-cyan)" />
              <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.82rem', letterSpacing: '0.05em' }}>
                AUDITORIA FORENSE // DOSSIÊ
              </span>
            </div>
            <button
              className="cosmic-btn"
              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
              onClick={() => setSidebarOpen(false)}
            >
              ✕ Ocultar
            </button>
          </div>

          <div className="drawer-content">
            {/* Card da Entidade em Foco */}
            {entityDetail && (
              <div className="drawer-section">
                <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-orbitron)', color: 'var(--neon-cyan)', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  NÓ ORBITAL EM FOCO
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  {entityDetail.canonical_name}
                </h2>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span className="logo-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'var(--neon-cyan)' }}>
                    {entityDetail.entity_type}
                  </span>
                  {entityDetail.identifiers?.map((i, idx) => (
                    <span key={idx} className="logo-badge" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: '#e2e8f0' }}>
                      {i.scheme}: {i.normalized_value}
                    </span>
                  ))}
                </div>

                {entityDetail.facts?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px', fontSize: '0.74rem' }}>
                    {entityDetail.facts.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.field_name.replace(/_/g, ' ')}:</span>
                        <strong style={{ color: '#ffffff' }}>{f.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Painel de Evidências */}
            <div className="drawer-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Activity size={15} color="var(--neon-cyan)" />
                <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.8rem', color: '#ffffff' }}>
                  Evidências do Vínculo
                </span>
              </div>

              {activeRelation ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(2, 6, 23, 0.8)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    Vínculo: <strong style={{ color: '#ffffff' }}>{activeRelation.subjectName}</strong> [{activeRelation.predicate.replace(/_/g, ' ')}] <strong style={{ color: '#ffffff' }}>{activeRelation.objectName}</strong>
                  </div>

                  {activeRelation.evidences.map((ev, idx) => (
                    <div key={idx} className="evidence-card-cosmic">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                        <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>PAPEL: {ev.role}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{ev.locator?.page ? `Pág. ${ev.locator.page}` : 'Pág. N/D'}</span>
                      </div>

                      <blockquote className="evidence-quote-cosmic" style={{ fontSize: '0.78rem' }}>
                        “{ev.excerpt}”
                      </blockquote>

                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div><strong style={{ color: '#ffffff' }}>Doc:</strong> {ev.document.title}</div>
                        <div><strong style={{ color: '#ffffff' }}>Fonte:</strong> {ev.source.name}</div>
                        <div className="cosmic-hash">SHA: {ev.artifact.sha256}</div>
                      </div>

                      <a
                        href={`/api/artifacts/${ev.artifact.id}/raw#page=${ev.locator?.page || 1}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-open-pdf-cosmic"
                        style={{ fontSize: '0.72rem', padding: '5px 8px' }}
                      >
                        <ExternalLink size={12} />
                        <span>Ver PDF Original (Pág. {ev.locator?.page || 1})</span>
                      </a>
                    </div>
                  ))}

                  {/* Hermes Copilot */}
                  <div className="hermes-copilot-container">
                    <div className="hermes-copilot-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bot size={15} color="var(--neon-cyan)" />
                        <strong style={{ fontFamily: 'var(--font-orbitron)', fontSize: '0.76rem', color: '#ffffff' }}>
                          Hermes Copilot
                        </strong>
                      </div>
                      <button
                        className="hermes-btn-trigger"
                        id="btn-run-hermes"
                        onClick={handleRunHermes}
                        disabled={hermesLoading}
                        style={{ fontSize: '0.68rem', padding: '4px 8px' }}
                      >
                        <Sparkles size={11} />
                        <span>{hermesLoading ? 'Raciocinando...' : 'Analisar com Hermes (120B)'}</span>
                      </button>
                    </div>

                    {hermesLoading && hermesStatus && (
                      <div className="hermes-status-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                          <span style={{ color: '#ffffff' }}>{hermesStatus.currentStepDescription || 'Processando...'}</span>
                          <span style={{ color: 'var(--neon-cyan)' }}>{hermesStatus.progressPercent || 20}%</span>
                        </div>
                        <div className="hermes-progress-bar">
                          <div className="hermes-progress-fill" style={{ width: `${hermesStatus.progressPercent || 20}%` }} />
                        </div>
                      </div>
                    )}

                    {hermesResult && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#e2e8f0', background: 'rgba(2, 6, 23, 0.9)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          {hermesResult.summary}
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {hermesResult.statements?.map((st: any, sIdx: number) => (
                            <div key={sIdx} className="hermes-statement-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className={`hermes-kind-badge kind-${st.kind}`}>{st.kind}</span>
                                {st.evidenceIds?.length > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                    {st.evidenceIds.length} citação(ões)
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#f1f5f9', lineHeight: 1.4 }}>{st.text}</div>
                              {st.limitations?.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--neon-rose)', fontStyle: 'italic' }}>
                                  Ressalva: {st.limitations.join(' ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {hermesResult.suggestedActions?.length > 0 && (
                          <div style={{ marginTop: '10px', fontSize: '0.72rem' }}>
                            <strong style={{ color: 'var(--neon-cyan)' }}>Ações Investigativas Sugeridas:</strong>
                            <ul style={{ paddingLeft: '16px', marginTop: '4px', color: 'var(--text-muted)' }}>
                              {hermesResult.suggestedActions.map((act: string, aIdx: number) => (
                                <li key={aIdx}>{act}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>
                  Selecione um nó ou linha do universo para auditar as evidências.
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
