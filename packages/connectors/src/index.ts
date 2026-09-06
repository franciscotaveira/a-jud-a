import type {
  SourceArtifact,
  Entity,
  Relationship,
  Evidence
} from '@pig-br/contracts';

export interface EntityQuery {
  scheme: 'CNPJ' | 'NAME' | 'PROCESS_CNJ';
  value: string;
}

export interface SupportResult {
  supported: boolean;
  reason?: string;
}

export interface ConnectorCapabilities {
  supportsCnpj: boolean;
  supportsName: boolean;
  returnsRelationships: boolean;
  returnsDocuments: boolean;
  requiresAuthentication: boolean;
  rateLimitPerMinute?: number;
}

export interface ConnectorContext {
  timeoutMs: number;
  correlationId: string;
}

export interface ConnectorFetchResult {
  artifact: SourceArtifact;
  rawPayload: unknown;
}

export interface NormalizedBatch {
  entities: Entity[];
  relationships: Relationship[];
  evidences: Evidence[];
}

export interface PublicDataConnector {
  id: string;
  version: string;
  capabilities: ConnectorCapabilities;

  supports(query: EntityQuery): SupportResult;

  fetch(
    query: EntityQuery,
    context: ConnectorContext
  ): Promise<ConnectorFetchResult>;

  normalize(
    artifact: SourceArtifact,
    rawPayload: unknown
  ): Promise<NormalizedBatch>;
}
