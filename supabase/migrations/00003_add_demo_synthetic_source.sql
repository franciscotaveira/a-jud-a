-- Adicionar DEMO_SYNTHETIC ao enum source_type_enum se ainda não existir
DO $$
BEGIN
    ALTER TYPE source_type_enum ADD VALUE IF NOT EXISTS 'DEMO_SYNTHETIC';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
