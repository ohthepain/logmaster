-- Keep event-time member identity and roles after subsequent edits or removal.
ALTER TABLE boat_activity ADD COLUMN "memberEmail" TEXT,
  ADD COLUMN "memberRole" TEXT, ADD COLUMN "previousMemberRole" TEXT;

-- Existing memberships can supply an email, but historical roles cannot be inferred.
UPDATE boat_activity a SET "memberEmail" = u.email
FROM boat_member m JOIN "user" u ON u.id = m."userId"
WHERE a."resourceType" = 'boat_member' AND a."resourceId" = m.id
  AND a."boatId" = m."boatId";

CREATE OR REPLACE FUNCTION capture_boat_activity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE d JSONB; b TEXT; r TEXT; rid TEXT; label TEXT; target TEXT; version TEXT;
  category TEXT; action TEXT; member_email TEXT; previous_role TEXT; doc RECORD; share RECORD; source RECORD; dest RECORD;
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
      category := 'MEMBER';
      SELECT name, email INTO label, member_email FROM "user" WHERE id = d->>'userId';
      IF TG_OP = 'UPDATE' THEN previous_role := to_jsonb(OLD)->>'role'; END IF;
    WHEN 'boat_share' THEN category := 'SHARE'; label := COALESCE(d->>'label', '#' || ((d->>'sequence')::INT + 1)::TEXT);
    WHEN 'boat_share_owner' THEN
      SELECT * INTO share FROM boat_share WHERE id = d->>'shareId';
      IF NOT FOUND THEN RETURN NULL; END IF;
      b := share."boatId"; r := 'boat_share'; rid := share.id;
      category := 'SHARE'; action := 'UPDATED'; label := COALESCE(share.label, '#' || (share.sequence + 1)::TEXT);
    ELSE RETURN NULL;
  END CASE;
  PERFORM record_boat_activity(b, category || '_' || action, r, rid, label, target, version);
  IF category = 'MEMBER' THEN
    UPDATE boat_activity SET "memberEmail" = member_email, "memberRole" = d->>'role',
      "previousMemberRole" = CASE WHEN kind = 'MEMBER_UPDATED'
        THEN COALESCE("previousMemberRole", previous_role) ELSE NULL END
    WHERE "boatId" = b AND "resourceType" = r AND "resourceId" = rid
      AND "transactionId" = txid_current()::TEXT
      AND (kind = category || '_' || action OR (action = 'UPDATED' AND kind = 'MEMBER_ADDED'));
  END IF;
  RETURN NULL;
END $$;
