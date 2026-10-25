// Diagnóstico de autorregulación (F-08). VERSIÓN PRELIMINAR, pendiente de revisión por un experto.
// Instrumento: Inventario de Conciencia Metacognitiva (MAI; Schraw y Dennison, 1994), ítems adaptados al español
// por González-Cabañes et al. (Psicothema, 2022, 34(3), 454-462), publicados en https://osf.io/zthdj.
// El archivo de OSF no declara licencia: pedir permiso a los autores antes de usarlo con estudiantes reales.
// Hoy se usan los 52 ítems. La versión breve de 19 (Harrison y Vallin, 2018), la que mejor ajustó en España,
// se adoptará cuando se confirme su lista: basta con cambiar ITEMS y la versión.
// El reparto ítem → escala está también en la RPC self_regulation_class_summary (migración autorregulacion):
// si cambia aquí, hay que cambiarlo allí.
// Todo es orientativo y determinista: medias por escala, sin IA. No es una nota ni un diagnóstico clínico.

export type SrlScale = "conocimiento" | "regulacion";

export const INSTRUMENT_VERSION = "mai-52-es-preliminar-1";

export const SCALE_LABEL: Record<SrlScale, string> = {
  conocimiento: "Conocimiento de cómo aprendes",
  regulacion: "Regulación de tu aprendizaje",
};

export const SCALE_DESCRIPTION: Record<SrlScale, string> = {
  conocimiento: "Qué sabes de tus fortalezas, de tus estrategias y de cuándo conviene usar cada una.",
  regulacion: "Cómo planificas, supervisas, corriges y evalúas tu aprendizaje mientras estudias.",
};

// Escala de la adaptación española: 1 = "nada típico de mí" … 5 = "muy típico de mí"
export const RESPONSE_MIN = 1;
export const RESPONSE_MAX = 5;
export const RESPONSE_ENDS = { min: "Nada típico de mí", max: "Muy típico de mí" };

// Conocimiento (17): declarativo 5, 10, 12, 16, 17, 20, 32, 46; procedimental 3, 14, 27, 33;
// condicional 15, 18, 26, 29, 35. Regulación (35): el resto.
export const ITEMS: { id: number; scale: SrlScale; text: string }[] = [
  { id: 1, scale: "regulacion", text: "Me pregunto periódicamente si estoy cumpliendo mis objetivos" },
  { id: 2, scale: "regulacion", text: "Considero diferentes alternativas a un problema antes de dar una respuesta" },
  { id: 3, scale: "conocimiento", text: "Intento usar estrategias que me han funcionado en el pasado" },
  { id: 4, scale: "regulacion", text: "Me marco un ritmo de aprendizaje para poder tener suficiente tiempo" },
  { id: 5, scale: "conocimiento", text: "Soy consciente de mis fortalezas y debilidades intelectuales" },
  { id: 6, scale: "regulacion", text: "Pienso en lo que realmente necesito aprender antes de empezar una tarea" },
  { id: 7, scale: "regulacion", text: "Sé cómo me ha salido un examen una vez que lo he terminado" },
  { id: 8, scale: "regulacion", text: "Establezco objetivos específicos antes de empezar una tarea" },
  { id: 9, scale: "regulacion", text: "Voy más despacio cuando encuentro información importante" },
  { id: 10, scale: "conocimiento", text: "Sé determinar qué tipo de información es más importante aprender" },
  { id: 11, scale: "regulacion", text: "Me pregunto si estoy considerando todas las posibles opciones mientras trato de resolver un problema" },
  { id: 12, scale: "conocimiento", text: "Se me da bien organizar la información" },
  { id: 13, scale: "regulacion", text: "Centro mi atención conscientemente en la información importante" },
  { id: 14, scale: "conocimiento", text: "Tengo una finalidad específica para cada estrategia que uso" },
  { id: 15, scale: "conocimiento", text: "Aprendo mejor cuando sé algo sobre el tema" },
  { id: 16, scale: "conocimiento", text: "Sé lo que el profesor espera que aprenda" },
  { id: 17, scale: "conocimiento", text: "Se me da bien recordar información" },
  { id: 18, scale: "conocimiento", text: "Utilizo diferentes estrategias de aprendizaje en función de la situación" },
  { id: 19, scale: "regulacion", text: "Me pregunto si había una forma más fácil de hacer las cosas después de terminar una tarea" },
  { id: 20, scale: "conocimiento", text: "Tengo control sobre la calidad de mi aprendizaje" },
  { id: 21, scale: "regulacion", text: "Voy revisando periódicamente para entender mejor las relaciones importantes (entre conceptos, información…)" },
  { id: 22, scale: "regulacion", text: "Me hago preguntas sobre el material que tengo que aprender antes de empezar" },
  { id: 23, scale: "regulacion", text: "Pienso en varias formas de resolver un problema y elijo la mejor" },
  { id: 24, scale: "regulacion", text: "Resumo lo que he aprendido tras terminar (de estudiar, hacer una tarea…)" },
  { id: 25, scale: "regulacion", text: "Pido ayuda cuando no entiendo algo" },
  { id: 26, scale: "conocimiento", text: "Soy capaz de motivarme para aprender cuando lo necesito" },
  { id: 27, scale: "conocimiento", text: "Soy consciente de las estrategias que uso cuando estudio" },
  { id: 28, scale: "regulacion", text: "Mientras estudio me doy cuenta de que voy analizando la utilidad de las estrategias que uso" },
  { id: 29, scale: "conocimiento", text: "Uso mis fortalezas intelectuales para compensar mis puntos débiles" },
  { id: 30, scale: "regulacion", text: "Me centro en el significado y la relevancia de la información novedosa" },
  { id: 31, scale: "regulacion", text: "Creo mis propios ejemplos para dar más sentido a la información" },
  { id: 32, scale: "conocimiento", text: "Se me da bien evaluar en qué medida he comprendido algo" },
  { id: 33, scale: "conocimiento", text: "Me doy cuenta de que voy usando estrategias de aprendizaje útiles de forma automática" },
  { id: 34, scale: "regulacion", text: "Me doy cuenta de que voy haciendo pausas regularmente para comprobar mi comprensión" },
  { id: 35, scale: "conocimiento", text: "Sé determinar en qué contextos las estrategias que uso son más efectivas" },
  { id: 36, scale: "regulacion", text: "Me pregunto en qué medida he logrado mis objetivos una vez que finalizo una tarea" },
  { id: 37, scale: "regulacion", text: "Hago dibujos o esquemas para ayudarme a entender lo que voy aprendiendo" },
  { id: 38, scale: "regulacion", text: "Me pregunto si he considerado todas las opciones posibles tras resolver un problema" },
  { id: 39, scale: "regulacion", text: "Intento reformular la información nueva con mis propias palabras" },
  { id: 40, scale: "regulacion", text: "Cambio mis estrategias cuando no logro entender algo" },
  { id: 41, scale: "regulacion", text: "Utilizo la estructura organizativa del texto para que me ayude a aprender" },
  { id: 42, scale: "regulacion", text: "Leo detenidamente las instrucciones antes de empezar una tarea" },
  { id: 43, scale: "regulacion", text: "Me pregunto si lo que estoy leyendo se relaciona con lo que ya sé" },
  { id: 44, scale: "regulacion", text: "Reconsidero mis puntos de vista cuando algo me resulta confuso" },
  { id: 45, scale: "regulacion", text: "Organizo mi tiempo para alcanzar mejor mis objetivos" },
  { id: 46, scale: "conocimiento", text: "Aprendo mejor cuando un tema me interesa" },
  { id: 47, scale: "regulacion", text: "Trato de dividir lo que tengo que estudiar en partes más pequeñas" },
  { id: 48, scale: "regulacion", text: "Me centro en el significado global más que en los detalles" },
  { id: 49, scale: "regulacion", text: "Me pregunto cómo lo estoy haciendo mientras estoy aprendiendo algo nuevo" },
  { id: 50, scale: "regulacion", text: "Me pregunto si he aprendido todo lo posible una vez que he terminado una tarea" },
  { id: 51, scale: "regulacion", text: "Me detengo y vuelvo sobre la información nueva que no me ha quedado clara" },
  { id: 52, scale: "regulacion", text: "Me detengo y vuelvo a leer cuando algo me resulta confuso" },
];

export type SrlAnswers = Record<string, number>; // id del ítem → respuesta de 1 a 5

export function computeScores(answers: SrlAnswers): Record<SrlScale, number> {
  const sums = { conocimiento: 0, regulacion: 0 };
  const counts = { conocimiento: 0, regulacion: 0 };
  for (const item of ITEMS) {
    const value = answers[String(item.id)];
    if (typeof value !== "number") continue;
    sums[item.scale] += value;
    counts[item.scale] += 1;
  }
  return {
    conocimiento: counts.conocimiento ? sums.conocimiento / counts.conocimiento : 0,
    regulacion: counts.regulacion ? sums.regulacion / counts.regulacion : 0,
  };
}

export type SrlBand = "poco_frecuente" | "a_veces" | "frecuente";

export const BAND_LABEL: Record<SrlBand, string> = {
  poco_frecuente: "Poco frecuente",
  a_veces: "A veces",
  frecuente: "Frecuente",
};

// Tramos PROVISIONALES: el artículo no da puntos de corte. Los revisa el experto.
// Iguales en la RPC self_regulation_class_summary.
export function bandFor(mean: number): SrlBand {
  if (mean < 2.5) return "poco_frecuente";
  if (mean <= 3.5) return "a_veces";
  return "frecuente";
}

// Sugerencias con evidencia (recuperación activa, práctica espaciada, planificar y revisar). Orientativas.
export const SUGGESTIONS: Record<SrlScale, Record<SrlBand, string>> = {
  conocimiento: {
    poco_frecuente:
      "Antes de estudiar, pregúntate qué sabes ya del tema y qué te cuesta. Explicar un concepto con tus palabras " +
      "(desde el mapa de cada asignatura) te ayuda a darte cuenta de qué entiendes y qué no.",
    a_veces:
      "Fíjate en qué estrategias te funcionan: después de estudiar, anota cuál usaste y si te sirvió. Así sabrás " +
      "cuál elegir la próxima vez.",
    frecuente:
      "Conoces bien cómo aprendes. Úsalo para elegir la estrategia según la tarea y comprueba con preguntas si de " +
      "verdad dominas lo que estudiaste.",
  },
  regulacion: {
    poco_frecuente:
      "Prueba a planificar en pequeño: antes de empezar, define un objetivo concreto y cuánto tiempo le dedicarás; " +
      "al terminar, revisa si lo lograste.",
    a_veces:
      "Haz pausas para comprobar si estás entendiendo y reparte el estudio en varias sesiones en lugar de " +
      "concentrarlo en una sola (práctica espaciada).",
    frecuente:
      "Planificas y supervisas tu aprendizaje. Mantén el hábito de revisar al final qué aprendiste y repasa en días " +
      "distintos para consolidarlo.",
  },
};
