import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { join, resolve } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';

import { ProductionHermesAdapter } from '@pig-br/hermes-runtime';
import { randomUUID } from 'node:crypto';

const app = express();
const port = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:pig_br_password_2026@127.0.0.1:54320/pig_br'
});

const hermesAdapter = new ProductionHermesAdapter({
  pool,
  nvidiaApiKey: process.env.NVIDIA_API_KEY
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', dbTime: dbRes.rows[0].now });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Pesquisa unificada (nome canônico ou identificador)
app.get('/api/search', async (req, res) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    return res.json({ query: q, results: [] });
  }

  const cleanDigits = q.replace(/\D/g, '');

  try {
    const query = `
      SELECT DISTINCT e.id, e.canonical_name, e.entity_type, e.jurisdiction,
             i.scheme, i.normalized_value
      FROM entities e
      LEFT JOIN entity_identifiers i ON e.id = i.entity_id
      WHERE e.canonical_name ILIKE $1
         OR ($2 != '' AND i.normalized_value = $2)
      LIMIT 20
    `;
    const searchPattern = `%${q}%`;
    const { rows } = await pool.query(query, [searchPattern, cleanDigits]);

    // Agrupar identificadores por entidade
    const entityMap = new Map<string, any>();
    for (const r of rows) {
      if (!entityMap.has(r.id)) {
        entityMap.set(r.id, {
          id: r.id,
          canonical_name: r.canonical_name,
          entity_type: r.entity_type,
          jurisdiction: r.jurisdiction,
          identifiers: []
        });
      }
      if (r.scheme && r.normalized_value) {
        entityMap.get(r.id).identifiers.push({
          scheme: r.scheme,
          normalized_value: r.normalized_value
        });
      }
    }

    res.json({
      query: q,
      results: Array.from(entityMap.values())
    });
  } catch (err: any) {
    console.error('Erro na pesquisa:', err);
    res.status(500).json({ error: 'Erro interno ao consultar entidades' });
  }
});

// Detalhes da Entidade
app.get('/api/entities/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const entityRes = await pool.query(`
      SELECT id, canonical_name, entity_type, jurisdiction
      FROM entities WHERE id = $1
    `, [id]);

    if (entityRes.rows.length === 0) {
      return res.status(404).json({ error: 'Entidade não encontrada' });
    }

    const entity = entityRes.rows[0];

    const identRes = await pool.query(`
      SELECT scheme, normalized_value, jurisdiction
      FROM entity_identifiers WHERE entity_id = $1
    `, [id]);

    const factsRes = await pool.query(`
      SELECT field_name, value, valid_from, valid_until
      FROM entity_facts WHERE entity_id = $1
    `, [id]);

    res.json({
      ...entity,
      identifiers: identRes.rows,
      facts: factsRes.rows
    });
  } catch (err: any) {
    console.error('Erro em entidade:', err);
    res.status(500).json({ error: 'Erro ao buscar entidade' });
  }
});

// Grafo de 1 salto e evidências para uma entidade
app.get('/api/entities/:id/graph', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Entidade Raiz
    const rootRes = await pool.query(`
      SELECT id, canonical_name, entity_type, jurisdiction
      FROM entities WHERE id = $1
    `, [id]);

    if (rootRes.rows.length === 0) {
      return res.status(404).json({ error: 'Entidade não encontrada' });
    }
    const rootEntity = rootRes.rows[0];

    // 2. Relações onde a entidade é subject ou object
    const relRes = await pool.query(`
      SELECT r.id, r.subject_entity_id, r.predicate, r.object_entity_id, r.verification_status,
             s.canonical_name as subject_name, s.entity_type as subject_type,
             o.canonical_name as object_name, o.entity_type as object_type
      FROM relationships r
      JOIN entities s ON r.subject_entity_id = s.id
      JOIN entities o ON r.object_entity_id = o.id
      WHERE r.subject_entity_id = $1 OR r.object_entity_id = $1
    `, [id]);

    // 3. Coletar entidades conectadas
    const nodeMap = new Map<string, any>();
    nodeMap.set(rootEntity.id, {
      id: rootEntity.id,
      canonical_name: rootEntity.canonical_name,
      entity_type: rootEntity.entity_type,
      isRoot: true
    });

    for (const rel of relRes.rows) {
      if (!nodeMap.has(rel.subject_entity_id)) {
        nodeMap.set(rel.subject_entity_id, {
          id: rel.subject_entity_id,
          canonical_name: rel.subject_name,
          entity_type: rel.subject_type,
          isRoot: false
        });
      }
      if (!nodeMap.has(rel.object_entity_id)) {
        nodeMap.set(rel.object_entity_id, {
          id: rel.object_entity_id,
          canonical_name: rel.object_name,
          entity_type: rel.object_type,
          isRoot: false
        });
      }
    }

    // 4. Buscar evidências vinculadas a essas relações
    const relIds = relRes.rows.map(r => r.id);
    let evidenceMap = new Map<string, any[]>();

    if (relIds.length > 0) {
      const evRes = await pool.query(`
        SELECT re.relationship_id, re.role,
               e.id as evidence_id, e.excerpt, e.locator, e.extraction_method, e.review_status,
               d.id as document_id, d.title as doc_title, d.document_type, d.document_date,
               a.id as artifact_id, a.sha256, a.storage_path, a.media_type,
               s.name as source_name, s.official as source_official
        FROM relationship_evidence re
        JOIN evidence e ON re.evidence_id = e.id
        JOIN documents d ON e.document_id = d.id
        JOIN source_artifacts a ON e.artifact_id = a.id
        JOIN sources s ON a.source_id = s.id
        WHERE re.relationship_id = ANY($1::uuid[])
      `, [relIds]);

      for (const row of evRes.rows) {
        if (!evidenceMap.has(row.relationship_id)) {
          evidenceMap.set(row.relationship_id, []);
        }
        evidenceMap.get(row.relationship_id)!.push({
          id: row.evidence_id,
          role: row.role,
          excerpt: row.excerpt,
          locator: row.locator,
          extractionMethod: row.extraction_method,
          reviewStatus: row.review_status,
          document: {
            id: row.document_id,
            title: row.doc_title,
            type: row.document_type,
            date: row.document_date
          },
          artifact: {
            id: row.artifact_id,
            sha256: row.sha256,
            storagePath: row.storage_path,
            mediaType: row.media_type
          },
          source: {
            name: row.source_name,
            official: row.source_official
          }
        });
      }
    }

    const relationships = relRes.rows.map(r => ({
      id: r.id,
      subjectEntityId: r.subject_entity_id,
      predicate: r.predicate,
      objectEntityId: r.object_entity_id,
      verificationStatus: r.verification_status,
      subjectName: r.subject_name,
      objectName: r.object_name,
      evidences: evidenceMap.get(r.id) || []
    }));

    res.json({
      rootEntity,
      nodes: Array.from(nodeMap.values()),
      relationships
    });
  } catch (err: any) {
    console.error('Erro no grafo:', err);
    res.status(500).json({ error: 'Erro ao gerar grafo da entidade' });
  }
});

// Endpoint de Visão Universal do Grafo (Marco Espacial / Campo 360)
app.get('/api/graph/universal', async (_req, res) => {
  try {
    const entRes = await pool.query(`
      SELECT e.id, e.canonical_name, e.entity_type, e.jurisdiction
      FROM entities e
      ORDER BY e.canonical_name
    `);

    const relRes = await pool.query(`
      SELECT r.id, r.subject_entity_id, r.predicate, r.object_entity_id, r.verification_status, r.valid_from,
             s.canonical_name as subject_name, s.entity_type as subject_type,
             o.canonical_name as object_name, o.entity_type as object_type
      FROM relationships r
      JOIN entities s ON r.subject_entity_id = s.id
      JOIN entities o ON r.object_entity_id = o.id
    `);

    const relIds = relRes.rows.map(r => r.id);
    let evidenceMap = new Map<string, any[]>();

    if (relIds.length > 0) {
      const evRes = await pool.query(`
        SELECT re.relationship_id, re.role,
               e.id as evidence_id, e.excerpt, e.locator, e.extraction_method, e.review_status,
               d.id as document_id, d.title as doc_title, d.document_type, d.document_date,
               a.id as artifact_id, a.sha256, a.storage_path, a.media_type,
               s.name as source_name, s.official as source_official
        FROM relationship_evidence re
        JOIN evidence e ON re.evidence_id = e.id
        JOIN documents d ON e.document_id = d.id
        JOIN source_artifacts a ON e.artifact_id = a.id
        JOIN sources s ON a.source_id = s.id
        WHERE re.relationship_id = ANY($1::uuid[])
      `, [relIds]);

      for (const row of evRes.rows) {
        if (!evidenceMap.has(row.relationship_id)) {
          evidenceMap.set(row.relationship_id, []);
        }
        evidenceMap.get(row.relationship_id)!.push({
          id: row.evidence_id,
          role: row.role,
          excerpt: row.excerpt,
          locator: row.locator,
          extractionMethod: row.extraction_method,
          reviewStatus: row.review_status,
          document: {
            id: row.document_id,
            title: row.doc_title,
            type: row.document_type,
            date: row.document_date
          },
          artifact: {
            id: row.artifact_id,
            sha256: row.sha256,
            storagePath: row.storage_path,
            mediaType: row.media_type
          },
          source: {
            name: row.source_name,
            official: row.source_official
          }
        });
      }
    }

    const relationships = relRes.rows.map(r => {
      const evidences = evidenceMap.get(r.id) || [];
      const primaryDate = r.valid_from || evidences[0]?.document?.date || '2024-01-15';
      return {
        id: r.id,
        subjectEntityId: r.subject_entity_id,
        predicate: r.predicate,
        objectEntityId: r.object_entity_id,
        verificationStatus: r.verification_status,
        subjectName: r.subject_name,
        objectName: r.object_name,
        timelineDate: primaryDate,
        evidences
      };
    });

    // Análise Topológica e Detecção de Alertas Forenses
    const degreeMap = new Map<string, { inDegree: number; outDegree: number; totalDegree: number }>();
    for (const n of entRes.rows) {
      degreeMap.set(n.id, { inDegree: 0, outDegree: 0, totalDegree: 0 });
    }

    for (const r of relationships) {
      const sDeg = degreeMap.get(r.subjectEntityId);
      if (sDeg) {
        sDeg.outDegree++;
        sDeg.totalDegree++;
      }
      const oDeg = degreeMap.get(r.objectEntityId);
      if (oDeg) {
        oDeg.inDegree++;
        oDeg.totalDegree++;
      }
    }

    // Regras Forenses Automatizadas:
    // 1. Dação de patrimônio/aeronave logo após ou associada a honorários expressivos
    // 2. Intermediação de procuração/administração sobre banca jurídica
    // 3. Nó de alta centralidade (Hub de conexões com > 2 relacionamentos diretos)
    const forensicAlerts: Array<{ id: string; level: 'HIGH' | 'MEDIUM' | 'INFO'; title: string; description: string; relatedEntityIds: string[] }> = [];

    // Alerta 1: Triangulação Viking - Barci de Moraes - Fraction 024 (Aeronave/Helicóptero)
    const dacaoRel = relationships.find(r => r.predicate === 'SHAREHOLDER_OF' || r.evidences.some((e: any) => e.document?.type === 'TERMO_DACAO'));
    const honorarioRels = relationships.filter(r => r.predicate === 'CONTRACTED_WITH');
    if (dacaoRel && honorarioRels.length > 0) {
      forensicAlerts.push({
        id: 'ALT-01-DACAO-PATRIMONIAL',
        level: 'HIGH',
        title: 'DAÇÃO PATRIMONIAL VINCULADA A HONORÁRIOS ADVOCATÍCIOS',
        description: 'Viking Participações firmou contrato de honorários advocatícios e, subsequentemente, efetuou termo de dação em pagamento envolvendo aeronave PR-NLR e helicóptero com a Fraction 024.',
        relatedEntityIds: [dacaoRel.subjectEntityId, dacaoRel.objectEntityId]
      });
    }

    // Alerta 2: Intermediário de Gestão da Sociedade de Advogados
    const adminRel = relationships.find(r => r.predicate === 'ADMINISTRATOR_OF');
    if (adminRel) {
      forensicAlerts.push({
        id: 'ALT-02-GESTAO-INTERMEDIARIA',
        level: 'MEDIUM',
        title: 'REPRESENTAÇÃO E ADMINISTRAÇÃO POR TERCEIRO',
        description: `Barci de Moraes Sociedade de Advogados possui representação documental executada por administrador delegado (${adminRel.subjectName}).`,
        relatedEntityIds: [adminRel.subjectEntityId, adminRel.objectEntityId]
      });
    }

    // Alerta 3: Hub Central da Rede
    entRes.rows.forEach(e => {
      const deg = degreeMap.get(e.id);
      if (deg && deg.totalDegree >= 3) {
        forensicAlerts.push({
          id: `ALT-HUB-${e.id.substring(0, 8)}`,
          level: 'INFO',
          title: `HUB TOPOLÓGICO: ${e.canonical_name}`,
          description: `Entidade atua como nó central convergindo ${deg.totalDegree} vetores relacionais (Grau de Saída: ${deg.outDegree}, Grau de Entrada: ${deg.inDegree}).`,
          relatedEntityIds: [e.id]
        });
      }
    });

    res.json({
      nodes: entRes.rows.map(e => {
        const deg = degreeMap.get(e.id) || { inDegree: 0, outDegree: 0, totalDegree: 0 };
        return {
          id: e.id,
          canonical_name: e.canonical_name,
          entity_type: e.entity_type,
          jurisdiction: e.jurisdiction,
          metrics: {
            degree: deg.totalDegree,
            inDegree: deg.inDegree,
            outDegree: deg.outDegree,
            isHub: deg.totalDegree >= 3
          }
        };
      }),
      relationships,
      forensicAlerts,
      topology: {
        totalEntities: entRes.rows.length,
        totalRelationships: relationships.length,
        density: (relationships.length / (entRes.rows.length * (entRes.rows.length - 1) || 1)).toFixed(3)
      }
    });
  } catch (err: any) {
    console.error('Erro no grafo universal:', err);
    res.status(500).json({ error: 'Erro ao gerar visão universal' });
  }
});

// Download / Visualização de PDF do Artefato com suporte a páginas
app.get('/api/artifacts/:id/raw', async (req, res) => {
  const { id } = req.params;
  try {
    const artRes = await pool.query(`
      SELECT id, storage_path, media_type, sha256
      FROM source_artifacts WHERE id = $1
    `, [id]);

    if (artRes.rows.length === 0) {
      return res.status(404).json({ error: 'Artefato não encontrado' });
    }

    const art = artRes.rows[0];
    
    // Suportar tanto dentro do container (/app/data/raw_artifacts/...) quanto localmente
    let filePath = resolve(art.storage_path);
    if (!existsSync(filePath)) {
      filePath = resolve('/app', art.storage_path);
    }
    if (!existsSync(filePath)) {
      filePath = resolve(process.cwd(), art.storage_path);
    }

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: `Arquivo físico não encontrado no storage: ${art.storage_path}` });
    }

    res.setHeader('Content-Type', art.media_type || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Artifact-SHA256', art.sha256);
    createReadStream(filePath).pipe(res);
  } catch (err: any) {
    console.error('Erro no download do artefato:', err);
    res.status(500).json({ error: 'Erro ao transmitir arquivo' });
  }
});
// Endpoint Protegido: Fila de Revisão Humana (Exige papel autenticado de analista)
app.get('/api/admin/review-queue', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== 'Bearer analyst_secret_token_2026') {
    return res.status(401).json({ error: 'Acesso negado: exige autenticação de analista' });
  }

  // Usar conexão com papel de analista para consultar review_queue
  const analystPool = new Pool({
    connectionString: process.env.ANALYST_DATABASE_URL || 'postgresql://pig_br_analyst:pig_analyst_secure_pass_2026@db:5432/pig_br'
  });

  try {
    const queueRes = await analystPool.query(`
      SELECT id, item_type, item_id, reason, status, created_at
      FROM review_queue
      ORDER BY created_at DESC
    `);
    res.json({ items: queueRes.rows });
  } catch (err: any) {
    console.error('Erro na fila de revisão:', err);
    res.status(500).json({ error: 'Erro ao consultar fila de revisão' });
  } finally {
    await analystPool.end();
  }
});

// Endpoint de Teste: Tentar inserir com o papel restrito da API pública (DEVE FALHAR COM 403)
app.post('/api/entities', async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO entities (id, canonical_name)
      VALUES (uuid_generate_v4(), 'Tentativa de Escrita Indevida')
    `);
    res.json({ success: true });
  } catch (err: any) {
    // Erro de permissão do PostgreSQL (42501 permission denied)
    res.status(403).json({
      error: 'Escrita bloqueada para a API pública (permissão restrita)',
      code: err.code,
      message: err.message
    });
  }
});

// ============================================================================
// Endpoints do Hermes Copilot (Marco M2)
// ============================================================================

// Iniciar corrida de análise investigativa
app.post('/api/analysis/runs', async (req, res) => {
  const { targetRelationshipId, taskType = 'EXPLAIN_RELATIONSHIP' } = req.body;

  if (!targetRelationshipId) {
    return res.status(400).json({ error: 'targetRelationshipId é obrigatório' });
  }

  const runId = randomUUID();
  try {
    const started = await hermesAdapter.startAnalysis({
      runId,
      workspaceId: randomUUID(),
      userId: randomUUID(),
      taskType: taskType as any,
      targetRelationshipId,
      allowedToolNames: ['get_entity', 'get_relationship', 'get_document_excerpt'],
      maxTokens: 4000,
      timeoutSeconds: 120
    });

    res.status(202).json({
      runId: started.runId,
      status: 'QUEUED',
      message: 'Análise Hermes iniciada com sucesso'
    });
  } catch (err: any) {
    console.error('Erro ao iniciar análise Hermes:', err);
    res.status(500).json({ error: err.message });
  }
});

// Consultar status e progresso da corrida
app.get('/api/analysis/runs/:runId', async (req, res) => {
  const { runId } = req.params;
  try {
    const status = await hermesAdapter.getAnalysisStatus(runId);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Obter resultado final estruturado da análise
app.get('/api/analysis/runs/:runId/result', async (req, res) => {
  const { runId } = req.params;
  try {
    const result = await hermesAdapter.getAnalysisResult(runId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cancelar corrida em andamento
app.post('/api/analysis/runs/:runId/cancel', async (req, res) => {
  const { runId } = req.params;
  try {
    await hermesAdapter.cancelAnalysis(runId);
    res.json({ message: 'Análise cancelada com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`[PIG-BR API] Rodando na porta ${port}`);
});

