import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// brújula.ed (docs/PRINCIPIOS-DE-DISENO.md 3.5): principal (verde azulado), sun (amarillo, SOLO sobre fondo abeto o
// verde azulado), outline (secundario), ghost y link (terciarios) y destructive (borrar de verdad). "Descartar" una
// propuesta de la IA no es destructivo: va como outline o ghost. Por defecto 44 px de alto (zona táctil); "sm" es la
// versión compacta para listas densas en escritorio.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,translate] duration-(--duration-instant) ease-out-soft outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-rest hover:bg-primary/90 hover:shadow-raised motion-safe:hover:-translate-y-0.5",
        sun:
          "bg-brand-ray text-foreground shadow-rest hover:bg-brand-ray/90 hover:shadow-raised motion-safe:hover:-translate-y-0.5 focus-visible:border-brand-ray focus-visible:ring-brand-ray/60",
        outline:
          "border-primary/35 bg-card text-primary hover:border-primary hover:bg-secondary aria-expanded:bg-secondary dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50",
        destructive:
          "border-destructive/30 bg-card text-destructive hover:border-destructive hover:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs":
          "size-7 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
