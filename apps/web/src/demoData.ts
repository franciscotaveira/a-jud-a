export interface Fact {
  field_name: string;
  value: string;
  evidence_id: string;
}

export interface Identifier {
  scheme: string;
  normalized_value: string;
}

export interface EntityFixture {
  id: string;
  entity_type: string;
  canonical_name: string;
  jurisdiction: string;
  identifiers: Identifier[];
  facts: Fact[];
}

export interface RelatedEntity {
  id: string;
  entity_type: string;
  canonical_name: string;
  jurisdiction: string;
}

export interface Locator {
  page: number;
  section: string;
  exactText: string;
}

export interface EvidenceFixture {
  evidence_id: string;
  role: 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXTUALIZES';
  trecho: string;
  locator: Locator;
}

export interface RelationFixture {
  id: string;
  subject_entity_id: string;
  predicate: string;
  object_entity_id: string;
  verification_status: string;
  evidencias: EvidenceFixture[];
}

export interface DemoFixtureData {
  nome: string;
  aviso_legal: string;
  entidade: EntityFixture;
  relacionadas: RelatedEntity[];
  relacoes: RelationFixture[];
}

export const fixtureData: DemoFixtureData = {
  nome: "Banco Master S.A. (Demonstração Fictícia Isolada)",
  aviso_legal: "Demonstração — dados fictícios.",
  entidade: {
    id: "e0000000-0000-0000-0000-000000000001",
    entity_type: "ORGANIZATION",
    canonical_name: "BANCO MASTER S.A. (FICTICIO)",
    jurisdiction: "BR",
    identifiers: [
      {
        scheme: "CNPJ",
        normalized_value: "33923798000100"
      }
    ],
    facts: [
      {
        field_name: "SITUACAO_CADASTRAL",
        value: "ATIVA",
        evidence_id: "ev-00000000-0000-0000-0000-000000000001"
      },
      {
        field_name: "CAPITAL_SOCIAL",
        value: "R$ 1.200.000.000,00",
        evidence_id: "ev-00000000-0000-0000-0000-000000000002"
      }
    ]
  },
  relacionadas: [
    {
      id: "e0000000-0000-0000-0000-000000000002",
      entity_type: "PERSON",
      canonical_name: "FULANO DE TAL (FICTICIO)",
      jurisdiction: "BR"
    }
  ],
  relacoes: [
    {
      id: "rel-00000000-0000-0000-0000-000000000001",
      subject_entity_id: "e0000000-0000-0000-0000-000000000002",
      predicate: "DIRECTOR_OF",
      object_entity_id: "e0000000-0000-0000-0000-000000000001",
      verification_status: "VERIFIED",
      evidencias: [
        {
          evidence_id: "ev-00000000-0000-0000-0000-000000000003",
          role: "SUPPORTS",
          trecho: "Eleito Diretor Presidente Fulano de Tal, com mandato vigente até 2027.",
          locator: {
            page: 4,
            section: "4.1 Eleição da Diretoria",
            exactText: "Eleito Diretor Presidente Fulano de Tal, com mandato vigente até 2027."
          }
        },
        {
          evidence_id: "ev-00000000-0000-0000-0000-000000000004",
          role: "CONTEXTUALIZES",
          trecho: "A ata anterior mencionava mandato em transição.",
          locator: {
            page: 1,
            section: "Histórico",
            exactText: "A ata anterior mencionava mandato em transição."
          }
        }
      ]
    }
  ]
};
