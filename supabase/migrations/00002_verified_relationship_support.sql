-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00002
-- Integridade Rígida de Relações: Exigência de Evidência SUPPORTS para VERIFIED
-- ============================================================================

-- Função e Trigger diferidos (CONSTRAINT TRIGGER DEFERRABLE)
-- Permite que relações e seus vínculos de evidência sejam inseridos na mesma transação,
-- avaliando a integridade estrita no momento do COMMIT da transação.

CREATE OR REPLACE FUNCTION fn_check_verified_relationship_has_support()
RETURNS TRIGGER AS $$
DECLARE
    v_status review_status_enum;
    v_support_count INTEGER;
BEGIN
    -- Se o trigger foi disparado por alteração em relationship_evidence
    IF TG_TABLE_NAME = 'relationship_evidence' THEN
        -- Obter o status da relação
        SELECT verification_status INTO v_status 
        FROM relationships 
        WHERE id = COALESCE(NEW.relationship_id, OLD.relationship_id);

        -- Se a relação for VERIFIED, conferir se ainda existe ao menos 1 evidência de SUPPORTS
        IF v_status = 'VERIFIED' THEN
            SELECT COUNT(*) INTO v_support_count
            FROM relationship_evidence re
            JOIN evidence e ON e.id = re.evidence_id
            WHERE re.relationship_id = COALESCE(NEW.relationship_id, OLD.relationship_id)
              AND re.role = 'SUPPORTS'
              AND e.review_status = 'VERIFIED';

            IF v_support_count = 0 THEN
                RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Relacao VERIFIED % exige ao menos uma evidencia VERIFIED com papel SUPPORTS.', 
                    COALESCE(NEW.relationship_id, OLD.relationship_id)
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;

    -- Se o trigger foi disparado por inserção ou atualização na tabela relationships
    ELSIF TG_TABLE_NAME = 'relationships' THEN
        IF NEW.verification_status = 'VERIFIED' THEN
            SELECT COUNT(*) INTO v_support_count
            FROM relationship_evidence re
            JOIN evidence e ON e.id = re.evidence_id
            WHERE re.relationship_id = NEW.id
              AND re.role = 'SUPPORTS'
              AND e.review_status = 'VERIFIED';

            IF v_support_count = 0 THEN
                RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Relacao VERIFIED % exige ao menos uma evidencia VERIFIED com papel SUPPORTS.', 
                    NEW.id
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;

    -- Se o trigger foi disparado por atualização na tabela evidence (ex: evidência deixou de ser VERIFIED)
    ELSIF TG_TABLE_NAME = 'evidence' THEN
        IF OLD.review_status = 'VERIFIED' AND NEW.review_status <> 'VERIFIED' THEN
            IF EXISTS (
                SELECT 1 
                FROM relationship_evidence re
                JOIN relationships r ON r.id = re.relationship_id
                WHERE re.evidence_id = NEW.id
                  AND re.role = 'SUPPORTS'
                  AND r.verification_status = 'VERIFIED'
                  AND (
                      SELECT COUNT(*) 
                      FROM relationship_evidence re2
                      JOIN evidence e2 ON e2.id = re2.evidence_id
                      WHERE re2.relationship_id = r.id
                        AND re2.role = 'SUPPORTS'
                        AND e2.review_status = 'VERIFIED'
                        AND e2.id <> NEW.id
                  ) = 0
            ) THEN
                RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Evidencia % sustenta relacoes VERIFIED e nao pode ser desqualificada sem evidência substituta.', 
                    NEW.id
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 1. Trigger na tabela relationships (inserção ou atualização de status)
DROP TRIGGER IF EXISTS trg_check_relationship_support ON relationships;
CREATE CONSTRAINT TRIGGER trg_check_relationship_support
    AFTER INSERT OR UPDATE OF verification_status ON relationships
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();

-- 2. Trigger na tabela relationship_evidence (inserção, exclusão ou alteração de role)
DROP TRIGGER IF EXISTS trg_check_rel_evidence_support ON relationship_evidence;
CREATE CONSTRAINT TRIGGER trg_check_rel_evidence_support
    AFTER INSERT OR UPDATE OR DELETE ON relationship_evidence
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();

-- 3. Trigger na tabela evidence (caso a evidência seja rebaixada de VERIFIED)
DROP TRIGGER IF EXISTS trg_check_evidence_demotion ON evidence;
CREATE CONSTRAINT TRIGGER trg_check_evidence_demotion
    AFTER UPDATE OF review_status ON evidence
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();
