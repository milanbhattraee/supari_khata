"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Wallet,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/transactions", label: "Txns", icon: ArrowLeftRight },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg ">
        <div className="glass-dock relative overflow-hidden ">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [backdrop-filter:blur(22px)_saturate(185%)_brightness(1.03)] [-webkit-backdrop-filter:blur(22px)_saturate(185%)_brightness(1.03)]"
          />
          <div className="relative z-10 flex items-center justify-around px-1 pb-0.5 pt-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors duration-150",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <item.icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={isActive ? 2.2 : 1.5}
                    fill={isActive ? "currentColor" : "none"}
                  />
                  <span className={cn(isActive && "font-semibold")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
