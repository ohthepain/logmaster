-- Capture persisted changes from every writer, including jobs and invite acceptance.
-- No backfill: historical removals and edits cannot be reconstructed accurately.
CREATE TABLE "boat_activity" (
  "id" TEXT PRIMARY KEY, "boatId" TEXT NOT NULL REFERENCES "boat"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL, "resourceType" TEXT NOT NULL, "resourceId" TEXT NOT NULL,
  "label" TEXT NOT NULL, "targetLabel" TEXT, "versionId" TEXT,
  "transactionId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "boat_activity_change_key"
  ON "boat_activity"("boatId", "kind", "resourceType", "resourceId", "transactionId");
CREATE INDEX "boat_activity_boatId_createdAt_idx" ON "boat_activity"("boatId", "createdAt");
ALTER TABLE "chat_message" ADD COLUMN "boatActivityId" TEXT;
CREATE UNIQUE INDEX "chat_message_boatActivityId_key" ON "chat_message"("boatActivityId");
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_boatActivityId_fkey"
  FOREIGN KEY ("boatActivityId") REFERENCES "boat_activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION record_boat_activity(b TEXT, k TEXT, r TEXT, rid TEXT, p_label TEXT,
  p_target TEXT DEFAULT NULL, p_version TEXT DEFAULT NULL) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE activity_id TEXT; tx TEXT := txid_current()::TEXT;
BEGIN
  -- The parent is already absent during a boat-delete cascade. Do not resurrect history.
  IF NOT EXISTS (SELECT 1 FROM boat WHERE id = b) THEN RETURN; END IF;
  IF k LIKE '%_UPDATED' THEN
    UPDATE boat_activity SET "label" = COALESCE(p_label, ''), "versionId" = COALESCE(p_version, "versionId")
    WHERE "boatId" = b AND "resourceType" = r AND "resourceId" = rid
      AND "transactionId" = tx AND kind = replace(k, '_UPDATED', '_ADDED')
    RETURNING id INTO activity_id;
    IF activity_id IS NOT NULL THEN RETURN; END IF;
  END IF;
  INSERT INTO boat_activity (id, "boatId", kind, "resourceType", "resourceId", "label", "targetLabel", "versionId", "transactionId", "createdAt")
  VALUES (gen_random_uuid()::TEXT, b, k, r, rid, COALESCE(p_label, ''), p_target, p_version, tx, clock_timestamp())
  ON CONFLICT ("boatId", kind, "resourceType", "resourceId", "transactionId") DO UPDATE
    SET "label" = EXCLUDED."label", "targetLabel" = EXCLUDED."targetLabel",
        "versionId" = COALESCE(EXCLUDED."versionId", boat_activity."versionId")
  RETURNING id INTO activity_id;
  INSERT INTO chat_message (id, "threadId", "senderId", text, "references", "boatActivityId", "createdAt")
  VALUES (gen_random_uuid()::TEXT, 'boat:' || b, 'system:boat', '', '[]'::JSONB, activity_id, clock_timestamp())
  ON CONFLICT ("boatActivityId") DO NOTHING;
END $$;

CREATE FUNCTION capture_boat_activity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE d JSONB; b TEXT; r TEXT; rid TEXT; label TEXT; target TEXT; version TEXT;
  category TEXT; action TEXT; doc RECORD; share RECORD; source RECORD; dest RECORD;
BEGIN
  d := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_OP = 'UPDATE' AND
    (to_jsonb(OLD) - ARRAY['updatedAt','sortOrder','isDefault','sequence','previewS3Key']) =
    (d - ARRAY['updatedAt','sortOrder','isDefault','sequence','previewS3Key']) THEN RETURN NULL; END IF;
  b := d->>'boatId'; rid := d->>'id'; r := TG_TABLE_NAME;
  action := CASE TG_OP WHEN 'INSERT' THEN 'ADDED' WHEN 'DELETE' THEN 'REMOVED' ELSE 'UPDATED' END;
  CASE TG_TABLE_NAME
    WHEN 'boat_photo' THEN
      IF TG_OP = 'UPDATE' THEN RETURN NULL; END IF;
      category := 'MEDIA'; label := d->>'caption';
    WHEN 'boat_document' THEN
      category := CASE WHEN d->>'purpose' = 'photo' THEN 'MEDIA' ELSE 'DOCUMENT' END;
      label := d->>'title';
      SELECT id INTO version FROM boat_document_version WHERE "documentId" = rid ORDER BY "versionNumber" DESC LIMIT 1;
    WHEN 'boat_document_version' THEN
      IF TG_OP <> 'INSERT' THEN RETURN NULL; END IF;
      SELECT * INTO doc FROM boat_document WHERE id = d->>'documentId';
      IF NOT FOUND THEN RETURN NULL; END IF;
      b := doc."boatId"; r := 'boat_document'; rid := doc.id; label := doc.title; version := d->>'id';
      category := CASE WHEN doc.purpose = 'photo' THEN 'MEDIA' ELSE 'DOCUMENT' END;
      action := CASE WHEN (d->>'versionNumber')::INT = 1 THEN 'ADDED' ELSE 'UPDATED' END;
    WHEN 'boat_asset' THEN
      IF d->>'kind' = 'system_network' THEN RETURN NULL; END IF;
      category := 'ASSET'; label := d->>'name';
    WHEN 'asset_connection' THEN
      IF TG_OP = 'UPDATE' THEN RETURN NULL; END IF;
      SELECT * INTO source FROM boat_asset WHERE id = d->>'fromAssetId';
      SELECT * INTO dest FROM boat_asset WHERE id = d->>'toAssetId';
      -- An asset cascade removes links after the endpoint has gone. Its removal event already explains this.
      IF source.id IS NULL OR dest.id IS NULL THEN RETURN NULL; END IF;
      category := CASE WHEN source.kind = 'system_network' OR dest.kind = 'system_network' THEN 'NETWORK' ELSE 'ASSET' END;
      label := source.name; target := dest.name;
      action := CASE TG_OP WHEN 'INSERT' THEN 'CONNECTED' ELSE 'DISCONNECTED' END;
    WHEN 'boat_purchase' THEN
      IF TG_OP = 'UPDATE' THEN RETURN NULL; END IF;
      category := 'PURCHASE'; label := d->>'supplierName';
    WHEN 'boat_contact' THEN category := 'CONTACT'; label := d->>'displayName';
    WHEN 'boat_member' THEN
      category := 'MEMBER'; SELECT name INTO label FROM "user" WHERE id = d->>'userId';
    WHEN 'boat_share' THEN category := 'SHARE'; label := COALESCE(d->>'label', '#' || (d->>'sequence'));
    WHEN 'boat_share_owner' THEN
      SELECT * INTO share FROM boat_share WHERE id = d->>'shareId';
      IF NOT FOUND THEN RETURN NULL; END IF;
      b := share."boatId"; r := 'boat_share'; rid := share.id;
      category := 'SHARE'; action := 'UPDATED'; label := COALESCE(share.label, '#' || share.sequence::TEXT);
    ELSE RETURN NULL;
  END CASE;
  PERFORM record_boat_activity(b, category || '_' || action, r, rid, label, target, version);
  RETURN NULL;
END $$;

DO $$ DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['boat_photo','boat_document','boat_document_version','boat_asset',
    'asset_connection','boat_purchase','boat_contact','boat_member','boat_share','boat_share_owner']
  LOOP
    EXECUTE format('CREATE TRIGGER boat_chat_activity AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION capture_boat_activity()', table_name);
  END LOOP;
END $$;
