import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { ProductionHermesAdapter } from '../services/hermes-runtime/src/hermes_adapter';
import { HermesAnalysisOutputSchema } from '../packages/contracts/src/index';

const testDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:pig_br_password_2026@127.0.0.1:54320/pig_br';

describe('Marco M2: Hermes Runtime Adapter & Truth in Data', () => {
  let pool: Pool;
  let adapter: ProductionHermesAdapter;
  let testRelId: string;

  before(async () => {
    pool = new Pool({ connectionString: testDbUrl });
    adapter = new ProductionHermesAdapter({
      pool,
      nvidiaApiKey: process.env.NVIDIA_API_KEY
    });

    // Obter uma relação existente do banco
    const relRes = await pool.query(`SELECT id FROM relationships LIMIT 1`);
    assert.ok(relRes.rows.length > 0, 'Deve haver ao menos uma relação no banco');
    testRelId = relRes.rows[0].id;
  });

  after(async () => {
    await pool.end();
  });

  it('1. Inicia corrida de análise e retorna status QUEUED ou RUNNING', async () => {
    const runId = '99999999-9999-4999-a999-999999999991';
    const started = await adapter.startAnalysis({
      runId,
      workspaceId: '11111111-1111-4111-a111-111111111111',
      userId: '22222222-2222-4222-a222-222222222222',
      taskType: 'EXPLAIN_RELATIONSHIP',
      targetRelationshipId: testRelId,
      allowedToolNames: ['get_entity', 'get_relationship', 'get_document_excerpt'],
      maxTokens: 4000,
      timeoutSeconds: 120
    });

    assert.equal(started.runId, runId);

    const status = await adapter.getAnalysisStatus(runId);
    assert.ok(['QUEUED', 'RUNNING', 'SUCCEEDED'].includes(status.status));
  });

  it('2. Processa a análise com ferramentas de domínio e entrega resultado em conformidade com schema Zod', async () => {
    const runId = '99999999-9999-4999-a999-999999999992';
    await adapter.startAnalysis({
      runId,
      workspaceId: '11111111-1111-4111-a111-111111111111',
      userId: '22222222-2222-4222-a222-222222222222',
      taskType: 'EXPLAIN_RELATIONSHIP',
      targetRelationshipId: testRelId,
      allowedToolNames: ['get_entity', 'get_relationship', 'get_document_excerpt'],
      maxTokens: 4000,
      timeoutSeconds: 120
    });

    // Aguardar conclusão da corrida
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const status = await adapter.getAnalysisStatus(runId);
      if (status.status === 'SUCCEEDED') break;
      if (status.status === 'FAILED') {
        assert.fail(`A análise falhou: ${status.currentStepDescription}`);
      }
      attempts++;
    }

    const result = await adapter.getAnalysisResult(runId);
    assert.ok(result, 'Resultado da análise deve existir');

    // Validar estritamente contra o Zod Schema
    const validated = HermesAnalysisOutputSchema.parse(result);
    assert.ok(validated.statements.length > 0, 'Deve conter statements');

    // Verificar que existe distinção entre fatos documentados e limitações
    const kinds = new Set(validated.statements.map(s => s.kind));
    assert.ok(kinds.has('DOCUMENTED_RECORD'), 'Deve conter DOCUMENTED_RECORD');

    const docRecords = validated.statements.filter(s => s.kind === 'DOCUMENTED_RECORD');
    for (const dr of docRecords) {
      assert.ok(dr.evidenceIds.length > 0, 'Fatos documentados devem conter evidências citadas');
    }
  });

  it('3. Permite cancelamento limpo de corrida em andamento', async () => {
    const runId = '99999999-9999-4999-a999-999999999993';
    await adapter.startAnalysis({
      runId,
      workspaceId: '11111111-1111-4111-a111-111111111111',
      userId: '22222222-2222-4222-a222-222222222222',
      taskType: 'EXPLAIN_RELATIONSHIP',
      targetRelationshipId: testRelId,
      allowedToolNames: ['get_entity', 'get_relationship', 'get_document_excerpt'],
      maxTokens: 4000,
      timeoutSeconds: 120
    });

    await adapter.cancelAnalysis(runId);
    const status = await adapter.getAnalysisStatus(runId);
    assert.equal(status.status, 'CANCELLED');
  });
});
