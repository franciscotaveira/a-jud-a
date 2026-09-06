-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00005
-- Papéis de Segurança da Aplicação e RLS para Leitura Pública vs Protegida
-- 1. Cria papel restrito 'pig_br_api_user' (SEM superusuário, SEM BYPASSRLS)
-- 2. Concede SELECT nas tabelas públicas (entities, relationships, evidence, etc.)
-- 3. Restringe review_queue e connector_runs exclusivamente a operações autenticadas (authenticated_analyst)
-- ============================================================================

DO $do$
BEGIN
    -- Papel da API (conexão da aplicação web pública)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pig_br_api_user') THEN
        CREATE ROLE pig_br_api_user WITH LOGIN PASSWORD 'pig_api_app_restricted_pass_2026' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;

    -- Papel de Analista de Inteligência (operações de escrita / revisão / auditoria)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pig_br_analyst') THEN
        CREATE ROLE pig_br_analyst WITH LOGIN PASSWORD 'pig_analyst_secure_pass_2026' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END
$do$;

-- Garantir USAGE no schema public
GRANT USAGE ON SCHEMA public TO pig_br_api_user, pig_br_analyst;

-- 1. Tabelas Públicas (Leitura liberada sob RLS)
GRANT SELECT ON TABLE 
    entities, 
    entity_identifiers, 
    entity_aliases, 
    entity_facts, 
    sources, 
    source_artifacts, 
    documents, 
    evidence, 
    relationships, 
    relationship_evidence, 
    events, 
    event_entities, 
    event_evidence 
TO pig_br_api_user;

-- Bloquear explicitamente qualquer tentativa de INSERT/UPDATE/DELETE pelo usuário da API
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM pig_br_api_user;

-- 2. Tabelas Protegidas (review_queue e connector_runs exigem papel de analista)
REVOKE ALL ON TABLE review_queue, connector_runs FROM pig_br_api_user;

GRANT SELECT, INSERT, UPDATE ON TABLE review_queue TO pig_br_analyst;
GRANT SELECT, INSERT, UPDATE ON TABLE connector_runs TO pig_br_analyst;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pig_br_analyst;

-- Políticas de RLS para tabelas restritas
CREATE POLICY "Analyst Only Review Queue" ON review_queue
    FOR ALL
    TO pig_br_analyst
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Analyst Only Connector Runs" ON connector_runs
    FOR ALL
    TO pig_br_analyst
    USING (true)
    WITH CHECK (true);
