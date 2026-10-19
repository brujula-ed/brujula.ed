SET local check_function_bodies = off;

CREATE EXTENSION "vector" SCHEMA "public";

CREATE TABLE "public"."concepts" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"       uuid                     NOT NULL,
  "name"             text                     NOT NULL,
  "description"      text,
  "status"           text                     NOT NULL DEFAULT 'sugerido'::text,
  "prerequisite_ids" uuid[]                   NOT NULL DEFAULT '{}'::uuid[],
  "created_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "concepts_pkey" PRIMARY KEY (id),
  CONSTRAINT "concepts_status_check" CHECK ((status = ANY (ARRAY['sugerido'::text, 'validado'::text])))
);

ALTER TABLE "public"."concepts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."diagnostic_answers" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"     uuid                     NOT NULL,
  "stage"          text                     NOT NULL,
  "question_id"    text                     NOT NULL,
  "concept"        text                     NOT NULL,
  "selected_index" integer                  NOT NULL,
  "correct_index"  integer                  NOT NULL,
  "is_correct"     boolean                  NOT NULL,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "diagnostic_answers_pkey" PRIMARY KEY (id),
  CONSTRAINT "diagnostic_answers_stage_check" CHECK ((stage = ANY (ARRAY['diagnostico'::text, 'microevaluacion'::text])))
);

ALTER TABLE "public"."diagnostic_answers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."diagnostic_attempts" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "subject"      text                     NOT NULL,
  "topic"        text                     NOT NULL,
  "created_at"   timestamp with time zone DEFAULT now(),
  "subject_id"   uuid,
  "completed_at" timestamp with time zone,
  CONSTRAINT "diagnostic_attempts_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."diagnostic_attempts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."document_chunks" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "document_id" uuid                     NOT NULL,
  "subject_id"  uuid                     NOT NULL,
  "content"     text                     NOT NULL,
  "embedding"   public.vector(1536),
  "created_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "document_chunks_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."document_chunks"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."enrollments" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "student_id" uuid                     NOT NULL,
  "subject_id" uuid                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "enrollments_pkey" PRIMARY KEY (id),
  CONSTRAINT "enrollments_student_id_subject_id_key" UNIQUE (student_id, subject_id)
);

ALTER TABLE "public"."enrollments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "full_name"  text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."questions" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"    uuid                     NOT NULL,
  "concept_id"    uuid                     NOT NULL,
  "prompt"        text                     NOT NULL,
  "options"       jsonb                    NOT NULL,
  "correct_index" integer                  NOT NULL,
  "status"        text                     NOT NULL DEFAULT 'sugerido'::text,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "questions_pkey" PRIMARY KEY (id),
  CONSTRAINT "questions_status_check" CHECK ((status = ANY (ARRAY['sugerido'::text, 'validado'::text])))
);

ALTER TABLE "public"."questions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."subject_documents" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "subject_id"   uuid                     NOT NULL,
  "file_name"    text                     NOT NULL,
  "storage_path" text                     NOT NULL,
  "uploaded_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "subject_documents_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."subject_documents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."subjects" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "topic"      text                     NOT NULL,
  "class_code" text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "subjects_class_code_key" UNIQUE (class_code),
  CONSTRAINT "subjects_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."subjects"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."user_role" AS ENUM (
  'estudiante',
  'docente'
);

ALTER TABLE "public"."profiles"
  ADD COLUMN "role" public.user_role NOT NULL DEFAULT 'estudiante'::public.user_role;

CREATE OR REPLACE FUNCTION public.find_subject_id_by_code (
  input_code text
)
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select id from subjects where class_code = input_code;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'estudiante')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_enrolled (
  target_subject_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from enrollments
    where subject_id = target_subject_id and student_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_subject_owner (
  target_subject_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from subjects
    where id = target_subject_id and teacher_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."diagnostic_answers"
  ADD CONSTRAINT "diagnostic_answers_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES public.diagnostic_attempts(id) ON DELETE CASCADE;

ALTER TABLE "public"."diagnostic_attempts"
  ADD CONSTRAINT "diagnostic_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."questions"
  ADD CONSTRAINT "questions_concept_id_fkey" FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE CASCADE;

ALTER TABLE "public"."document_chunks"
  ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.subject_documents(id) ON DELETE CASCADE;

ALTER TABLE "public"."concepts"
  ADD CONSTRAINT "concepts_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."diagnostic_attempts"
  ADD CONSTRAINT "diagnostic_attempts_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."document_chunks"
  ADD CONSTRAINT "document_chunks_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."enrollments"
  ADD CONSTRAINT "enrollments_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."questions"
  ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."subject_documents"
  ADD CONSTRAINT "subject_documents_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."subjects"
  ADD CONSTRAINT "subjects_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX document_chunks_embedding_idx ON public.document_chunks USING hnsw (embedding public.vector_cosine_ops);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Docentes actualizan conceptos de sus asignaturas" ON "public"."concepts"
  FOR UPDATE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes crean conceptos en sus asignaturas" ON "public"."concepts"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes eliminan conceptos de sus asignaturas" ON "public"."concepts"
  FOR DELETE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes ven conceptos de sus asignaturas" ON "public"."concepts"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Estudiantes inscritos ven conceptos validados" ON "public"."concepts"
  FOR SELECT
  TO PUBLIC
  USING (((status = 'validado'::text) AND public.is_enrolled(subject_id)));

CREATE POLICY "Docentes ven respuestas de su asignatura" ON "public"."diagnostic_answers"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.diagnostic_attempts
  WHERE ((diagnostic_attempts.id = diagnostic_answers.attempt_id) AND public.is_subject_owner(diagnostic_attempts.subject_id)))));

CREATE POLICY "Los usuarios crean sus propias respuestas" ON "public"."diagnostic_answers"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.diagnostic_attempts
  WHERE ((diagnostic_attempts.id = diagnostic_answers.attempt_id) AND (diagnostic_attempts.user_id = auth.uid())))));

CREATE POLICY "Los usuarios ven sus propias respuestas" ON "public"."diagnostic_answers"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.diagnostic_attempts
  WHERE ((diagnostic_attempts.id = diagnostic_answers.attempt_id) AND (diagnostic_attempts.user_id = auth.uid())))));

CREATE POLICY "Docentes ven intentos de su asignatura" ON "public"."diagnostic_attempts"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Los usuarios actualizan sus propios intentos" ON "public"."diagnostic_attempts"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Los usuarios crean sus propios intentos" ON "public"."diagnostic_attempts"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Los usuarios ven sus propios intentos" ON "public"."diagnostic_attempts"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "Docentes crean chunks de sus asignaturas" ON "public"."document_chunks"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes eliminan chunks de sus asignaturas" ON "public"."document_chunks"
  FOR DELETE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes ven chunks de sus asignaturas" ON "public"."document_chunks"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes ven inscripciones de sus asignaturas" ON "public"."enrollments"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Estudiantes se inscriben ellos mismos" ON "public"."enrollments"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = student_id));

CREATE POLICY "Estudiantes ven sus propias inscripciones" ON "public"."enrollments"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = student_id));

CREATE POLICY "Docentes ven perfiles de sus estudiantes inscritos" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM (public.enrollments e
     JOIN public.subjects s ON ((s.id = e.subject_id)))
  WHERE ((e.student_id = profiles.id) AND (s.teacher_id = auth.uid())))));

CREATE POLICY "Los usuarios actualizan su propio perfil" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "Los usuarios ven su propio perfil" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "Docentes actualizan preguntas de sus asignaturas" ON "public"."questions"
  FOR UPDATE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes crean preguntas en sus asignaturas" ON "public"."questions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes eliminan preguntas de sus asignaturas" ON "public"."questions"
  FOR DELETE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes ven preguntas de sus asignaturas" ON "public"."questions"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Estudiantes inscritos ven preguntas validadas" ON "public"."questions"
  FOR SELECT
  TO PUBLIC
  USING (((status = 'validado'::text) AND public.is_enrolled(subject_id)));

CREATE POLICY "Docentes eliminan documentos de sus asignaturas" ON "public"."subject_documents"
  FOR DELETE
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes suben documentos a sus asignaturas" ON "public"."subject_documents"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes ven documentos de sus asignaturas" ON "public"."subject_documents"
  FOR SELECT
  TO PUBLIC
  USING (public.is_subject_owner(subject_id));

CREATE POLICY "Docentes actualizan sus propias asignaturas" ON "public"."subjects"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = teacher_id));

CREATE POLICY "Docentes crean sus propias asignaturas" ON "public"."subjects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = teacher_id));

CREATE POLICY "Docentes eliminan sus propias asignaturas" ON "public"."subjects"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = teacher_id));

CREATE POLICY "Docentes ven sus propias asignaturas" ON "public"."subjects"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = teacher_id));

CREATE POLICY "Estudiantes inscritos ven la asignatura" ON "public"."subjects"
  FOR SELECT
  TO PUBLIC
  USING (public.is_enrolled(id));

CREATE POLICY "Docentes eliminan documentos de sus asignaturas (storage)" ON "storage"."objects"
  FOR DELETE
  TO PUBLIC
  USING (((bucket_id = 'course-documents'::text) AND public.is_subject_owner(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Docentes suben documentos a sus asignaturas" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((bucket_id = 'course-documents'::text) AND public.is_subject_owner(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Docentes ven documentos de sus asignaturas" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING (((bucket_id = 'course-documents'::text) AND public.is_subject_owner(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "Estudiantes inscritos ven documentos de su asignatura" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING (((bucket_id = 'course-documents'::text) AND public.is_enrolled(((storage.foldername(name))[1])::uuid)));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

COMMENT ON EXTENSION "vector" IS 'vector data type and ivfflat and hnsw access methods';

GRANT EXECUTE ON FUNCTION "public"."find_subject_id_by_code"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."find_subject_id_by_code"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."find_subject_id_by_code"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."find_subject_id_by_code"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_enrolled"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_enrolled"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_enrolled"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_enrolled"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_subject_owner"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_subject_owner"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_subject_owner"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_subject_owner"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."concepts" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."concepts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."concepts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."concepts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_answers" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."diagnostic_answers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_answers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_answers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_attempts" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."diagnostic_attempts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_attempts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."diagnostic_attempts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_chunks" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."document_chunks" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_chunks" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."document_chunks" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrollments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."enrollments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrollments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrollments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."questions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."questions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."questions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."questions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subject_documents" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."subject_documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subject_documents" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subject_documents" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."subjects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "service_role";

