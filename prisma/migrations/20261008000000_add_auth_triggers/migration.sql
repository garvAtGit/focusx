-- Add PostgreSQL Triggers to ensure monotonic authRevision increments and RealtimeOutbox generation

-- 1. Function for Library authRevision (Booking mutations)
CREATE OR REPLACE FUNCTION increment_library_auth_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_library_id text;
  v_new_revision int;
BEGIN
  v_library_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."libraryId" ELSE NEW."libraryId" END;
  
  UPDATE "Library" SET "authRevision" = "authRevision" + 1 WHERE id = v_library_id RETURNING "authRevision" INTO v_new_revision;
  
  INSERT INTO "RealtimeOutbox" (id, "eventId", "topic", "payload", "status", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'sync-' || v_library_id || '-' || v_new_revision || '-' || (extract(epoch from now()) * 1000)::bigint::text,
    'library/' || v_library_id || '/auth/revision',
    json_build_object('revision', v_new_revision),
    'PENDING',
    now(),
    now()
  ) ON CONFLICT ("eventId") DO NOTHING;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_auth_revision_on_booking ON "Booking";
CREATE TRIGGER update_auth_revision_on_booking
AFTER INSERT OR UPDATE OR DELETE ON "Booking"
FOR EACH ROW EXECUTE FUNCTION increment_library_auth_revision();

-- 2. Function for User RFID mutation
CREATE OR REPLACE FUNCTION increment_user_auth_revision()
RETURNS TRIGGER AS $$
DECLARE
  v_library_id text;
  v_new_revision int;
BEGIN
  FOR v_library_id IN SELECT DISTINCT "libraryId" FROM "Booking" WHERE "studentId" = NEW.id
  LOOP
    UPDATE "Library" SET "authRevision" = "authRevision" + 1 WHERE id = v_library_id RETURNING "authRevision" INTO v_new_revision;
    
    INSERT INTO "RealtimeOutbox" (id, "eventId", "topic", "payload", "status", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      'sync-' || v_library_id || '-' || v_new_revision || '-' || (extract(epoch from now()) * 1000)::bigint::text,
      'library/' || v_library_id || '/auth/revision',
      json_build_object('revision', v_new_revision),
      'PENDING',
      now(),
      now()
    ) ON CONFLICT ("eventId") DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_auth_revision_on_user ON "User";
CREATE TRIGGER update_auth_revision_on_user
AFTER UPDATE OF "rfidTag" ON "User"
FOR EACH ROW EXECUTE FUNCTION increment_user_auth_revision();
