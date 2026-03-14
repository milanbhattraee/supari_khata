"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormDrawerPageProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FormDrawerPage({
  title,
  subtitle,
  back = false,
  children,
  className,
  contentClassName,
}: FormDrawerPageProps) {
  const router = useRouter();

  return (
    <>
      <div className="ios-bg" aria-hidden="true" />
      <div className="ios-drawer-backdrop" aria-hidden="true" />

      <div className="relative min-h-dvh overflow-x-hidden px-0 sm:px-4">
        <section className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end">
          <div className={cn("ios-form-drawer safe-bottom", className)}>
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-11 rounded-full bg-black/10 dark:bg-white/15" />
            </div>

            <header className="flex items-start gap-3 border-b border-black/5 px-4 pb-4 pt-3 dark:border-white/8">
              {back ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="-ml-1 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/50 text-primary backdrop-blur-sm transition active:scale-95 dark:bg-white/8"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </header>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4",
                contentClassName
              )}
            >
              {children}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}