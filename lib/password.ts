// Largo mínimo de la contraseña: largo antes que reglas de símbolos (guía NIST). Supabase exige 6 en el servidor, salvo
// que se suba en el panel (Authentication → Sign In / Providers → Email → Minimum password length).
export const MIN_PASSWORD = 8;
