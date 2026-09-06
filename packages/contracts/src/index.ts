import { z } from 'zod';

// ============================================================================
// 1. Entidades e Identificadores (Resolução Conservadora)
// ============================================================================

export const EntityTypeSchema = z.enum([
  'ORGANIZATION',
  'PERSON',
  'PROCESS',
  'CONTRACT',
  'FUND',
  'AIRCRAFT'
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntitySchema = z.object({
  id: z.string().uuid(),
  entityType: EntityTypeSchema.default('ORGANIZATION'),
  canonicalName: z.string().min(1),
  jurisdiction: z.string().default('BR'),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type Entity = z.infer<typeof EntitySchema>;

export const EntityIdentifierSchema = z.object({
  id: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  scheme: z.enum(['CNPJ', 'CPF', 'CVM_CODE', 'BACEN_CODE', 'OAB', 'PROCESS_CNJ', 'AIRCRAFT_REGISTRATION', 'DEMO_ID']),
  normalizedValue: z.string().min(1),
  jurisdiction: z.string().default('BR'),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable()
});
export type EntityIdentifier = z.infer<typeof EntityIdentifierSchema>;

export const EntityAliasSchema = z.object({
  id: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  alias: z.string().min(1),
  normalizedAlias: z.string().min(1),
  evidenceId: z.string().uuid().optional().nullable()
});
export type EntityAlias = z.infer<typeof EntityAliasSchema>;

export const EntityFactSchema = z.object({
  id: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  fieldName: z.string().min(1),
  value: z.string().min(1),
  evidenceId: z.string().uuid(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable()
});
export type EntityFact = z.infer<typeof EntityFactSchema>;

// ============================================================================
// 2. Fontes, Artefatos, Documentos e Evidências
// ============================================================================

export const SourceTypeSchema = z.enum([
  'OFFICIAL_GAZETTE',
  'TAX_REGISTRY',
  'CENTRAL_BANK',
  'SECURITIES_COMM',
  'JUDICIAL_SYSTEM',
  'PUBLIC_PROCUREMENT',
  'DEMO_SYNTHETIC'
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  organization: z.string().min(1),
  sourceType: SourceTypeSchema,
  official: z.boolean().default(true),
  documentationUrl: z.string().url().optional().nullable(),
  accessMethod: z.string().min(1),
  capabilities: z.record(z.any()).default({}),
  lastCheckedAt: z.string().datetime().optional().nullable()
});
export type Source = z.infer<typeof SourceSchema>;

export const SourceArtifactSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  connectorRunId: z.string().uuid().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  retrievedAt: z.string().datetime(),
  mediaType: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, 'Hash SHA-256 inválido'),
  storagePath: z.string().min(1),
  requestMetadata: z.record(z.any()).default({})
});
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

export const DatePrecisionSchema = z.enum(['DAY', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN']);
export type DatePrecision = z.infer<typeof DatePrecisionSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  title: z.string().min(1),
  documentType: z.string().min(1),
  publishedAt: z.string().datetime().optional().nullable(),
  documentDate: z.string().optional().nullable(),
  datePrecision: DatePrecisionSchema.default('DAY'),
  extractedText: z.string().optional().nullable()
});
export type Document = z.infer<typeof DocumentSchema>;

export const ReviewStatusSchema = z.enum([
  'PENDING_REVIEW',
  'VERIFIED',
  'CONFLICTING',
  'REJECTED'
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const EvidenceLocatorSchema = z.object({
  page: z.number().int().positive().optional().nullable(),
  section: z.string().optional().nullable(),
  exactText: z.string().min(1),
  jsonPath: z.string().optional().nullable(),
  csvRowIndex: z.number().int().nonnegative().optional().nullable(),
  charOffset: z.number().int().nonnegative().optional().nullable()
});
export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>;

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  documentId: z.string().uuid().optional().nullable(),
  excerpt: z.string().min(1),
  locator: EvidenceLocatorSchema,
  extractionMethod: z.enum(['DETERMINISTIC_PARSER', 'MANUAL_EXTRACTION', 'AI_EXTRACTION']),
  reviewStatus: ReviewStatusSchema.default('PENDING_REVIEW'),
  createdAt: z.string().datetime().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ==========================================
// 3. Relações e Suporte Multievidência com Papéis
// ==========================================

export const RelationshipPredicateSchema = z.enum([
  'SHAREHOLDER_OF',
  'DIRECTOR_OF',
  'ADMINISTRATOR_OF',
  'CONTRACTED_WITH',
  'PAID_TO',
  'REPRESENTS',
  'PARTY_IN_CASE',
  'OWNS_AIRCRAFT',
  'OPERATES_AIRCRAFT'
]);
export type RelationshipPredicate = z.infer<typeof RelationshipPredicateSchema>;

export const EvidenceRoleSchema = z.enum([
  'SUPPORTS',
  'CONTRADICTS',
  'CONTEXTUALIZES'
]);
export type EvidenceRole = z.infer<typeof EvidenceRoleSchema>;

export const RelationshipEvidenceSchema = z.object({
  relationshipId: z.string().uuid(),
  evidenceId: z.string().uuid(),
  role: EvidenceRoleSchema.default('SUPPORTS')
});
export type RelationshipEvidence = z.infer<typeof RelationshipEvidenceSchema>;

export const RelationshipSchema = z.object({
  id: z.string().uuid(),
  subjectEntityId: z.string().uuid(),
  predicate: RelationshipPredicateSchema,
  objectEntityId: z.string().uuid(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  datePrecision: DatePrecisionSchema.default('DAY'),
  verificationStatus: ReviewStatusSchema.default('PENDING_REVIEW'),
  verificationMethod: z.string().optional().nullable(),
  verifiedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type Relationship = z.infer<typeof RelationshipSchema>;

// ============================================================================
// CONTRATO MÍNIMO DO HERMES ADAPTER (M0)
// ============================================================================

export const HermesTaskTypeSchema = z.enum([
  'EXPLAIN_RELATIONSHIP',
  'SUMMARIZE_DOCUMENT',
  'COMPARE_SOURCES'
]);
export type HermesTaskType = z.infer<typeof HermesTaskTypeSchema>;

export const HermesStatementSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['DOCUMENTED_RECORD', 'INTERPRETATION', 'LIMITATION']),
  evidenceIds: z.array(z.string().uuid()).default([]),
  limitations: z.array(z.string()).default([])
});
export type HermesStatement = z.infer<typeof HermesStatementSchema>;

export const HermesAnalysisOutputSchema = z.object({
  summary: z.string().min(1),
  statements: z.array(HermesStatementSchema).min(1),
  candidateRelationships: z.array(z.record(z.any())).default([]),
  contradictions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  suggestedActions: z.array(z.string()).default([]),
  coverage: z.object({
    sourcesUsed: z.array(z.string()).min(1),
    sourcesUnavailable: z.array(z.string()).default([])
  })
});
export type HermesAnalysisOutput = z.infer<typeof HermesAnalysisOutputSchema>;

export const HermesRunInputSchema = z.object({
  runId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  taskType: HermesTaskTypeSchema,
  targetEntityId: z.string().uuid().optional(),
  targetRelationshipId: z.string().uuid().optional(),
  targetDocumentId: z.string().uuid().optional(),
  allowedToolNames: z.array(z.string()).min(1),
  maxTokens: z.number().int().positive().default(4000),
  timeoutSeconds: z.number().int().positive().default(120)
});
export type HermesRunInput = z.infer<typeof HermesRunInputSchema>;

export type HermesStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface HermesStatusResponse {
  runId: string;
  status: HermesStatus;
  progressPercent: number;
  currentStepDescription?: string;
  toolCallsCount: number;
}

export interface HermesAdapter {
  startAnalysis(input: HermesRunInput): Promise<{ runId: string }>;
  getAnalysisStatus(runId: string): Promise<HermesStatusResponse>;
  cancelAnalysis(runId: string): Promise<void>;
  getAnalysisResult(runId: string): Promise<HermesAnalysisOutput>;
}

export class M0MockHermesAdapter implements HermesAdapter {
  private runs = new Map<string, {
    status: HermesStatus;
    input: HermesRunInput;
  }>();

  async startAnalysis(input: HermesRunInput): Promise<{ runId: string }> {
    this.runs.set(input.runId, {
      status: 'RUNNING',
      input
    });
    return { runId: input.runId };
  }

  async getAnalysisStatus(runId: string): Promise<HermesStatusResponse> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Analysis run ${runId} não encontrada.`);
    return {
      runId,
      status: run.status,
      progressPercent: run.status === 'SUCCEEDED' ? 100 : 50,
      toolCallsCount: 2
    };
  }

  async cancelAnalysis(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) run.status = 'CANCELLED';
  }

  async getAnalysisResult(runId: string): Promise<HermesAnalysisOutput> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Analysis run ${runId} não encontrada.`);

    const sampleOutput: HermesAnalysisOutput = {
      summary: 'Resumo factual obtido a partir dos registros documentados.',
      statements: [
        {
          text: 'O registro documental comprova que o diretor foi eleito em ata.',
          kind: 'DOCUMENTED_RECORD',
          evidenceIds: ['44444444-4444-4444-4444-444444444444'],
          limitations: []
        }
      ],
      candidateRelationships: [],
      contradictions: [],
      openQuestions: [],
      suggestedActions: ['Verificar publicações posteriores'],
      coverage: {
        sourcesUsed: ['DIARIO_OFICIAL_DEMO'],
        sourcesUnavailable: []
      }
    };

    return HermesAnalysisOutputSchema.parse(sampleOutput);
  }
}
