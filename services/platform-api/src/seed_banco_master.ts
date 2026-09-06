import { Pool } from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:pig_br_password_2026@127.0.0.1:54320/pig_br'
});

async function main() {
  console.log('Iniciando importação documental auditável do Banco Master (Pet 16.662)...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Cadastrar a Fonte Primária da Coleta
    // Conforme diretriz de Truth in Data: coleta via divulgação pública (Poder360).
    // Autenticidade oficial primária permanece PENDENTE enquanto não houver checagem direta no STF.
    const sourceRes = await client.query(`
      INSERT INTO sources (id, name, organization, source_type, official, access_method, documentation_url, capabilities)
      VALUES (
        '10000000-0000-0000-0000-000000000001',
        'Acervo Documental STF Petição 16.662 (Divulgação Poder360)',
        'Poder360 / Autos Públicos STF',
        'JUDICIAL_SYSTEM',
        false, -- Autenticidade oficial perante autos primários permanece pendente
        'PUBLIC_MEDIA_ARCHIVE',
        'https://static.poder360.com.br/uploads/2026/09/',
        '{"returnsDocuments": true, "returnsRelationships": true, "authenticityVerified": false}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET last_checked_at = NOW()
      RETURNING id;
    `);
    const sourceId = sourceRes.rows[0].id;

    // 5 Artefatos físicos preservados com seus respectivos hashes SHA-256 e arquivos de texto
    const artifacts = [
      {
        id: '20000000-0000-0000-0000-000000000001',
        filename: 'pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.pdf',
        textfile: 'pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.txt',
        sha256: 'a8ad2a2a45900da587a7b79f6afac020bb837caa284c592515aada58b0c518c8',
        mediaType: 'application/pdf',
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

    // 2. Cadastrar as Entidades Centrais (Rede Estratégica Completa Documentada nos Autos da Petição 16.662)
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
      },
      {
        id: '50000000-0000-0000-0000-000000000007',
        type: 'PERSON',
        name: 'VIVIANE BARCI DE MORAES',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000008',
        type: 'PERSON',
        name: 'FABIO FARIA',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000009',
        type: 'PERSON',
        name: 'LEONARDO PALHARES',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000010',
        type: 'PERSON',
        name: 'ANGELO ANTONIO RIBEIRO DA SILVA',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000011',
        type: 'ORGANIZATION',
        name: 'PRIME YOU COMPARTILHAMENTO S.A.',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000012',
        type: 'AIRCRAFT',
        name: 'AERONAVE LEGACY 650 (PP-NLR / PR-NLR)',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000013',
        type: 'AIRCRAFT',
        name: 'HELICOPTERO EUROCOPTER EC 155 B1',
        jurisdiction: 'BR',
        cnpj: null
      },
      {
        id: '50000000-0000-0000-0000-000000000014',
        type: 'PERSON',
        name: 'ALEXANDRE DE MORAES',
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
        excerpt: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS E DE HONORÁRIOS ADVOCATÍCIOS BARCI DE MORAES SOCIEDADE DE ADVOGADOS, ... BANCO MASTER S.A. ... CONTRATANTE',
        locator: {
          page: 1,
          section: 'Preâmbulo / Folha 1',
          literalSnippet: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS\nE DE HONORÁRIOS ADVOCATÍCIOS\nBARCI DE MORAES\nSOCIEDADE DE ADVOGADOS',
          summary: 'Instrumento contratual de prestação de serviços e honorários advocatícios indicando Banco Master S.A. como Contratante e Barci de Moraes como Contratada'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        artifactId: '20000000-0000-0000-0000-000000000002',
        documentId: '20000000-0000-0000-0000-000000000002',
        excerpt: 'BARCI DE MORAES SOCIEDADE DE ADVOGADOS ... neste ato, representada por seu administrador GUILHERME DE TOLEDO BENAZZI',
        locator: {
          page: 1,
          section: 'Qualificação Contratada / Linhas 11-13',
          literalSnippet: 'neste ato, representada por seu administrador\nGUILHERME DE TOLEDO BENAZZI',
          summary: 'Qualificação da sociedade de advogados Barci de Moraes representada por Guilherme de Toledo Benazzi'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        artifactId: '20000000-0000-0000-0000-000000000002',
        documentId: '20000000-0000-0000-0000-000000000002',
        excerpt: 'VIKING PARTICIPAÇÕES LTDA. ... neste ato, se faz representar por DANIEL BUENO VORCARO',
        locator: {
          page: 1,
          section: 'Qualificação Contratante / Linhas 20-22',
          literalSnippet: 'VIKING PARTICIPAÇÕES LTDA. ... neste ato, se faz representar por DANIEL BUENO VORCARO',
          summary: 'Qualificação da Viking Participações com representação firmada por Daniel Bueno Vorcaro'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000004',
        artifactId: '20000000-0000-0000-0000-000000000003',
        documentId: '20000000-0000-0000-0000-000000000003',
        excerpt: 'FRACTION 024 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A., sociedade por ações de capital fechado ... possuidora da aeronave modelo PR-NLR',
        locator: {
          page: 1,
          section: 'Considerando (c)(i) / Folha 1',
          literalSnippet: 'FRACTION 024 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A. ... possuidora da aeronave modelo',
          summary: 'Cláusula de dação identificando a Fraction 024 como titular/possuidora de aeronave PR-NLR'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000005',
        artifactId: '20000000-0000-0000-0000-000000000005',
        documentId: '20000000-0000-0000-0000-000000000005',
        excerpt: 'WhatsApp Chat - Alexandre de Moraes BRASILIA ... 2025-10-01 22:17:06 @ Mensagem apagada pelo remetente',
        locator: {
          page: 1,
          section: 'Cabeçalho e mensagens apagadas OCR / Página 1',
          literalSnippet: 'WhatsApp Chat - Alexandre de Moraes BRASILIA -\n2025-10-01 22:17:06 -03:00\n@ Mensagem apagada pelo remetente',
          summary: 'Registro OCR de chat de WhatsApp anexado ao inquérito policial com mensagens apagadas'
        },
        method: 'MANUAL_EXTRACTION',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000006',
        artifactId: '20000000-0000-0000-0000-000000000004',
        documentId: '20000000-0000-0000-0000-000000000004',
        excerpt: 'O arquivo compartilhado MINUTA DE CONTRATO aponta em seus metadados como autor usuário denominado GUILHERME BENAZZI e a última modificação realizada por usuário denominado Ministro Alexandre de Moraes às 16:30 -03:00 do dia 11/01/2024.',
        locator: {
          page: 29,
          section: 'Item 5.2 / Página 29 do Relatório Policial nº 3298613/2026',
          literalSnippet: 'O arquivo compartilhado (“MINUTA DE CONTRATO”) aponta em seus metadados como autor usuário denominado GUILHERME BENAZZI e a última modificação realizada por usuário denominado “Ministro Alexandre de Moraes”',
          summary: 'Metadados da minuta contratual indicando edição por Guilherme Benazzi e Ministro Alexandre de Moraes'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000007',
        artifactId: '20000000-0000-0000-0000-000000000004',
        documentId: '20000000-0000-0000-0000-000000000004',
        excerpt: 'No dia 26/12/2023 ... contato Alexandre de Moraes BRASILIA foi compartilhado pelo interlocutor registrado no dispositivo como Fabio Faria ... por meio do aplicativo whatsapp.',
        locator: {
          page: 17,
          section: 'Item 5.1 / Página 17 do Relatório Policial',
          literalSnippet: 'contatos nominados como “Alexandre de Moraes BRASILIA” ... foram compartilhados pelo interlocutor registrado no dispositivo como "Fábio Faria"',
          summary: 'Intermediação e repasse de contatos telefônicos por Fábio Faria para Daniel Vorcaro'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000008',
        artifactId: '20000000-0000-0000-0000-000000000004',
        documentId: '20000000-0000-0000-0000-000000000004',
        excerpt: 'DANIEL BUENO VORCARO devolve a Vivi Moraes o contrato de prestação de serviços com seu escritório de advocacia, com marcas de revisão feitas pelo usuário LEONARDO PALHARES, advogado de VORCARO.',
        locator: {
          page: 31,
          section: 'Item 5.2 / Página 31',
          literalSnippet: 'DANIEL BUENO VORCARO devolve a “Vivi Moraes” o contrato ... com marcas de revisão feitas pelo usuário LEONARDO PALHARES',
          summary: 'Revisão jurídica e formatação do contrato de honorários advocatícios por Leonardo Palhares'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000009',
        artifactId: '20000000-0000-0000-0000-000000000004',
        documentId: '20000000-0000-0000-0000-000000000004',
        excerpt: 'ANGELO SILVA envia para DANIEL VORCARO comprovante de transferência do Banco Master para o Escritório BARCI DE MORAES SOCIEDADE DE ADVOCACIA, em sua conta no Banco Itaú, no valor de R$ 3.422.268,14.',
        locator: {
          page: 149,
          section: 'Item 5.4 / Página 149',
          literalSnippet: 'ANGELO SILVA envia para DANIEL VORCARO comprovante de transferência do Banco Master para o Escritório BARCI DE MORAES ... no valor de R$ 3.422.268,14',
          summary: 'Execução e comprovação de transferências bancárias do Banco Master para a banca de advocacia'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      },
      {
        id: '40000000-0000-0000-0000-000000000010',
        artifactId: '20000000-0000-0000-0000-000000000004',
        documentId: '20000000-0000-0000-0000-000000000004',
        excerpt: 'A PRIME YOU é uma pessoa jurídica cujos proprietários são MARCUS VINICIUS DA MATA e DANIEL VORCARO ... com informações sobre duas aeronaves: um avião Legacy 650 e um helicóptero EC 155 B1.',
        locator: {
          page: 164,
          section: 'Item 5.5 / Páginas 164-165',
          literalSnippet: 'A PRIME YOU é uma pessoa jurídica cujos proprietários são MARCUS VINICIUS DA MATA ... e DANIEL VORCARO',
          summary: 'Sociedade de compartilhamento de aeronaves operada por Daniel Vorcaro'
        },
        method: 'DETERMINISTIC_PARSER',
        status: 'PENDING_REVIEW'
      }
    ];

    for (const ev of evidences) {
      await client.query(`
        INSERT INTO evidence (id, artifact_id, document_id, excerpt, locator, extraction_method, review_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET 
          excerpt = EXCLUDED.excerpt,
          locator = EXCLUDED.locator,
          extraction_method = EXCLUDED.extraction_method,
          review_status = EXCLUDED.review_status;
      `, [ev.id, ev.artifactId, ev.documentId, ev.excerpt, JSON.stringify(ev.locator), ev.method, ev.status]);
    }

    // 4. Cadastrar Relações Documentadas como CANDIDATAS À REVISÃO (PENDING_REVIEW)
    const relations = [
      // 1. Banco Master contratou Barci de Moraes
      {
        id: '70000000-0000-0000-0000-000000000001',
        subject: '50000000-0000-0000-0000-000000000001', // Banco Master
        predicate: 'CONTRACTED_WITH',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000001',
        role: 'SUPPORTS'
      },
      // 2. Guilherme Benazzi administra Barci de Moraes
      {
        id: '70000000-0000-0000-0000-000000000002',
        subject: '50000000-0000-0000-0000-000000000005', // Guilherme Benazzi
        predicate: 'ADMINISTRATOR_OF',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000002',
        role: 'SUPPORTS'
      },
      // 3. Daniel Vorcaro representa Viking Participacoes
      {
        id: '70000000-0000-0000-0000-000000000003',
        subject: '50000000-0000-0000-0000-000000000004', // Daniel Vorcaro
        predicate: 'REPRESENTS',
        object: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000003',
        role: 'SUPPORTS'
      },
      // 4. Viking Participações contratou Barci de Moraes
      {
        id: '70000000-0000-0000-0000-000000000004',
        subject: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        predicate: 'CONTRACTED_WITH',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000003',
        role: 'SUPPORTS'
      },
      // 5. Viking Participações acionista de Fraction 024 (titular aeronave)
      {
        id: '70000000-0000-0000-0000-000000000005',
        subject: '50000000-0000-0000-0000-000000000003', // Viking Participacoes
        predicate: 'SHAREHOLDER_OF',
        object: '50000000-0000-0000-0000-000000000006', // Fraction 024
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000004',
        role: 'SUPPORTS'
      },
      // 6. Viviane Barci de Moraes sócia/titular de Barci de Moraes Sociedade de Advogados
      {
        id: '70000000-0000-0000-0000-000000000006',
        subject: '50000000-0000-0000-0000-000000000007', // Viviane Barci de Moraes
        predicate: 'DIRECTOR_OF',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000006',
        role: 'SUPPORTS'
      },
      // 7. Fábio Faria representa/articula contatos institucionais para Daniel Vorcaro
      {
        id: '70000000-0000-0000-0000-000000000007',
        subject: '50000000-0000-0000-0000-000000000008', // Fabio Faria
        predicate: 'REPRESENTS',
        object: '50000000-0000-0000-0000-000000000004', // Daniel Vorcaro
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000007',
        role: 'SUPPORTS'
      },
      // 8. Leonardo Palhares representa/advoga para Daniel Vorcaro e estrutura contratos
      {
        id: '70000000-0000-0000-0000-000000000008',
        subject: '50000000-0000-0000-0000-000000000009', // Leonardo Palhares
        predicate: 'REPRESENTS',
        object: '50000000-0000-0000-0000-000000000004', // Daniel Vorcaro
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000008',
        role: 'SUPPORTS'
      },
      // 9. Ângelo Silva realiza pagamentos de honorários em favor de Barci de Moraes
      {
        id: '70000000-0000-0000-0000-000000000009',
        subject: '50000000-0000-0000-0000-000000000010', // Angelo Silva
        predicate: 'PAID_TO',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000009',
        role: 'SUPPORTS'
      },
      // 10. Fraction 024 possui/titulariza a aeronave Legacy 650 (PP-NLR)
      {
        id: '70000000-0000-0000-0000-000000000010',
        subject: '50000000-0000-0000-0000-000000000006', // Fraction 024
        predicate: 'OWNS_AIRCRAFT',
        object: '50000000-0000-0000-0000-000000000012', // Aeronave Legacy 650
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000004',
        role: 'SUPPORTS'
      },
      // 11. Daniel Vorcaro é sócio/controlador de Prime You
      {
        id: '70000000-0000-0000-0000-000000000011',
        subject: '50000000-0000-0000-0000-000000000004', // Daniel Vorcaro
        predicate: 'SHAREHOLDER_OF',
        object: '50000000-0000-0000-0000-000000000011', // Prime You
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000010',
        role: 'SUPPORTS'
      },
      // 12. Prime You opera aeronave Legacy 650 e helicóptero
      {
        id: '70000000-0000-0000-0000-000000000012',
        subject: '50000000-0000-0000-0000-000000000011', // Prime You
        predicate: 'OPERATES_AIRCRAFT',
        object: '50000000-0000-0000-0000-000000000012', // Aeronave Legacy 650
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000010',
        role: 'SUPPORTS'
      },
      // 13. Prime You opera Helicóptero EC 155 B1
      {
        id: '70000000-0000-0000-0000-000000000013',
        subject: '50000000-0000-0000-0000-000000000011', // Prime You
        predicate: 'OPERATES_AIRCRAFT',
        object: '50000000-0000-0000-0000-000000000013', // Helicóptero EC 155
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000010',
        role: 'SUPPORTS'
      },
      // 14. Alexandre de Moraes vinculado documentalmente à edição da minuta de Barci de Moraes
      {
        id: '70000000-0000-0000-0000-000000000014',
        subject: '50000000-0000-0000-0000-000000000014', // Alexandre de Moraes
        predicate: 'REPRESENTS',
        object: '50000000-0000-0000-0000-000000000002', // Barci de Moraes
        status: 'PENDING_REVIEW',
        evidenceId: '40000000-0000-0000-0000-000000000006',
        role: 'CONTEXTUALIZES'
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
        ON CONFLICT (relationship_id, evidence_id) DO UPDATE SET role = EXCLUDED.role;
      `, [rel.id, rel.evidenceId, rel.role]);

      // Cadastrar na fila de revisão humana
      await client.query(`
        INSERT INTO review_queue (item_type, item_id, status, reason)
        VALUES ('RELATIONSHIP', $1, 'PENDING_REVIEW', 'Evidência textual locada em documento público. Aguarda conferência de vigência e escopo.')
        ON CONFLICT DO NOTHING;
      `, [rel.id]);
    }

    await client.query('COMMIT');
    console.log('Seed executado com sucesso: relações mantidas em PENDING_REVIEW na fila de revisão.');
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
