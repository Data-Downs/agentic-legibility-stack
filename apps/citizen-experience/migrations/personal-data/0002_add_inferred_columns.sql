-- Add mentions and superseded_by columns to inferred_data
-- Required by @als/personal-data InferredStore
ALTER TABLE inferred_data ADD COLUMN mentions INTEGER NOT NULL DEFAULT 1;
ALTER TABLE inferred_data ADD COLUMN superseded_by TEXT;
