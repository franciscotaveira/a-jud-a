import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EntitySchema,
  RelationshipSchema,
  RelationshipEvidenceSchema,
  EvidenceSchema,
  SourceArtifactSchema
} from '@pig-br/contracts';
import {
  isValidCnpj,
  normalizeCnpj,
  normalizeEntityName,
  resolveIdentity
} from '@pig-br/domain';
import { calculateSha256, verifyExcerptIntegrity } from '@pig-br/evidence';

describe('Marco M0 — Fundação e Regras Inegociáveis', () => {

  describe('1. Normalização e Validação Algorítmica de CNPJ', () => {
    it('Deve validar CNPJ do piloto e rejeitar corrompidos ou repetidos', () => {
      const cnpjPiloto = '33.923.798/0001-00';
      assert.equal(isValidCnpj(cnpjPiloto), true);
      assert.equal(normalizeCnpj(cnpjPiloto), '33923798000100');

      // Dígitos verificadores incorretos
      assert.equal(isValidCnpj('33.923.798/0001-99'), false);
      // Dígitos repetidos
      assert.equal(isValidCnpj('00.000.000/0000-00'), false);
      assert.equal(isValidCnpj('11.111.111/1111-11'), false);
    });
  });

  describe('2. Resolução Conservadora de Identidades (Pessoas e Empresas)', () => {
    it('REGRA INEGOCIÁVEL: Nome sozinho NUNCA permite fusão de pessoas físicas', () => {
      const match = resolveIdentity({
        entityType: 'PERSON',
        nameA: 'João Carlos da Silva',
        nameB: 'JOAO CARLOS DA SILVA'
      });

      assert.equal(match.decision, 'MANUAL_REVIEW');
      assert.match(match.reason, /Homônimos em pessoas físicas exigem evidência/);
    });

    it('Deve exigir CNPJ para confirmar correspondência de organizações homônimas', () => {
      const match = resolveIdentity({
        entityType: 'ORGANIZATION',
        nameA: 'Indústria Metalúrgica Brasil Ltda',
        nameB: 'INDUSTRIA METALURGICA BRASIL LTDA'
      });

      assert.equal(match.decision, 'POSSIBLE_MATCH');
    });

    it('Identificadores unívocos idênticos produzem AUTO_MATCH', () => {
      const match = resolveIdentity({
        entityType: 'ORGANIZATION',
        nameA: 'Banco X',
        nameB: 'Banco X Matriz',
        identifierA: { scheme: 'CNPJ', value: '33923798000100' },
        identifierB: { scheme: 'CNPJ', value: '33923798000100' }
      });

      assert.equal(match.decision, 'AUTO_MATCH');
    });
  });

  describe('3. Padrão de Evidência e Múltiplas Evidências com Papéis', () => {
    it('Deve validar integridade de trecho literal com hash e localizador', () => {
      const documentoOriginal = 'A ata da assembleia geral aprova a eleição de Fulano como Diretor Estatutário.';
      const hash = calculateSha256(documentoOriginal);
      assert.match(hash, /^[a-f0-9]{64}$/);

      const checkValido = verifyExcerptIntegrity(documentoOriginal, {
        exactText: 'eleição de Fulano como Diretor Estatutário'
      });
      assert.equal(checkValido.valid, true);
      assert.equal(checkValido.calculatedOffset, 35);

      const checkInvalido = verifyExcerptIntegrity(documentoOriginal, {
        exactText: 'eleição de Beltrano'
      });
      assert.equal(checkInvalido.valid, false);
    });

    it('Deve suportar múltiplos papéis de evidência (SUPPORTS, CONTRADICTS, CONTEXTUALIZES)', () => {
      const relId = '11111111-1111-1111-1111-111111111111';
      const evSupport = '22222222-2222-2222-2222-222222222222';
      const evContradict = '33333333-3333-3333-3333-333333333333';

      const parsedSupport = RelationshipEvidenceSchema.parse({
        relationshipId: relId,
        evidenceId: evSupport,
        role: 'SUPPORTS'
      });
      assert.equal(parsedSupport.role, 'SUPPORTS');

      const parsedContradict = RelationshipEvidenceSchema.parse({
        relationshipId: relId,
        evidenceId: evContradict,
        role: 'CONTRADICTS'
      });
      assert.equal(parsedContradict.role, 'CONTRADICTS');
    });
  });

  describe('4. Isolamento de Fixture Fictícia', () => {
    it('Fixture de demonstração deve conter disclaimer explícito de dados fictícios', async () => {
      const fs = await import('node:fs/promises');
      const fixtureContent = await fs.readFile('fixtures/demo/banco_master_fixture.json', 'utf-8');
      const data = JSON.parse(fixtureContent);

      assert.equal(data.aviso_legal, 'Demonstração — dados fictícios.');
      assert.ok(data.entidade.canonical_name.includes('FICTICIO'));
    });
  });
});
