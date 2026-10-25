-- F-11: la IA elige libremente de qué sitios obtener recursos abiertos; el docente ya no elige sitios por asignatura.
-- La columna se añadió en recursos_curados y nunca llegó a usarse en producción (el código no estaba en main).
alter table public.subjects drop column resource_sources;

-- concept_resources.source pasa a guardar el dominio de la URL (o 'docente'), en lugar de un id del catálogo
update public.concept_resources
set source = lower(substring(url from '^https://([^/:?#]+)'))
where source <> 'docente';
