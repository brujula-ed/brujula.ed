"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Formulario "Pedir un piloto" de la landing (docs/LANDING-PARA-CODE.md, sección 5).
// Límites iguales a los check de la tabla pilot_requests. Sin límite por IP todavía (docs/PENDIENTES.md).

const PilotRequest = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(120, "El nombre es demasiado largo."),
  university: z
    .string()
    .trim()
    .min(2, "Escribe tu universidad y carrera.")
    .max(160, "El texto es demasiado largo."),
  email: z.email("Escribe un correo válido.").max(200, "El correo es demasiado largo."),
  message: z.string().trim().max(2000, "El mensaje puede tener hasta 2000 caracteres."),
});

type Field = keyof z.infer<typeof PilotRequest>;

export type PilotRequestState = {
  status: "idle" | "ok" | "invalid" | "error";
  errors?: Partial<Record<Field, string>>;
  values?: Partial<Record<Field, string>>; // para no vaciar el formulario si hay un error
};

export async function submitPilotRequest(
  _prev: PilotRequestState,
  formData: FormData
): Promise<PilotRequestState> {
  // Campo trampa: una persona no lo ve; si viene lleno, se responde como éxito sin guardar nada.
  if (String(formData.get("sitio_web") ?? "") !== "") return { status: "ok" };

  const values = {
    name: String(formData.get("nombre") ?? ""),
    university: String(formData.get("universidad") ?? ""),
    email: String(formData.get("correo") ?? "").trim(),
    message: String(formData.get("mensaje") ?? ""),
  };

  const parsed = PilotRequest.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field;
      errors[field] ??= issue.message;
    }
    return { status: "invalid", errors, values };
  }

  const { name, university, email, message } = parsed.data;
  try {
    const { error } = await createAdminClient()
      .from("pilot_requests")
      .insert({ name, university, email, message: message || null });
    if (error) {
      // Código o mensaje del error, nunca los datos enviados (son personales y no van a los logs).
      console.error("pilot_requests insert", error.code || error.message);
      return { status: "error", values };
    }
  } catch {
    console.error("pilot_requests: cliente no disponible");
    return { status: "error", values };
  }

  return { status: "ok" };
}
