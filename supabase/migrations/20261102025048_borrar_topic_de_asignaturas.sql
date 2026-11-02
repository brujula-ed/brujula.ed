-- Borra subjects.topic, reemplazada por subjects.description en la fase 2 del motor (migración unidades_y_temas, que
-- copió topic a description y la dejó opcional). Se aplica después de desplegar el código que ya no la usa
-- (docs/PENDIENTES.md, pendiente 14). Comprobado en producción el 02/11/2026: ninguna asignatura pierde texto (todo topic
-- con valor ya está en description) y ninguna función ni vista usa la columna.
alter table public.subjects drop column topic;
