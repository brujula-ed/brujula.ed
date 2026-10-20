-- M2: cierra las dos vías por las que un estudiante podía inflar sus resultados.
-- Requiere que el código que usa get_diagnostic_questions y submit_answer ya esté desplegado.

-- 1) Los estudiantes ya no leen "questions" (incluía correct_index). Ahora usan get_diagnostic_questions.
--    El docente sigue viendo sus preguntas con la política "Docentes ven preguntas de sus asignaturas".
drop policy if exists "Estudiantes inscritos ven preguntas validadas" on public.questions;

-- 2) Nadie inserta respuestas directamente (se podía mandar is_correct = true). Ahora solo submit_answer.
drop policy if exists "Los usuarios crean sus propias respuestas" on public.diagnostic_answers;
