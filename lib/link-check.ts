import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { knownSourceFor } from "@/lib/resource-sources";

// Verificación de enlaces propuestos por la IA (F-11). Solo se usa en el servidor.
// La IA puede proponer cualquier sitio, así que antes de visitar una URL se comprueba que no lleve a la red interna
// (SSRF): solo https, sin usuario, contraseña ni puerto, nunca una IP escrita en la URL, y el dominio debe resolver
// solo a IP públicas. Se repite en cada redirección. No se lee el contenido de la respuesta: solo su estado.
// Riesgo residual: un dominio que cambie de IP entre la comprobación y la visita (DNS rebinding). Lo acotan el
// tiempo límite y que no se lea la respuesta.
// Limitación: un sitio puede responder 200 en una página que no sirve; por eso el docente aprueba cada recurso.

const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

// "verificado": la página respondió 200. "no_verificable": sitio conocido que no se puede comprobar (no se visita).
// "rechazado": URL no permitida, apunta a una IP no pública, no existe o no respondió a tiempo.
export type LinkCheck = "verificado" | "no_verificable" | "rechazado";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3], // multicast y reservadas (224.0.0.0 en adelante)
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
  });
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower); // fc00::/7, fe80::/10, multicast
}

function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !isPrivateV4(ip);
  if (version === 6) return !isPrivateV6(ip);
  return false;
}

// true si la URL se puede visitar: https, sin credenciales ni puerto, dominio (no IP) que resuelve solo a IP públicas
async function isSafeToVisit(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || isIP(host)) return false; // nunca una IP escrita ni un nombre sin dominio
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => isPublicIp(a.address));
  } catch {
    return false;
  }
}

async function fetchStatus(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "BrujulaED-link-check/1.0", Accept: "text/html,application/json" },
  });
}

export async function checkLink(url: string): Promise<LinkCheck> {
  const known = knownSourceFor(url);
  if (known && !known.verifiable) {
    // Igual se exige https: el enlace se mostrará a estudiantes
    return url.startsWith("https://") ? "no_verificable" : "rechazado";
  }
  try {
    if (!(await isSafeToVisit(url))) return "rechazado";

    // YouTube responde 200 aunque el video no exista: se pregunta a su servicio oEmbed, que da 404 en ese caso
    if (known?.name === "YouTube") {
      const res = await fetchStatus(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      return res.status === 200 ? "verificado" : "rechazado";
    }

    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetchStatus(current);
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return "rechazado";
        const next = new URL(location, current).toString();
        if (!(await isSafeToVisit(next))) return "rechazado";
        current = next;
        continue;
      }
      return res.status === 200 ? "verificado" : "rechazado";
    }
    return "rechazado"; // demasiadas redirecciones
  } catch {
    return "rechazado"; // tiempo agotado, error de red o URL inválida
  }
}

// Verifica varias URLs con un número limitado de peticiones a la vez
export async function checkLinks(urls: string[], concurrency = 5): Promise<LinkCheck[]> {
  const results: LinkCheck[] = new Array(urls.length).fill("rechazado");
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const i = next++;
      results[i] = await checkLink(urls[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
