import { Pool } from 'pg';

export interface EntityFactInfo {
  fieldName: string;
  value: string;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface EntityDetailInfo {
  id: string;
  canonicalName: string;
  entityType: string;
  jurisdiction: string;
  identifiers: Array<{ scheme: string; normalizedValue: string }>;
  facts: EntityFactInfo[];
}

export interface EvidenceInfo {
  evidenceId: string;
  role: string;
  excerpt: string;
  locator: {
    page?: number | null;
    section?: string | null;
    exactText?: string;
  };
  extractionMethod: string;
  reviewStatus: string;
  documentTitle: string;
  documentType: string;
  artifactSha256: string;
  sourceName: string;
}

export interface RelationshipDetailInfo {
  id: string;
  subjectEntityId: string;
  subjectName: string;
  subjectType: string;
  predicate: string;
  objectEntityId: string;
  objectName: string;
  objectType: string;
  verificationStatus: string;
  evidences: EvidenceInfo[];
}

export class HermesDomainTools {
  constructor(private pool: Pool) {}

  /**
   * Recupera os dados cadastrais, identificadores e fatos documentados de uma entidade.
   */
  async getEntity(entityId: string): Promise<EntityDetailInfo | null> {
    const entityRes = await this.pool.query(`
      SELECT id, canonical_name, entity_type, jurisdiction
      FROM entities WHERE id = $1
    `, [entityId]);

    if (entityRes.rows.length === 0) return null;
    const e = entityRes.rows[0];

    const identRes = await this.pool.query(`
      SELECT scheme, normalized_value
      FROM entity_identifiers WHERE entity_id = $1
    `, [entityId]);

    const factsRes = await this.pool.query(`
      SELECT field_name, value, valid_from, valid_until
      FROM entity_facts WHERE entity_id = $1
    `, [entityId]);

    return {
      id: e.id,
      canonicalName: e.canonical_name,
      entityType: e.entity_type,
      jurisdiction: e.jurisdiction,
      identifiers: identRes.rows.map(r => ({
        scheme: r.scheme,
        normalizedValue: r.normalized_value
      })),
      facts: factsRes.rows.map(r => ({
        fieldName: r.field_name,
        value: r.value,
        validFrom: r.valid_from,
        validUntil: r.valid_until
      }))
    };
  }

  /**
   * Recupera os detalhes da relação com todas as evidências públicas e localizadores conferíveis.
   */
  async getRelationship(relationshipId: string): Promise<RelationshipDetailInfo | null> {
    const relRes = await this.pool.query(`
      SELECT r.id, r.subject_entity_id, r.predicate, r.object_entity_id, r.verification_status,
             s.canonical_name as subject_name, s.entity_type as subject_type,
             o.canonical_name as object_name, o.entity_type as object_type
      FROM relationships r
      JOIN entities s ON r.subject_entity_id = s.id
      JOIN entities o ON r.object_entity_id = o.id
      WHERE r.id = $1
    `, [relationshipId]);

    if (relRes.rows.length === 0) return null;
    const r = relRes.rows[0];

    const evRes = await this.pool.query(`
      SELECT re.evidence_id, re.role,
             e.excerpt, e.locator, e.extraction_method, e.review_status,
             d.title as doc_title, d.document_type,
             a.sha256,
             s.name as source_name
      FROM relationship_evidence re
      JOIN evidence e ON re.evidence_id = e.id
      JOIN documents d ON e.document_id = d.id
      JOIN source_artifacts a ON e.artifact_id = a.id
      JOIN sources s ON a.source_id = s.id
      WHERE re.relationship_id = $1
    `, [relationshipId]);

    return {
      id: r.id,
      subjectEntityId: r.subject_entity_id,
      subjectName: r.subject_name,
      subjectType: r.subject_type,
      predicate: r.predicate,
      objectEntityId: r.object_entity_id,
      objectName: r.object_name,
      objectType: r.object_type,
      verificationStatus: r.verification_status,
      evidences: evRes.rows.map(row => ({
        evidenceId: row.evidence_id,
        role: row.role,
        excerpt: row.excerpt,
        locator: typeof row.locator === 'string' ? JSON.parse(row.locator) : row.locator,
        extractionMethod: row.extraction_method,
        reviewStatus: row.review_status,
        documentTitle: row.doc_title,
        documentType: row.document_type,
        artifactSha256: row.sha256,
        sourceName: row.source_name
      }))
    };
  }

  /**
   * Recupera o texto extraído de um documento indexado.
   */
  async getDocumentExcerpt(documentId: string): Promise<{ id: string; title: string; excerpt: string } | null> {
    const docRes = await this.pool.query(`
      SELECT id, title, extracted_text
      FROM documents WHERE id = $1
    `, [documentId]);

    if (docRes.rows.length === 0) return null;
    const d = docRes.rows[0];
    return {
      id: d.id,
      title: d.title,
      excerpt: (d.extracted_text || '').slice(0, 3000)
    };
  }
}
