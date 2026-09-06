-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00004
-- Correção Incremental de Integridade de Relações e Proteção contra Concorrência
-- 1. Ao transferir suporte (UPDATE), valida tanto OLD.relationship_id quanto NEW.relationship_id
-- 2. Proteção contra remoções/alterações concorrentes através de bloqueio serializado/exclusivo
--    na relação (FOR NO KEY UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_check_single_relationship_support(p_rel_id UUID)
RETURNS VOID AS $$
DECLARE
    v_status review_status_enum;
    v_support_count INTEGER;
BEGIN
    -- Bloqueio exclusivo de linha (FOR NO KEY UPDATE) na relação verificada
    -- Garante que duas transações concorrentes tentando remover/alterar suportes
    -- diferentes da mesma relação sejam serializadas neste ponto, impedindo
    -- que ambas leiam v_support_count = 2 e commitem deixando a relação com 0 suportes.
    SELECT verification_status INTO v_status 
    FROM relationships 
    WHERE id = p_rel_id
    FOR NO KEY UPDATE;

    IF v_status = 'VERIFIED' THEN
        SELECT COUNT(*) INTO v_support_count
        FROM relationship_evidence re
        JOIN evidence e ON e.id = re.evidence_id
        WHERE re.relationship_id = p_rel_id
          AND re.role = 'SUPPORTS'
          AND e.review_status = 'VERIFIED';

        IF v_support_count = 0 THEN
            RAISE EXCEPTION 'VIOLACAO DE INTEGRIDADE: Relacao VERIFIED % exige ao menos uma evidencia VERIFIED com papel SUPPORTS.', 
                p_rel_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_check_verified_relationship_has_support()
RETURNS TRIGGER AS $$
DECLARE
    v_rel_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'relationship_evidence' THEN
        -- Em caso de UPDATE que altera relationship_id (transferência de suporte):
        -- É obrigatório validar AMBAS as pontas (OLD e NEW)!
        IF TG_OP = 'UPDATE' THEN
            IF OLD.relationship_id IS DISTINCT FROM NEW.relationship_id THEN
                PERFORM fn_check_single_relationship_support(OLD.relationship_id);
                PERFORM fn_check_single_relationship_support(NEW.relationship_id);
                RETURN NULL;
            END IF;
            PERFORM fn_check_single_relationship_support(NEW.relationship_id);
            RETURN NULL;
        ELSIF TG_OP = 'DELETE' THEN
            PERFORM fn_check_single_relationship_support(OLD.relationship_id);
            RETURN NULL;
        ELSIF TG_OP = 'INSERT' THEN
            PERFORM fn_check_single_relationship_support(NEW.relationship_id);
            RETURN NULL;
        END IF;
    ELSIF TG_TABLE_NAME = 'relationships' THEN
        PERFORM fn_check_single_relationship_support(NEW.id);
        RETURN NULL;
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
            PERFORM fn_check_single_relationship_support(v_rel_id);
        END LOOP;
        RETURN NULL;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
