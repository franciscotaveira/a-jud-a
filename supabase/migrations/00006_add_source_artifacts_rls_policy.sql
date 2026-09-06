-- ============================================================================
-- Public Intelligence Graph Brasil — Migration 00006
-- Adicionar Política de RLS ausente para source_artifacts
-- ============================================================================

DROP POLICY IF EXISTS "Public Read Source Artifacts" ON source_artifacts;
CREATE POLICY "Public Read Source Artifacts" ON source_artifacts FOR SELECT USING (true);
