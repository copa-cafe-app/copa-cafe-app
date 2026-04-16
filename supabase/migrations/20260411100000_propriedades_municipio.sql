-- Add municipio to propriedades so weather can be fetched per farm location
ALTER TABLE propriedades ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE propriedades ADD COLUMN IF NOT EXISTS estado TEXT;

-- Backfill existing propriedades from user's municipio/estado
UPDATE propriedades p
SET municipio = u.municipio, estado = u.estado
FROM users u
WHERE p.produtor_id = u.id AND p.municipio IS NULL;
