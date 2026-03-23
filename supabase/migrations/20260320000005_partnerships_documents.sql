-- ─── Partnerships Module — Document Vault ────────────────────────────────────
-- Tables: pt_documents
-- Phase 6
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE pt_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  investment_id uuid REFERENCES pt_investments(id) ON DELETE SET NULL,
  name          text NOT NULL,
  doc_type      text NOT NULL DEFAULT 'other'
                CHECK (doc_type IN ('k1','operating_agreement','subscription_agreement','tax_return','receipt','contract','statement','other')),
  storage_path  text NOT NULL,
  file_size     bigint,
  mime_type     text,
  tax_year      int,
  uploaded_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_select" ON pt_documents
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "docs_insert" ON pt_documents
  FOR INSERT WITH CHECK (is_entity_member(entity_id));

CREATE POLICY "docs_delete" ON pt_documents
  FOR DELETE USING (entity_member_role(entity_id) = 'admin'
    OR uploaded_by = auth.uid()
  );

CREATE INDEX pt_documents_entity_id_idx ON pt_documents (entity_id);
CREATE INDEX pt_documents_investment_id_idx ON pt_documents (investment_id);

-- ─── Add FK for receipt_document_id on pt_transactions ───────────────────────
ALTER TABLE pt_transactions
  ADD CONSTRAINT fk_txn_receipt_doc
  FOREIGN KEY (receipt_document_id) REFERENCES pt_documents(id) ON DELETE SET NULL;
