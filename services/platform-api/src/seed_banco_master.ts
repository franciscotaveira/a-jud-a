import { Pool } from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:pig_br_password_2026@127.0.0.1:54320/pig_br'
});

async function main() {
  console.log('Iniciando importação documental idempotente do Banco Master (Pet 16.662)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Cadastrar a Fonte Primária da Coleta
    const sourceRes = await client.query(`
      INSERT INTO sources (id, name, organization, source_type, official, access_method, documentation_url, capabilities)
      VALUES (
        '10000000-0000-0000-0000-000000000001',
        'Acervo Documental STF Petição 16.662 (Divulgação Poder360)',
        'Poder360 / Autos Públicos STF',
        'JUDICIAL_SYSTEM',
        false, -- Autenticidade oficial primária permanece pendente
        'PUBLIC_MEDIA_ARCHIVE',
        'https://static.poder360.com.br/uploads/2026/09/',
        '{"returnsDocuments": true, "returnsRelationships": true, "authenticityVerified": false}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET last_checked_at = NOW()
      RETURNING id;
    `);
    const sourceId = sourceRes.rows[0].id;

    // Definição dos 5 artefatos oficiais
    const artifacts = [
      {
        id: '20000000-0000-0000-0000-000000000001',
        filename: 'pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.pdf',
        textfile: 'pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.txt',
        sha256: 'a8ad2a2a45900da587a7b79f6afac020bb837caa284c592515aada58b0c518c8',
        mediaType: 'application/pdf',
        byteSize: 11534336,
        docTitle: 'Contrato de Prestação de Serviços - Banco Master e Barci de Moraes',
        docType: 'CONTRATO_HONORARIOS',
        docDate: '2024-01-15'
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        filename: 'pet16662-contrato-viking-barci-moraes-50milhoes-sigiloderrubado-1set2026.pdf',
        textfile: 'pet16662-contrato-viking-barci-moraes-50milhoes-sigiloderrubado-1set2026.txt',
        sha256: '6ab6936b0316d3ab075dc115156e0c7f2ca656377650d9df3b87e246e732d58c',
        mediaType: 'application/pdf',
        byteSize: 192512,
        docTitle: 'Contrato de Prestação de Serviços - Viking Participações e Barci de Moraes',
        docType: 'CONTRATO_HONORARIOS',
        docDate: '2024-01-15'
      },
      {
        id: '20000000-0000-0000-0000-000000000003',
        filename: 'pet16662-acordo-dacao-viking-barci-aviao-helicoptero-50milhoes-sigiloderrubado.pdf',
        textfile: 'pet16662-acordo-dacao-viking-barci-aviao-helicoptero-50milhoes-sigiloderrubado.txt',
        sha256: 'ea78d5008a53f59f2f606a4c509094a992fab5662a7b52f9905f4816accc63fd',
        mediaType: 'application/pdf',
        byteSize: 8074035,
        docTitle: 'Termo de Acordo e Dação em Pagamento (Aeronave PR-NLR e Helicóptero)',
        docType: 'TERMO_DACAO',
        docDate: '2024-06-01'
      },
      {
        id: '20000000-0000-0000-0000-000000000004',
        filename: 'pet16662_relatorio_pf_celular_vorcaro_moraes_gonet_andrei_barci.pdf',
        textfile: 'pet16662_relatorio_pf_celular_vorcaro_moraes_gonet_andrei_barci.txt',
        sha256: '30e24f6d8abd6c033c50594ff2658a4ad72b2ac818f312ea3fe54e80a5d052d7',
        mediaType: 'application/pdf',
        byteSize: 5557452,
        docTitle: 'Relatório de Análise da Polícia Federal nº 3298613/2026 (Operação Compliance Zero)',
        docType: 'RELATORIO_POLICIAL',
        docDate: '2026-08-27'
      },
      {
        id: '20000000-0000-0000-0000-000000000005',
        filename: 'pet16662-whatsapp-vorcaro-alexandre-moraes-sigiloderrubado-1set2026.pdf',
        textfile: 'pet16662-whatsapp-vorcaro-alexandre-moraes-sigiloderrubado-1set2026.txt',
        sha256: '309704af37d7aa28926c3c3e5acf4d1e7d5f4f0fa2f273bc2554b99273ca8a1d',
        mediaType: 'application/pdf',
        byteSize: 1258291,
        docTitle: 'Extração Pericial de Mensagens de WhatsApp (Anexo Laudo)',
        docType: 'EXTRACAO_MENSAGENS_OCR',
        docDate: '2025-11-18'
      }
    ];

    for (const art of artifacts) {
      const textPath = join('data/extracted_texts/banco_master', art.textfile);
      const textContent = existsSync(textPath) ? readFileSync(textPath, 'utf-8') : '';

      await client.query(`
        INSERT INTO source_artifacts (id, source_id, retrieved_at, media_type, sha256, storage_path, request_metadata)
        VALUES ($1, $2, NOW(), $3, $4, $5, '{"origin": "Poder360", "peticao": "16662"}'::jsonb)
        ON CONFLICT (sha256) DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at;
      `, [art.id, sourceId, art.mediaType, art.sha256, `data/raw_artifacts/banco_master/${art.filename}`]);

      await client.query(`
        INSERT INTO documents (id, artifact_id, title, document_type, document_date, extracted_text)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET extracted_text = EXCLUDED.extracted_text;
      `, [art.id, art.id, art.docTitle, art.docType, art.docDate, textContent]);
    }

    // 2. Cadastrar as Entidades Centrais
    const entities = [
      {
        id: '50000000-0000-0000-0000-000000000001',
        type: 'ORGANIZATION',
        name: 'BANCO MASTER S.A.',
        jurisdiction: 'BR',
        cnpj: '33923798000100'
      },
      {
        id: '50000000-0000-0000-0000-000000000002',
        type: 'ORGANIZATION',
        name: 'BARCI DE MORAES SOCIEDADE DE ADVOGADOS',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000003',
        type: 'ORGANIZATION',
        name: 'VIKING PARTICIPACOES LTDA.',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000004',
        type: 'PERSON',
        name: 'DANIEL BUENO VORCARO',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000005',
        type: 'PERSON',
        name: 'GUILHERME DE TOLEDO BENAZZI',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000006',
        type: 'ORGANIZATION',
        name: 'FRACTION 024 ADMINISTRACAO DE BEM PROPRIO S.A.',
        jurisdiction: 'BR',
        cnpj: null
      }
    ];

    for (const ent of entities) {
      await client.query(`
        INSERT INTO entities (id, entity_type, canonical_name, jurisdiction)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET canonical_name = EXCLUDED.canonical_name;
      `, [ent.id, ent.type, ent.name, ent.jurisdiction]);

      if (ent.cnpj) {
        await client.query(`
          INSERT INTO entity_identifiers (entity_id, scheme, normalized_value, jurisdiction)
          VALUES ($1, 'CNPJ', $2, 'BR')
          ON CONFLICT (scheme, normalized_value) DO NOTHING;
        `, [ent.id, ent.cnpj]);
      }
    }

    // 3. Cadastrar Evidências Textuais Locadas
    const evidences = [
      {
        id: '40000000-0000-0000-0000-000000000001',
        artifactId: '20000000-0000-0000-0000-000000000001',
        documentId: '20000000-0000-0000-0000-000000000001',
        excerpt: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS E DE HONORÁRIOS ADVOCATÍCIOS BARCI DE MORAES SOCIEDADE DE ADVOGADOS, ... BANCO MASTER S.A.',
        locator: { page: 1, section: 'Preâmbulo', exactText: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS E DE HONORÁRIOS ADVOCATÍCIOS' },
        method: 'DETERMINISTIC_PARSER',
        status: 'VERIFIED'
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        artifactId: '20000000-0000-0000-0000-000000000002',
        documentId: '20000000-0000-0000-0000-000000000002',
        excerpt: 'BARCI DE MORAES SOCIEDADE DE ADVOGADOS ... neste ato, representada por seu administrador GUILHERME DE TOLEDO BENAZZI',
        locator: { page: 1, section: 'Qualificação Contratada', exactText: 'representada por seu administrador GUILHERME DE TOLEDO BENAZZI' },
        method: 'DETERMINISTIC_PARSER',
        status: 'VERIFIED'
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        artifactId: '20000000-0000-0000-0000-000000000002',
        documentId: '20000000-0000-0000-0000-000000000002',
        excerpt: 'VIKING PARTICIPAÇÕES LTDA. ... neste ato, se faz representar por DANIEL BUENO VORCARO',
        locator: { page: 1, section: 'Qualificação Contratante', exactText: 'neste ato, se faz representar por DANIEL BUENO VORCARO' },
        method: 'DETERMINISTIC_PARSER',
        status: 'VERIFIED'
      },
      {
        id: '40000000-0000-0000-0000-000000000004',
        artifactId: '20000000-0000-0000-0000-000000000003',
        documentId: '20000000-0000-0000-0000-000000000003',
        excerpt: 'FRACTION 024 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A. ... possuidora da aeronave modelo PR-NLR',
        locator: { page: 1, section: 'Considerando (c)(i)', exactText: 'possuidora da aeronave modelo PR-NLR' },
        method: 'DETERMINISTIC_PARSER',
        status: 'VERIFIED'
      }
    ];

    for (const ev of evidences) {
      await client.query(`
        INSERT INTO evidence (id, artifact_id, document_id, excerpt, locator, extraction_method, review_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET review_status = EXCLUDED.review_status;
      `, [ev.id, ev.artifactId, ev.documentId, ev.excerpt, JSON.stringify(ev.locator), ev.method, ev.status]);
    }

    // 4. Cadastrar Relações Documentadas com Evidência de Suporte
    const relations = [
      {
        id: '70000000-0000-0000-0000-000000000001',
        subject: '50000000-0000-0000-0000-000000000001', // Banco Master
        predicate: 'CONTRACTED_WITH',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'VERIFIED',
        evidenceId: '40000000-0000-0000-0000-000000000001',
        role: 'SUPPORTS'
      },
      {
        id: '70000000-0000-0000-0000-000000000002',
        subject: '50000000-0000-0000-0000-000000000005', // Guilherme Benazzi
        predicate: 'ADMINISTRATOR_OF',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'VERIFIED',
        evidenceId: '40000000-0000-0000-0000-000000000002',
        role: 'SUPPORTS'
      },
      {
        id: '70000000-0000-0000-0000-000000000003',
        subject: '50000000-0000-0000-0000-000000000004', // Daniel Vorcaro
        predicate: 'REPRESENTS',
        object: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        status: 'VERIFIED',
        evidenceId: '40000000-0000-0000-0000-000000000003',
        role: 'SUPPORTS'
      },
      {
        id: '70000000-0000-0000-0000-000000000004',
        subject: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        predicate: 'CONTRACTED_WITH',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'VERIFIED',
        evidenceId: '40000000-0000-0000-0000-000000000003',
        role: 'SUPPORTS'
      },
      {
        id: '70000000-0000-0000-0000-000000000005',
        subject: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        predicate: 'SHAREHOLDER_OF',
        object: '50000000-0000-0000-0000-000000000006', // Fraction 024
        status: 'VERIFIED',
        evidenceId: '40000000-0000-0000-0000-000000000004',
        role: 'SUPPORTS'
      }
    ];

    for (const rel of relations) {
      await client.query(`
        INSERT INTO relationships (id, subject_entity_id, predicate, object_entity_id, verification_status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET verification_status = EXCLUDED.verification_status;
      `, [rel.id, rel.subject, rel.predicate, rel.object, rel.status]);

      await client.query(`
        INSERT INTO relationship_evidence (relationship_id, evidence_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (relationship_id, evidence_id) DO NOTHING;
      `, [rel.id, rel.evidenceId, rel.role]);
    }

    await client.query('COMMIT');
    console.log('Importação concluída com sucesso no banco de dados!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na importação documental:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
