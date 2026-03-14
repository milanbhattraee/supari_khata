"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDrawerRoute =
    pathname.endsWith("/create") || pathname.includes("/edit");

  return (
    <>
      <div className="ios-bg" aria-hidden="true" />
      <div className="relative mx-auto min-h-dvh max-w-lg">
        <main className={isDrawerRoute ? "" : "pb-20"}>{children}</main>
        {!isDrawerRoute ? <BottomNav /> : null}
      </div>
    </>
  );
}
