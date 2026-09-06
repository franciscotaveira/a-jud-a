import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

describe('Integridade Concorrente e Transferência de Suporte de Relações', () => {
  const connectionString = 'postgresql://postgres:pig_br_password_2026@127.0.0.1:54320/pig_br_test';

  it('Transferência de suporte (UPDATE): Deve rejeitar se a relação de origem (OLD) ficar sem suporte', async () => {
    const client = new Pool({ connectionString });
    const conn = await client.connect();

    try {
      // 1. Criar duas relações VERIFIED e uma evidência para cada
      await conn.query('BEGIN');
      const relA = '11111111-2222-3333-4444-555555555551';
      const relB = '11111111-2222-3333-4444-555555555552';
      const evA = '22222222-3333-4444-5555-666666666661';
      const evB = '22222222-3333-4444-5555-666666666662';
      const ent1 = '33333333-4444-5555-6666-777777777771';
      const ent2 = '33333333-4444-5555-6666-777777777772';
      const src = '44444444-5555-6666-7777-888888888881';
      const art = '55555555-6666-7777-8888-999999999991';

      await conn.query(`
        INSERT INTO sources (id, name, organization, source_type, official, access_method)
        VALUES ('${src}', 'Fonte Test', 'Org Test', 'OFFICIAL_GAZETTE', true, 'DIRECT_DOWNLOAD')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO source_artifacts (id, source_id, retrieved_at, media_type, sha256, storage_path)
        VALUES ('${art}', '${src}', NOW(), 'text/plain', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '/tmp/dummy')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO entities (id, canonical_name)
        VALUES ('${ent1}', 'Entidade Origem'), ('${ent2}', 'Entidade Destino')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO evidence (id, artifact_id, excerpt, locator, extraction_method, review_status)
        VALUES ('${evA}', '${art}', 'trecho a', '{}'::jsonb, 'DETERMINISTIC_PARSER', 'VERIFIED'),
               ('${evB}', '${art}', 'trecho b', '{}'::jsonb, 'DETERMINISTIC_PARSER', 'VERIFIED')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationships (id, subject_entity_id, predicate, object_entity_id, verification_status)
        VALUES ('${relA}', '${ent1}', 'CONTRACTED_WITH', '${ent2}', 'VERIFIED'),
               ('${relB}', '${ent1}', 'CONTRACTED_WITH', '${ent2}', 'VERIFIED')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationship_evidence (relationship_id, evidence_id, role)
        VALUES ('${relA}', '${evA}', 'SUPPORTS'),
               ('${relB}', '${evB}', 'SUPPORTS')
        ON CONFLICT DO NOTHING;
      `);
      await conn.query('COMMIT');

      // Tentativa de transferir evA de relA para relB. relA ficará com 0 suportes!
      await conn.query('BEGIN');
      let failed = false;
      try {
        await conn.query(`
          UPDATE relationship_evidence
          SET relationship_id = '${relB}'
          WHERE relationship_id = '${relA}' AND evidence_id = '${evA}';
        `);
        await conn.query('COMMIT');
      } catch (err: any) {
        failed = true;
        await conn.query('ROLLBACK');
        assert.match(err.message, /VIOLACAO DE INTEGRIDADE: Relacao VERIFIED/);
      }
      assert.equal(failed, true, 'Deveria ter falhado pois relA perdeu seu único suporte ao transferir');
    } finally {
      conn.release();
      await client.end();
    }
  });

  it('Concorrência: Duas transações independentes tentando remover suportes distintos devem ser serializadas pelo lock FOR NO KEY UPDATE', async () => {
    const pool1 = new Pool({ connectionString });
    const pool2 = new Pool({ connectionString });
    const conn1 = await pool1.connect();
    const conn2 = await pool2.connect();

    try {
      const relC = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1';
      const ev1 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee2';
      const ev2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee3';
      const entA = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee4';
      const entB = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee5';
      const src = '44444444-5555-6666-7777-888888888881';
      const art = '55555555-6666-7777-8888-999999999991';

      // Setup: relC é VERIFIED e possui exatamente 2 suportes (ev1 e ev2)
      await conn1.query('BEGIN');
      await conn1.query(`
        INSERT INTO entities (id, canonical_name)
        VALUES ('${entA}', 'Ent A'), ('${entB}', 'Ent B')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO evidence (id, artifact_id, excerpt, locator, extraction_method, review_status)
        VALUES ('${ev1}', '${art}', 'ev1', '{}'::jsonb, 'DETERMINISTIC_PARSER', 'VERIFIED'),
               ('${ev2}', '${art}', 'ev2', '{}'::jsonb, 'DETERMINISTIC_PARSER', 'VERIFIED')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationships (id, subject_entity_id, predicate, object_entity_id, verification_status)
        VALUES ('${relC}', '${entA}', 'DIRECTOR_OF', '${entB}', 'VERIFIED')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO relationship_evidence (relationship_id, evidence_id, role)
        VALUES ('${relC}', '${ev1}', 'SUPPORTS'),
               ('${relC}', '${ev2}', 'SUPPORTS')
        ON CONFLICT DO NOTHING;
      `);
      await conn1.query('COMMIT');

      // Agora duas conexões concorrentes tentam deletar um suporte cada:
      // T1 deleta ev1.
      // T2 deleta ev2.
      // Sem lock serializador (FOR NO KEY UPDATE), ambas poderiam ver count=2 antes do commit
      // e ambas commitariam, deixando a relação VERIFIED com 0 suportes!
      await conn1.query('BEGIN');
      await conn2.query('BEGIN');

      await conn1.query(`DELETE FROM relationship_evidence WHERE relationship_id = '${relC}' AND evidence_id = '${ev1}';`);
      await conn2.query(`DELETE FROM relationship_evidence WHERE relationship_id = '${relC}' AND evidence_id = '${ev2}';`);

      // Commit de T1 passa com sucesso (ainda resta ev2)
      await conn1.query('COMMIT');

      // Commit de T2 DEVE falhar com violação de integridade ao tentar comitar a remoção do último suporte
      let t2Failed = false;
      try {
        await conn2.query('COMMIT');
      } catch (err: any) {
        t2Failed = true;
        await conn2.query('ROLLBACK');
        assert.match(err.message, /VIOLACAO DE INTEGRIDADE: Relacao VERIFIED/);
      }

      assert.equal(t2Failed, true, 'T2 deveria ter sido bloqueada e falhado no commit por deixar a relação sem suporte');
    } finally {
      conn1.release();
      conn2.release();
      await pool1.end();
      await pool2.end();
    }
  });
});
