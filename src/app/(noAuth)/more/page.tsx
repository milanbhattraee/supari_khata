"use client";

import Link from "next/link";
import {
  Package,
  Factory,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useLogout } from "@/app/features/auth /hooks/useAuth";

const menuItems = [
  {
    href: "/products",
    icon: Package,
    label: "Products",
    description: "Manage inventory",
    color: "bg-blue-500",
  },
  {
    href: "/production",
    icon: Factory,
    label: "Production",
    description: "Processing entries",
    color: "bg-orange-500",
  },
];

export default function MorePage() {
  const logout = useLogout();

  return (
    <>
      <PageHeader title="More" />

      <div className="space-y-5 p-4">
        {/* Settings-style grouped list */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {menuItems.map((item, i) => (
            <Link key={item.href} href={item.href}>
              <div
                className="flex items-center gap-3 px-4 py-3 active:bg-foreground/5 transition-colors"
                style={{
                  borderBottom: i < menuItems.length - 1
                    ? "0.5px solid oklch(0 0 0 / 6%)"
                    : "none",
                }}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-normal">{item.label}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
              </div>
            </Link>
          ))}
        </div>

        {/* Logout section */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center justify-center py-3 active:bg-foreground/5 transition-colors"
          >
            <span className="text-[15px] text-destructive font-normal">
              {logout.isPending ? "Logging out..." : "Log Out"}
            </span>
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-2">
          सुपारी खाता v1.0
        </p>
      </div>
    </>
  );
}
