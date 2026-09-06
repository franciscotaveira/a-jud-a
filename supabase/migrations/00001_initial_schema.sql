-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00001 (Master Spec Aligned)
-- Schema Núcleo: ENTIDADE -> RELAÇÃO -> EVIDÊNCIA -> FONTE
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ----------------------------------------------------------------------------
-- 1. ENTIDADES E IDENTIFICADORES
-- ----------------------------------------------------------------------------

CREATE TYPE entity_type_enum AS ENUM (
    'ORGANIZATION',
    'PERSON',
    'PROCESS',
    'CONTRACT',
    'FUND',
    'AIRCRAFT'
);

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type entity_type_enum NOT NULL DEFAULT 'ORGANIZATION',
    canonical_name TEXT NOT NULL,
    jurisdiction VARCHAR(10) NOT NULL DEFAULT 'BR',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice GIN para busca rápida e fuzzy de homônimos sem acentos
CREATE INDEX idx_entities_canonical_name_trgm ON entities USING gin (canonical_name gin_trgm_ops);

CREATE TABLE entity_identifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    scheme VARCHAR(50) NOT NULL, -- 'CNPJ', 'CPF', 'CVM_CODE', 'BACEN_CODE', etc.
    normalized_value VARCHAR(100) NOT NULL,
    jurisdiction VARCHAR(10) NOT NULL DEFAULT 'BR',
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(scheme, normalized_value)
);

CREATE INDEX idx_entity_identifiers_lookup ON entity_identifiers(scheme, normalized_value);

CREATE TABLE entity_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    evidence_id UUID, -- Chave estrangeira adicionada após criação da tabela evidence
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entity_aliases_lookup ON entity_aliases USING gin (normalized_alias gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 2. FONTES, ARTEFATOS E DOCUMENTOS
-- ----------------------------------------------------------------------------

CREATE TYPE source_type_enum AS ENUM (
    'OFFICIAL_GAZETTE',
    'TAX_REGISTRY',
    'CENTRAL_BANK',
    'SECURITIES_COMM',
    'JUDICIAL_SYSTEM',
    'PUBLIC_PROCUREMENT'
);

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    source_type source_type_enum NOT NULL,
    official BOOLEAN NOT NULL DEFAULT TRUE,
    documentation_url TEXT,
    access_method VARCHAR(100) NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
    connector_run_id UUID,
    source_url TEXT,
    retrieved_at TIMESTAMPTZ NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_artifact_sha256 UNIQUE(sha256)
);

CREATE TYPE date_precision_enum AS ENUM ('DAY', 'MONTH', 'YEAR', 'APPROXIMATE', 'UNKNOWN');

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    published_at TIMESTAMPTZ,
    document_date DATE,
    date_precision date_precision_enum NOT NULL DEFAULT 'DAY',
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. EVIDÊNCIAS E FATOS DE ENTIDADE
-- ----------------------------------------------------------------------------

CREATE TYPE review_status_enum AS ENUM (
    'PENDING_REVIEW',
    'VERIFIED',
    'CONFLICTING',
    'REJECTED'
);

CREATE TYPE extraction_method_enum AS ENUM (
    'DETERMINISTIC_PARSER',
    'MANUAL_EXTRACTION',
    'AI_EXTRACTION'
);

CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES source_artifacts(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    excerpt TEXT NOT NULL,
    locator JSONB NOT NULL, -- { page, section, exact_text, json_path, csv_row_index }
    extraction_method extraction_method_enum NOT NULL,
    review_status review_status_enum NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar FK de entity_aliases para evidence
ALTER TABLE entity_aliases 
    ADD CONSTRAINT fk_aliases_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE SET NULL;

CREATE TABLE entity_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. RELAÇÕES E MULTIEVIDÊNCIA
-- ----------------------------------------------------------------------------

CREATE TYPE relationship_predicate_enum AS ENUM (
    'SHAREHOLDER_OF',
    'DIRECTOR_OF',
    'ADMINISTRATOR_OF',
    'CONTRACTED_WITH',
    'PAID_TO',
    'REPRESENTS',
    'PARTY_IN_CASE',
    'OWNS_AIRCRAFT',
    'OPERATES_AIRCRAFT'
);

CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    predicate relationship_predicate_enum NOT NULL,
    object_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    date_precision date_precision_enum NOT NULL DEFAULT 'DAY',
    verification_status review_status_enum NOT NULL DEFAULT 'PENDING_REVIEW',
    verification_method VARCHAR(100),
    verified_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_relationship CHECK (subject_entity_id <> object_entity_id)
);

CREATE TYPE evidence_role_enum AS ENUM (
    'SUPPORTS',
    'CONTRADICTS',
    'CONTEXTUALIZES'
);

CREATE TABLE relationship_evidence (
    relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    role evidence_role_enum NOT NULL DEFAULT 'SUPPORTS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(relationship_id, evidence_id)
);

-- ----------------------------------------------------------------------------
-- 5. EVENTOS E CRONOLOGIA DOCUMENTAL
-- ----------------------------------------------------------------------------

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    occurred_from TIMESTAMPTZ,
    occurred_until TIMESTAMPTZ,
    date_precision date_precision_enum NOT NULL DEFAULT 'DAY',
    verification_status review_status_enum NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE event_entities (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(event_id, entity_id)
);

CREATE TABLE event_evidence (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    role evidence_role_enum NOT NULL DEFAULT 'SUPPORTS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(event_id, evidence_id)
);

-- ----------------------------------------------------------------------------
-- 6. EXECUÇÕES DE CONECTOR E FILA DE REVISÃO
-- ----------------------------------------------------------------------------

CREATE TYPE job_status_enum AS ENUM (
    'QUEUED',
    'RUNNING',
    'WAITING_REVIEW',
    'SUCCEEDED',
    'PARTIAL',
    'FAILED',
    'CANCELLED'
);

CREATE TABLE connector_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id VARCHAR(100) NOT NULL,
    entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    status job_status_enum NOT NULL DEFAULT 'QUEUED',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    records_found INTEGER NOT NULL DEFAULT 0,
    error_code VARCHAR(100),
    sanitized_error TEXT,
    connector_version VARCHAR(50) NOT NULL,
    normalization_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE review_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_type VARCHAR(50) NOT NULL,
    item_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status review_status_enum NOT NULL DEFAULT 'PENDING_REVIEW',
    resolution TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. POLÍTICAS DE ACESSO E RLS (ROW LEVEL SECURITY)
-- ----------------------------------------------------------------------------

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

-- Leitura pública para o catálogo de dados públicos
CREATE POLICY "Public Read Entities" ON entities FOR SELECT USING (true);
CREATE POLICY "Public Read Identifiers" ON entity_identifiers FOR SELECT USING (true);
CREATE POLICY "Public Read Aliases" ON entity_aliases FOR SELECT USING (true);
CREATE POLICY "Public Read Facts" ON entity_facts FOR SELECT USING (true);
CREATE POLICY "Public Read Sources" ON sources FOR SELECT USING (true);
CREATE POLICY "Public Read Documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Public Read Evidence" ON evidence FOR SELECT USING (true);
CREATE POLICY "Public Read Relationships" ON relationships FOR SELECT USING (true);
CREATE POLICY "Public Read Relationship Evidence" ON relationship_evidence FOR SELECT USING (true);
CREATE POLICY "Public Read Events" ON events FOR SELECT USING (true);
CREATE POLICY "Public Read Event Entities" ON event_entities FOR SELECT USING (true);
CREATE POLICY "Public Read Event Evidence" ON event_evidence FOR SELECT USING (true);

-- REGULAMENTO DE SEGURANÇA:
-- Escrita (INSERT, UPDATE, DELETE) é RESTRITA exclusivamente a processos autorizados (service_role).
-- Nenhum cliente anônimo ou frontend pode alterar entidades, relacionamentos ou evidências.
