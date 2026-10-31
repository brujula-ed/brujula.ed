// Barra de acciones (docs/PRINCIPIOS-DE-DISENO.md 5.6): fija abajo en el celular en flujos largos (validar,
// diagnosticar), con las acciones a todo el ancho; desde md vuelve a su lugar en la página. Orden fijo: Descartar,
// Editar, Aceptar, con la principal a la derecha (al final).
// La página que la usa debe dejar espacio abajo en el celular (p. ej. pb-24) para que no tape el contenido.
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="flex gap-2 [&>*]:flex-1 md:justify-end md:[&>*]:flex-none">{children}</div>
    </div>
  );
}
