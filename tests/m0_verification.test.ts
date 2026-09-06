import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import {
  EntitySchema,
  RelationshipSchema,
  EvidenceSchema,
  SourceSchema,
  SourceArtifactSchema,
  DocumentSchema,
  HermesAnalysisOutputSchema,
  M0MockHermesAdapter
} from '@pig-br/contracts';
import {
  isValidCnpj,
  normalizeCnpj,
  normalizeEntityName,
  resolveIdentity
} from '@pig-br/domain';
import { calculateSha256, verifyExcerptIntegrity } from '@pig-br/evidence';

describe('Master Spec M0 — Homologação Rigorosa e Verificação de Integridade', () => {

  describe('1. Resolução Conservadora de Identidades e Caso de Regressão', () => {
    it('Caso de regressão obrigatório: CNPJ 00000000000000 NUNCA produz AUTO_MATCH', () => {
      const result = resolveIdentity({
        entityTypeA: 'ORGANIZATION',
        entityTypeB: 'ORGANIZATION',
        nameA: 'Empresa Fantasma A',
        nameB: 'Empresa Fantasma B',
        identifierA: { scheme: 'CNPJ', value: '00000000000000' },
        identifierB: { scheme: 'CNPJ', value: '00000000000000' }
      });

      assert.notEqual(result.decision, 'AUTO_MATCH');
      assert.equal(result.decision, 'MANUAL_REVIEW');
      assert.match(result.reason, /CNPJ inválido ou corrompido detectado/);
    });

    it('Pessoas físicas com nomes idênticos NUNCA sofrem fusão automática apenas por nome', () => {
      const result = resolveIdentity({
        entityTypeA: 'PERSON',
        entityTypeB: 'PERSON',
        nameA: 'João Carlos da Silva',
        nameB: 'JOAO CARLOS DA SILVA'
      });

      assert.equal(result.decision, 'MANUAL_REVIEW');
      assert.match(result.reason, /Homônimos em pessoas físicas exigem identificador/);
    });

    it('Tipos de entidade distintos e jurisdições diferentes geram NO_MATCH', () => {
      const diffType = resolveIdentity({
        entityTypeA: 'PERSON',
        entityTypeB: 'ORGANIZATION',
        nameA: 'Alfa',
        nameB: 'Alfa'
      });
      assert.equal(diffType.decision, 'NO_MATCH');

      const diffJur = resolveIdentity({
        entityTypeA: 'ORGANIZATION',
        entityTypeB: 'ORGANIZATION',
        nameA: 'Alfa',
        nameB: 'Alfa',
        jurisdictionA: 'BR',
        jurisdictionB: 'US'
      });
      assert.equal(diffJur.decision, 'NO_MATCH');
    });

    it('Organizações com CNPJs válidos correspondentes produzem AUTO_MATCH', () => {
      const result = resolveIdentity({
        entityTypeA: 'ORGANIZATION',
        entityTypeB: 'ORGANIZATION',
        nameA: 'Empresa Real A',
        nameB: 'Empresa Real A Matriz',
        identifierA: { scheme: 'CNPJ', value: '33.923.798/0001-00' },
        identifierB: { scheme: 'CNPJ', value: '33923798000100' }
      });
      assert.equal(result.decision, 'AUTO_MATCH');
    });
  });

  describe('2. Validação da Fixture Sintética Completa contra Contratos', () => {
    const fixtureRaw = readFileSync('fixtures/demo/synthetic_fixture.json', 'utf-8');
    const fixture = JSON.parse(fixtureRaw);

    it('Fixture não deve ter vínculo com Banco Master nem CNPJ real', () => {
      assert.ok(!fixture.nome.includes('Banco Master'));
      assert.equal(fixture.aviso_legal, 'Demonstração — dados sintéticos e fictícios. Sem relação com entidades reais.');
      assert.equal(fixture.fonte.sourceType, 'DEMO_SYNTHETIC');
    });

    it('Cadeia completa: Fonte -> Artefato -> Documento -> Evidência -> Entidades -> Relação', () => {
      assert.doesNotThrow(() => SourceSchema.parse(fixture.fonte));
      assert.doesNotThrow(() => SourceArtifactSchema.parse(fixture.artefato));
      assert.doesNotThrow(() => DocumentSchema.parse(fixture.documento));
      assert.doesNotThrow(() => EvidenceSchema.parse(fixture.evidencias[0]));
      assert.doesNotThrow(() => EntitySchema.parse(fixture.entidades[0]));
      assert.doesNotThrow(() => EntitySchema.parse(fixture.entidades[1]));
      assert.doesNotThrow(() => RelationshipSchema.parse({
        id: fixture.relacao.id,
        subjectEntityId: fixture.relacao.subjectEntityId,
        predicate: fixture.relacao.predicate,
        objectEntityId: fixture.relacao.objectEntityId,
        verificationStatus: fixture.relacao.verificationStatus
      }));
    });

    it('Hash SHA-256 e integridade literal do trecho conferem perfeitamente', () => {
      const calculatedHash = calculateSha256(fixture.artefato.rawText);
      assert.match(calculatedHash, /^[a-f0-9]{64}$/);

      const check = verifyExcerptIntegrity(fixture.artefato.rawText, fixture.evidencias[0].locator);
      assert.equal(check.valid, true);
      assert.equal(check.calculatedOffset, fixture.evidencias[0].locator.charOffset);
    });
  });

  describe('3. HermesAdapter M0 Contract Verification', () => {
    it('Deve orquestrar análise mock, respeitar schema estruturado e permitir cancelamento', async () => {
      const adapter = new M0MockHermesAdapter();
      const runId = '99999999-9999-9999-9999-999999999999';

      await adapter.startAnalysis({
        runId,
        workspaceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        taskType: 'EXPLAIN_RELATIONSHIP',
        allowedToolNames: ['get_entity', 'get_evidence']
      });

      const statusBefore = await adapter.getAnalysisStatus(runId);
      assert.equal(statusBefore.status, 'RUNNING');

      const result = await adapter.getAnalysisResult(runId);
      assert.doesNotThrow(() => HermesAnalysisOutputSchema.parse(result));

      await adapter.cancelAnalysis(runId);
      const statusAfter = await adapter.getAnalysisStatus(runId);
      assert.equal(statusAfter.status, 'CANCELLED');
    });
  });

  describe('4. Testes de Banco de Dados Local (PostgreSQL / Supabase)', () => {
    const executePsql = (sqlContent: string): { stdout: string; stderr: string; error?: any } => {
      const tmpFile = `/tmp/test_query_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`;
      writeFileSync(tmpFile, sqlContent);
      try {
        const stdout = execSync(
          `docker exec -i pig_br_db psql -U postgres -d pig_br_test -v ON_ERROR_STOP=1 < "${tmpFile}"`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        return { stdout, stderr: '' };
      } catch (err: any) {
        return {
          stdout: err.stdout?.toString() || '',
          stderr: err.stderr?.toString() || '',
          error: err
        };
      } finally {
        unlinkSync(tmpFile);
      }
    };

    it('Persistência da cadeia sintética completa no banco de dados', () => {
      const fixtureRaw = readFileSync('fixtures/demo/synthetic_fixture.json', 'utf-8');
      const fixture = JSON.parse(fixtureRaw);

      const insertSql = `
        BEGIN;
        INSERT INTO sources (id, name, organization, source_type, official, access_method, capabilities)
        VALUES ('${fixture.fonte.id}', '${fixture.fonte.name}', '${fixture.fonte.organization}', '${fixture.fonte.sourceType}', true, '${fixture.fonte.accessMethod}', '${JSON.stringify(fixture.fonte.capabilities)}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO source_artifacts (id, source_id, retrieved_at, media_type, sha256, storage_path, request_metadata)
        VALUES ('${fixture.artefato.id}', '${fixture.artefato.sourceId}', '${fixture.artefato.retrievedAt}', '${fixture.artefato.mediaType}', '${fixture.artefato.sha256}', '${fixture.artefato.storagePath}', '{}'::jsonb)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO documents (id, artifact_id, title, document_type, document_date, date_precision)
        VALUES ('${fixture.documento.id}', '${fixture.documento.artifactId}', '${fixture.documento.title}', '${fixture.documento.documentType}', '${fixture.documento.documentDate}', '${fixture.documento.datePrecision}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO evidence (id, artifact_id, document_id, excerpt, locator, extraction_method, review_status)
        VALUES ('${fixture.evidencias[0].id}', '${fixture.evidencias[0].artifactId}', '${fixture.evidencias[0].documentId}', '${fixture.evidencias[0].excerpt}', '${JSON.stringify(fixture.evidencias[0].locator)}'::jsonb, '${fixture.evidencias[0].extractionMethod}', '${fixture.evidencias[0].reviewStatus}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO entities (id, entity_type, canonical_name, jurisdiction)
        VALUES ('${fixture.entidades[0].id}', '${fixture.entidades[0].entityType}', '${fixture.entidades[0].canonicalName}', '${fixture.entidades[0].jurisdiction}'),
               ('${fixture.entidades[1].id}', '${fixture.entidades[1].entityType}', '${fixture.entidades[1].canonicalName}', '${fixture.entidades[1].jurisdiction}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationships (id, subject_entity_id, predicate, object_entity_id, verification_status)
        VALUES ('${fixture.relacao.id}', '${fixture.relacao.subjectEntityId}', '${fixture.relacao.predicate}', '${fixture.relacao.objectEntityId}', '${fixture.relacao.verificationStatus}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationship_evidence (relationship_id, evidence_id, role)
        VALUES ('${fixture.relacao.id}', '${fixture.relacao.evidenceId}', '${fixture.relacao.evidenceRole}')
        ON CONFLICT DO NOTHING;
        COMMIT;
      `;

      const result = executePsql(insertSql);
      assert.ok(!result.error, result.stderr);
      assert.match(result.stdout, /COMMIT/);
    });

    it('INTEGRIDADE: Deve rejeitar relação VERIFIED sem evidência SUPPORTS', () => {
      const invalidRelSql = `
        BEGIN;
        INSERT INTO relationships (id, subject_entity_id, predicate, object_entity_id, verification_status)
        VALUES ('88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', 'DIRECTOR_OF', '55555555-5555-5555-5555-555555555555', 'VERIFIED');
        COMMIT;
      `;

      const result = executePsql(invalidRelSql);
      assert.ok(result.error);
      assert.match(result.stderr, /VIOLACAO DE INTEGRIDADE: Relacao VERIFIED/);
    });

    it('INTEGRIDADE: Deve rejeitar remoção do último suporte de uma relação VERIFIED', () => {
      const removeSupportSql = `
        BEGIN;
        DELETE FROM relationship_evidence 
        WHERE relationship_id = '77777777-7777-7777-7777-777777777777' 
          AND evidence_id = '44444444-4444-4444-4444-444444444444';
        COMMIT;
      `;

      const result = executePsql(removeSupportSql);
      assert.ok(result.error);
      assert.match(result.stderr, /VIOLACAO DE INTEGRIDADE: Relacao VERIFIED/);
    });

    it('INTEGRIDADE: Deve rejeitar alteração do papel da evidência de SUPPORTS para CONTRADICTS em relação VERIFIED', () => {
      const changeRoleSql = `
        BEGIN;
        UPDATE relationship_evidence 
        SET role = 'CONTRADICTS'
        WHERE relationship_id = '77777777-7777-7777-7777-777777777777';
        COMMIT;
      `;

      const result = executePsql(changeRoleSql);
      assert.ok(result.error);
      assert.match(result.stderr, /VIOLACAO DE INTEGRIDADE: Relacao VERIFIED/);
    });

    it('RLS: Deve permitir SELECT público mas bloquear INSERT para usuário anônimo sem bypass', () => {
      const selectSql = `
        SELECT COUNT(*) FROM entities;
      `;
      const selectResult = executePsql(selectSql);
      assert.ok(!selectResult.error);
      assert.match(selectResult.stdout, /count/);

      const testAnonSql = `
        DO $do$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon_tester_rls') THEN
                CREATE ROLE anon_tester_rls NOLOGIN;
                GRANT USAGE ON SCHEMA public TO anon_tester_rls;
                GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO anon_tester_rls;
            END IF;
        END
        $do$;

        SET ROLE anon_tester_rls;
        INSERT INTO entities (id, canonical_name) VALUES ('99999999-9999-9999-9999-999999999999', 'Tentativa Invasiva');
      `;
      const insertResult = executePsql(testAnonSql);
      assert.ok(insertResult.error);
      assert.match(insertResult.stderr, /violates row-level security policy/);
    });
  });
});
