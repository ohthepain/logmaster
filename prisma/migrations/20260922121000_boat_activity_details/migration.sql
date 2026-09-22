-- Match the one-based share numbers displayed throughout the app.
CREATE OR REPLACE FUNCTION capture_boat_activity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
    WHEN 'boat_share' THEN category := 'SHARE'; label := COALESCE(d->>'label', '#' || ((d->>'sequence')::INT + 1)::TEXT);
    WHEN 'boat_share_owner' THEN
      SELECT * INTO share FROM boat_share WHERE id = d->>'shareId';
      IF NOT FOUND THEN RETURN NULL; END IF;
      b := share."boatId"; r := 'boat_share'; rid := share.id;
      category := 'SHARE'; action := 'UPDATED'; label := COALESCE(share.label, '#' || (share.sequence + 1)::TEXT);
    ELSE RETURN NULL;
  END CASE;
  PERFORM record_boat_activity(b, category || '_' || action, r, rid, label, target, version);
  RETURN NULL;
END $$;


-- Preserve connection names before an asset deletion cascades into its links.
CREATE FUNCTION capture_boat_asset_disconnects() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE connection RECORD;
BEGIN
  FOR connection IN
    SELECT c.id, c."boatId", a.name AS source_name, z.name AS target_name,
      (a.kind = 'system_network' OR z.kind = 'system_network') AS network
    FROM asset_connection c
    JOIN boat_asset a ON a.id = c."fromAssetId"
    JOIN boat_asset z ON z.id = c."toAssetId"
    WHERE c."fromAssetId" = OLD.id OR c."toAssetId" = OLD.id
  LOOP
    PERFORM record_boat_activity(connection."boatId",
      CASE WHEN connection.network THEN 'NETWORK_DISCONNECTED' ELSE 'ASSET_DISCONNECTED' END,
      'asset_connection', connection.id, connection.source_name, connection.target_name);
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER boat_chat_disconnects BEFORE DELETE ON boat_asset
  FOR EACH ROW EXECUTE FUNCTION capture_boat_asset_disconnects();

ALTER TABLE boat_activity DROP CONSTRAINT "boat_activity_boatId_fkey";
ALTER TABLE boat_activity ADD CONSTRAINT "boat_activity_boatId_fkey"
  FOREIGN KEY ("boatId") REFERENCES boat(id) ON DELETE CASCADE ON UPDATE CASCADE;
