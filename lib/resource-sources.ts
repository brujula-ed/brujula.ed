// Recursos abiertos (F-11). La IA elige de qué sitios obtenerlos; esta lista no los limita.
// Solo guarda lo que sabemos de algunos sitios conocidos: su nombre para mostrar y si el servidor puede
// comprobar que una página exista (lib/link-check.ts).

export type ResourceKind = "lectura" | "video" | "ejercicio";

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  lectura: "Lectura",
  video: "Video",
  ejercicio: "Ejercicio",
};

export type KnownSource = {
  name: string;
  hosts: string[]; // dominios exactos
  // false si el servidor no puede comprobar que la página exista (responde 200 a todo o bloquea bots).
  // Esos enlaces se guardan como "no verificados" y el docente debe abrirlos antes de validar.
  verifiable: boolean;
};

export const KNOWN_SOURCES: KnownSource[] = [
  { name: "Wikipedia", hosts: ["es.wikipedia.org", "en.wikipedia.org"], verifiable: true },
  // Probado (25/10/2026): responde 200 también en libros inexistentes
  { name: "OpenStax", hosts: ["openstax.org"], verifiable: false },
  { name: "MIT OpenCourseWare", hosts: ["ocw.mit.edu"], verifiable: true },
  // Probado (25/10/2026): responde 200 con un desafío antibots, exista o no la página
  { name: "Khan Academy", hosts: ["es.khanacademy.org", "www.khanacademy.org"], verifiable: false },
  // Se verifica con su servicio oEmbed (lib/link-check.ts)
  { name: "YouTube", hosts: ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"], verifiable: true },
  { name: "PhET", hosts: ["phet.colorado.edu"], verifiable: true },
];

// Dominio de la URL en minúsculas, o null si no es una URL válida
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function knownSourceFor(url: string): KnownSource | null {
  const host = hostOf(url);
  return (host && KNOWN_SOURCES.find((s) => s.hosts.includes(host))) || null;
}

// Nombre para mostrar del sitio guardado en concept_resources.source (un dominio, o "docente")
export function siteLabel(source: string): string {
  if (source === "docente") return "Agregado por el docente";
  return KNOWN_SOURCES.find((s) => s.hosts.includes(source))?.name ?? source.replace(/^www\./, "");
}
