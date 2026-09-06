import { useState, useEffect } from 'react';
import { Search, ShieldAlert, FileText, Database, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CytoscapeGraph } from './components/CytoscapeGraph.tsx';

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
  evidences: EvidenceItem[];
}

interface GraphData {
  rootEntity: {
    id: string;
    canonical_name: string;
    entity_type: string;
  };
  nodes: Array<{
    id: string;
    canonical_name: string;
    entity_type: string;
    isRoot: boolean;
  }>;
  relationships: RelationshipItem[];
}

export function App() {
  const [searchQuery, setSearchQuery] = useState('33.923.798/0001-00');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('50000000-0000-0000-0000-000000000001'); // Banco Master
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carregar entidade e grafo ao selecionar entidade
  useEffect(() => {
    if (!selectedEntityId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      fetch(`/api/entities/${selectedEntityId}`).then(r => {
        if (!r.ok) throw new Error('Falha ao carregar entidade');
        return r.json();
      }),
      fetch(`/api/entities/${selectedEntityId}/graph`).then(r => {
        if (!r.ok) throw new Error('Falha ao carregar grafo');
        return r.json();
      })
    ])
      .then(([entity, graph]) => {
        if (!isMounted) return;
        setEntityDetail(entity);
        setGraphData(graph);
        if (graph.relationships && graph.relationships.length > 0) {
          setSelectedRelId(graph.relationships[0].id);
        } else {
          setSelectedRelId(null);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.error(err);
        setErrorMsg(err.message || 'Erro ao conectar com API');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedEntityId]);

  // Função de busca
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
      } else {
        setErrorMsg('Nenhuma entidade encontrada para a consulta.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao pesquisar');
    } finally {
      setLoading(false);
    }
  };

  // Nós e arestas para o componente Cytoscape
  const cyNodes = graphData?.nodes.map(n => ({
    id: n.id,
    label: n.canonical_name,
    type: n.entity_type
  })) || [];

  const cyEdges = graphData?.relationships.map(r => ({
    id: r.id,
    source: r.subjectEntityId,
    target: r.objectEntityId,
    label: r.predicate.replace(/_/g, ' '),
    status: r.verificationStatus
  })) || [];

  const activeRelation = graphData?.relationships.find(r => r.id === selectedRelId);

  return (
    <div className="app-container">
      {/* Banner de Proveniência e Auditoria */}
      <div className="demo-disclaimer-banner">
        <ShieldAlert size={16} />
        <span>
          <strong>Proveniência da Coleta:</strong> Acervo Petição 16.662 / STF divulgado por Poder360.
          Autenticidade oficial perante autos originais permanece <em>pendente de validação primária</em>.
        </span>
      </div>

      <header className="app-header">
        <div className="logo-area">
          <h1>Public Intelligence Graph Brasil</h1>
          <span className="logo-tag">M1 DOCKER LIVE</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>Unidade Fundamental: <strong>Entidade → Relação → Evidência → Documento</strong></span>
        </div>
      </header>

      {/* Barra de Pesquisa */}
      <div className="search-container">
        <form className="search-input-group" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por razão social, nome ou CNPJ (ex: 33.923.798/0001-00 ou Banco Master)..."
          />
          <button type="submit" className="search-btn" disabled={loading}>
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
            <span>Consultar</span>
          </button>
        </form>

        {searchResults.length > 1 && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Resultados:</span>
            {searchResults.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedEntityId(r.id)}
                style={{
                  background: r.id === selectedEntityId ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: r.id === selectedEntityId ? '#fff' : 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {r.canonical_name}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cada conexão aponta para sua fonte e página correspondente no PDF original.</span>
          <span>Fonte do banco: <strong>PostgreSQL Dedicado (pig_br_db)</strong></span>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', margin: '0 24px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Espaço Principal de Trabalho */}
      <main className="workspace-grid">
        <div className="main-column">
          {/* Card da Entidade Principal */}
          {entityDetail && (
            <section className="card-section entity-header">
              <h2>{entityDetail.canonical_name}</h2>
              <div className="entity-badges">
                <span className="badge-id" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                  TIPO: <strong>{entityDetail.entity_type}</strong>
                </span>
                {entityDetail.identifiers && entityDetail.identifiers.map((ident: Identifier, i: number) => (
                  <span key={i} className="badge-id">
                    {ident.scheme}: <strong>{ident.normalized_value}</strong>
                  </span>
                ))}
                <span className="badge-id" style={{ color: '#1e5e3a' }}>
                  JURISDIÇÃO: {entityDetail.jurisdiction}
                </span>
              </div>

              {entityDetail.facts && entityDetail.facts.length > 0 && (
                <div className="facts-grid">
                  {entityDetail.facts.map((fact: Fact, idx: number) => (
                    <div key={idx} className="fact-box">
                      <div className="fact-key">{fact.field_name.replace(/_/g, ' ')}</div>
                      <div className="fact-val">{fact.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Grafo de Relações de 1 Salto */}
          <section className="card-section">
            <div className="card-title">
              <span>Grafo de Relações Documentadas (1 Salto)</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {cyNodes.length} entidades • {cyEdges.length} relações auditadas
              </span>
            </div>
            {cyNodes.length > 0 ? (
              <CytoscapeGraph
                nodes={cyNodes}
                edges={cyEdges}
                selectedEdgeId={selectedRelId}
                onSelectEdge={id => setSelectedRelId(id)}
                onSelectNode={id => {
                  if (id !== selectedEntityId) setSelectedEntityId(id);
                }}
              />
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma relação encontrada para esta entidade.
              </div>
            )}
          </section>

          {/* Lista Textual Equivalente de Relações */}
          <section className="card-section">
            <div className="card-title">
              <span>Relações em Lista Textual Acessível</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {graphData?.relationships?.length || 0} relações encontradas
              </span>
            </div>
            <div className="relationship-list">
              {graphData?.relationships?.map((rel: RelationshipItem) => (
                <div
                  key={rel.id}
                  className={`rel-item ${rel.id === selectedRelId ? 'active' : ''}`}
                  onClick={() => setSelectedRelId(rel.id)}
                >
                  <div className="rel-meta">
                    <span className="rel-predicate">{rel.predicate.replace(/_/g, ' ')}</span>
                    <span className="rel-target">
                      {rel.subjectEntityId === selectedEntityId ? rel.objectName : rel.subjectName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="rel-badge badge-verified">
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {rel.verificationStatus}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {rel.evidences.length} evidência(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Coluna Lateral: Painel de Evidências */}
        <aside className="evidence-panel">
          <section className="card-section" style={{ position: 'sticky', top: '24px' }}>
            <div className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--accent)" />
                <span>Painel de Evidências</span>
              </div>
            </div>

            {activeRelation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Relação selecionada: <strong>{activeRelation.predicate.replace(/_/g, ' ')}</strong>
                </div>

                {activeRelation.evidences.map((ev: EvidenceItem, idx: number) => (
                  <div key={idx} className="evidence-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`evidence-role-tag role-${ev.role}`}>
                        PAPEL: {ev.role}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                        {ev.locator.page ? `Página ${ev.locator.page}` : 'Página N/D'}
                      </span>
                    </div>

                    <blockquote className="evidence-quote">
                      “{ev.excerpt}”
                    </blockquote>

                    <div className="evidence-meta" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Documento:</strong> {ev.document.title}</div>
                      <div><strong>Seção / Localizador:</strong> {ev.locator.section || 'Preâmbulo'}</div>
                      <div><strong>Fonte Coleta:</strong> {ev.source.name}</div>
                      <div>
                        <strong>Oficialidade da Fonte:</strong>{' '}
                        {ev.source.official ? (
                          <span style={{ color: '#15803d' }}>Órgão Oficial</span>
                        ) : (
                          <span style={{ color: '#b45309' }}>Acervo / Divulgação Pública (Validação pendente)</span>
                        )}
                      </div>
                      <div className="evidence-hash">
                        SHA-256: {ev.artifact.sha256}
                      </div>

                      {/* Botão de Abertura do PDF com hash e página */}
                      <div style={{ marginTop: '10px' }}>
                        <a
                          href={`/api/artifacts/${ev.artifact.id}/raw#page=${ev.locator.page || 1}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="search-btn"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                            fontSize: '0.8rem',
                            padding: '6px 12px',
                            background: '#1e293b'
                          }}
                        >
                          <ExternalLink size={14} />
                          <span>Abrir PDF Original (Pág. {ev.locator.page || 1})</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Selecione uma aresta no grafo ou uma relação na lista para inspecionar os trechos de evidência e abrir o documento original.
              </div>
            )}

            {/* Situação da Fonte Primária */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                <Database size={14} />
                <span>SITUAÇÃO DO ACERVO</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                <div>Base Local: <strong style={{ color: 'var(--verified-badge)' }}>PostgreSQL 17 (pig_br)</strong></div>
                <div>Extração OCR: <strong style={{ color: 'var(--accent)' }}>Tesseract 5.5.0 Integrado</strong></div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
                  5 documentos indexados com hashes SHA-256 preservados e verificáveis.
                </div>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
