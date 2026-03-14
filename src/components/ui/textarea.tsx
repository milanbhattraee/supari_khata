import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-xl border-[0.5px] border-foreground/8 bg-white/50 px-3 py-2.5 text-[15px] backdrop-blur-sm transition-all outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-white/8 dark:border-white/10 dark:focus-visible:bg-white/12 dark:focus-visible:border-primary/40 dark:focus-visible:ring-primary/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
