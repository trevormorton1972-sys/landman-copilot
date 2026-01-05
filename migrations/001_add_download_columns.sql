-- Add missing columns to document_reviews table for download tracking

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_reviews' AND column_name = 'downloaded_at') THEN
    ALTER TABLE document_reviews ADD COLUMN downloaded_at TIMESTAMP;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_reviews' AND column_name = 'file_path') THEN
    ALTER TABLE document_reviews ADD COLUMN file_path VARCHAR(500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_reviews_downloaded ON document_reviews(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_document_reviews_marked ON document_reviews(marked_for_download);
