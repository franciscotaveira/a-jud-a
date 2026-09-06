import { useState } from 'react';
import { Search, ShieldAlert, FileText, Database } from 'lucide-react';
import { CytoscapeGraph } from './components/CytoscapeGraph.tsx';
import { fixtureData, type Fact, type Identifier, type RelationFixture, type EvidenceFixture } from './demoData.ts';

export function App() {
  const [searchQuery, setSearchQuery] = useState('33.923.798/0001-00');
  const [selectedRelId, setSelectedRelId] = useState<string | null>('rel-00000000-0000-0000-0000-000000000001');

  // Nós e arestas do grafo baseados na fixture
  const nodes = [
    {
      id: fixtureData.entidade.id,
      label: 'Banco Master S.A. (Fictício)',
      type: fixtureData.entidade.entity_type
    },
    ...fixtureData.relacionadas.map(r => ({
      id: r.id,
      label: r.canonical_name,
      type: r.entity_type
    }))
  ];

  const edges = fixtureData.relacoes.map(r => ({
    id: r.id,
    source: r.subject_entity_id,
    target: r.object_entity_id,
    label: r.predicate.replace('_', ' '),
    status: r.verification_status
  }));

  const activeRelation = fixtureData.relacoes.find(r => r.id === selectedRelId);

  return (
    <div className="app-container">
      {/* Banner Legal Permanente de Demonstração */}
      <div className="demo-disclaimer-banner">
        <ShieldAlert size={16} />
        <span>{fixtureData.aviso_legal} Ambiente de homologação do Marco M1 com dados demonstráveis e evidências auditáveis.</span>
      </div>

      <header className="app-header">
        <div className="logo-area">
          <h1>Public Intelligence Graph Brasil</h1>
          <span className="logo-tag">MVP M1</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>Unidade: <strong>Entidade → Relação → Evidência</strong></span>
        </div>
      </header>

      {/* Barra de Pesquisa */}
      <div className="search-container">
        <div className="search-input-group">
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Pesquisar empresa ou CNPJ..."
          />
          <button className="search-btn">
            <Search size={18} />
            <span>Consultar</span>
          </button>
        </div>
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Cada conexão aponta para sua fonte primária verificável.</span>
          <span>Fonte ativa: <strong>Demonstração Auditável</strong></span>
        </div>
      </div>

      {/* Espaço Principal de Trabalho */}
      <main className="workspace-grid">
        <div className="main-column">
          {/* Card da Entidade Principal */}
          <section className="card-section entity-header">
            <h2>{fixtureData.entidade.canonical_name}</h2>
            <div className="entity-badges">
              {fixtureData.entidade.identifiers.map((ident: Identifier, i: number) => (
                <span key={i} className="badge-id">
                  {ident.scheme}: <strong>{ident.normalized_value}</strong>
                </span>
              ))}
              <span className="badge-id" style={{ color: '#1e5e3a' }}>
                JURISDIÇÃO: {fixtureData.entidade.jurisdiction}
              </span>
            </div>

            {/* Fatos Canônicos com Evidência */}
            <div className="facts-grid">
              {fixtureData.entidade.facts.map((fact: Fact, idx: number) => (
                <div key={idx} className="fact-box">
                  <div className="fact-key">{fact.field_name.replace('_', ' ')}</div>
                  <div className="fact-val">{fact.value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Grafo de Relações de 1 Salto */}
          <section className="card-section">
            <div className="card-title">
              <span>Grafo de Relações Documentadas (1 Salto)</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Cytoscape.js interativo
              </span>
            </div>
            <CytoscapeGraph
              nodes={nodes}
              edges={edges}
              selectedEdgeId={selectedRelId}
              onSelectEdge={id => setSelectedRelId(id)}
              onSelectNode={() => {}}
            />
          </section>

          {/* Lista Textual Equivalente de Relações */}
          <section className="card-section">
            <div className="card-title">
              <span>Relações em Lista Textual Acessível</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {edges.length} relação encontrada
              </span>
            </div>
            <div className="relationship-list">
              {fixtureData.relacoes.map((rel: RelationFixture) => (
                <div
                  key={rel.id}
                  className={`rel-item ${rel.id === selectedRelId ? 'active' : ''}`}
                  onClick={() => setSelectedRelId(rel.id)}
                >
                  <div className="rel-meta">
                    <span className="rel-predicate">{rel.predicate.replace('_', ' ')}</span>
                    <span className="rel-target">Fulano de Tal (Fictício)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="rel-badge badge-verified">
                      {rel.verification_status}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {rel.evidencias.length} evidências
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cronologia Documental */}
          <section className="card-section">
            <div className="card-title">
              <span>Cronologia de Eventos Documentados</span>
            </div>
            <div className="timeline-list">
              <div className="timeline-item">
                <div className="timeline-date">15 de Janeiro de 2026</div>
                <div className="timeline-content">
                  Ata de Assembleia Geral Ordinária registra eleição de diretoria com mandato até 2027.
                </div>
              </div>
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
                  Relação selecionada: <strong>{activeRelation.predicate.replace('_', ' ')}</strong>
                </div>

                {activeRelation.evidencias.map((ev: EvidenceFixture, idx: number) => (
                  <div key={idx} className="evidence-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`evidence-role-tag role-${ev.role}`}>
                        PAPEL: {ev.role}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                        Página {ev.locator.page}
                      </span>
                    </div>

                    <blockquote className="evidence-quote">
                      “{ev.trecho}”
                    </blockquote>

                    <div className="evidence-meta">
                      <div><strong>Seção:</strong> {ev.locator.section}</div>
                      <div><strong>Fonte:</strong> Ata de Homologação M1 (Demo)</div>
                      <div className="evidence-hash">
                        SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Selecione uma aresta no grafo ou uma relação na lista para inspecionar os trechos de evidência correspondentes.
              </div>
            )}

            {/* Situação da Fonte Primária */}
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                <Database size={14} />
                <span>SITUAÇÃO DA CONSULTA</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                <div>Status da Execução: <strong style={{ color: 'var(--verified-badge)' }}>SUCCEEDED</strong></div>
                <div>Resultado: <strong style={{ color: 'var(--accent)' }}>FOUND</strong></div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '4px' }}>
                  Base primária oficial de homologação consultada em 06/09/2026 às 07:20 BRT.
                </div>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
