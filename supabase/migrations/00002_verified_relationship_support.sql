-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00002
-- Integridade Rígida de Relações: Exigência de Evidência SUPPORTS para VERIFIED
-- Suporte robusto a transferência atômica e concorrência (FOR SHARE lock)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_check_verified_relationship_has_support()
RETURNS TRIGGER AS $$
DECLARE
    v_rel_id UUID;
    v_status review_status_enum;
    v_support_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'relationship_evidence' THEN
        v_rel_id := COALESCE(NEW.relationship_id, OLD.relationship_id);
    ELSIF TG_TABLE_NAME = 'relationships' THEN
        v_rel_id := NEW.id;
    ELSIF TG_TABLE_NAME = 'evidence' THEN
        -- Se uma evidência for desqualificada ou alterada
        FOR v_rel_id IN
            SELECT re.relationship_id 
            FROM relationship_evidence re
            JOIN relationships r ON r.id = re.relationship_id
            WHERE re.evidence_id = NEW.id 
              AND re.role = 'SUPPORTS' 
              AND r.verification_status = 'VERIFIED'
        LOOP
            SELECT COUNT(*) INTO v_support_count
            FROM relationship_evidence re
            JOIN evidence e ON e.id = re.evidence_id
            WHERE re.relationship_id = v_rel_id
              AND re.role = 'SUPPORTS'
              AND e.review_status = 'VERIFIED';

            IF v_support_count = 0 THEN
                RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Relacao VERIFIED % perdeu suporte valido.', v_rel_id
                    USING ERRCODE = 'check_violation';
            END IF;
        END LOOP;
        RETURN NULL;
    END IF;

    -- Avaliação da relação com lock de linha para prevenir anomalias de concorrência
    SELECT verification_status INTO v_status 
    FROM relationships 
    WHERE id = v_rel_id
    FOR SHARE;

    IF v_status = 'VERIFIED' THEN
        SELECT COUNT(*) INTO v_support_count
        FROM relationship_evidence re
        JOIN evidence e ON e.id = re.evidence_id
        WHERE re.relationship_id = v_rel_id
          AND re.role = 'SUPPORTS'
          AND e.review_status = 'VERIFIED';

        IF v_support_count = 0 THEN
            RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Relacao VERIFIED % exige ao menos uma evidencia VERIFIED com papel SUPPORTS.', 
                v_rel_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger deferível na tabela relationships
DROP TRIGGER IF EXISTS trg_check_relationship_support ON relationships;
CREATE CONSTRAINT TRIGGER trg_check_relationship_support
    AFTER INSERT OR UPDATE OF verification_status ON relationships
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();

-- Trigger deferível na tabela relationship_evidence
DROP TRIGGER IF EXISTS trg_check_rel_evidence_support ON relationship_evidence;
CREATE CONSTRAINT TRIGGER trg_check_rel_evidence_support
    AFTER INSERT OR UPDATE OR DELETE ON relationship_evidence
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();

-- Trigger deferível na tabela evidence
DROP TRIGGER IF EXISTS trg_check_evidence_demotion ON evidence;
CREATE CONSTRAINT TRIGGER trg_check_evidence_demotion
    AFTER UPDATE OF review_status ON evidence
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_verified_relationship_has_support();
