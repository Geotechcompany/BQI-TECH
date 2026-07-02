import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, LogOut } from 'lucide-react';
import Image from 'next/image';
import { signOut } from "next-auth/react";
import { menuSections } from "./DashboardSidebar";
import { AdminBrandTitle } from "@/components/admin/AdminBrandTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useAdminTheme } from "@/contexts/AdminThemeContext";
import { getSidebarSkin } from "@/lib/admin-sidebar-skin";
import { cn } from "@/lib/utils";
import {
  filterAdminMenuSections,
  hasAdminModule,
} from "@/lib/admin-permissions";

interface MobileDashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDashboardSidebar({ isOpen, onClose }: MobileDashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme } = useAdminTheme();
  const skin = useMemo(() => getSidebarSkin(theme), [theme]);

  const visibleSections = useMemo(
    () =>
      filterAdminMenuSections(menuSections, user?.role, user?.adminModules),
    [user?.role, user?.adminModules]
  );

  const canViewOverview = hasAdminModule(
    user?.role,
    user?.adminModules,
    "overview"
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/50 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            className={cn(
              "fixed inset-y-0 left-0 z-[9999] w-64 shadow-xl p-4 md:hidden transform",
              skin.studio
                ? "bg-gradient-to-b from-[#272055] via-[#2a265c] to-[#1f1c42] text-white"
                : "bg-white"
            )}
          >
            <div className="flex items-center justify-between mb-8">
              <div className={cn("flex items-center gap-2", skin.studio ? "text-white" : "text-slate-800")}>
                <Image
                  src={skin.logoSrc}
                  alt="Logo"
                  width={68}
                  height={48}
                  className="rounded-lg"
                />
                <AdminBrandTitle
                  badgeVariant={skin.brandBadge}
                  titleClassName={skin.brandTitleClass}
                />
              </div>
              
              <button
                onClick={onClose}
                className={cn("p-2 rounded-lg", skin.iconButton)}
              >
                <X className={cn("w-6 h-6", skin.studio ? "text-white/70" : "text-slate-600")} />
              </button>
            </div>

            <nav className="space-y-4 h-[calc(100vh-160px)] overflow-y-auto">
              {canViewOverview && (
              <Link
                href="/admin/overview"
                className={cn(skin.navLink(pathname === '/admin/overview'), "p-2")}
              >
                <span className="ml-3">Overview</span>
              </Link>
              )}

              {visibleSections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <div className={cn("flex items-center w-full p-2 rounded-lg", skin.studio ? "text-white/80" : "hover:bg-slate-100")}>
                    <span className="ml-3 text-sm font-medium">{section.title}</span>
                  </div>
                  
                  <div className="ml-4 space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(skin.subLink(pathname === item.href), "p-2")}
                      >
                        <span className="ml-3">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className={cn(skin.logoutButton, "w-full mt-4 gap-3")}
            >
              <span className={skin.logoutIconWrap || "inline-flex"}>
                <LogOut className="w-4 h-4" />
              </span>
              <span className={skin.logoutLabel}>Log Out</span>
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
