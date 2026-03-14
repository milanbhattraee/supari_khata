"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "glass-header sticky top-0 z-40 overflow-hidden px-4 py-2.5",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [backdrop-filter:blur(22px)_saturate(185%)_brightness(1.03)] [-webkit-backdrop-filter:blur(22px)_saturate(185%)_brightness(1.03)]"
      />
      <div className="relative z-10 mx-auto flex max-w-lg items-center gap-2">
        {back && (
          <button
            onClick={() => router.back()}
            className="-ml-2 flex items-center gap-0 text-primary transition-opacity active:opacity-60"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={2.2} />
            <span className="text-[17px] -ml-1">Back</span>
          </button>
        )}
        <div className={cn("flex-1 min-w-0", !back && "py-0.5")}>
          <h1
            className={cn(
              "font-semibold tracking-tight truncate",
              back ? "text-[17px]" : "text-[22px]"
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
