import { Outlet } from "react-router-dom";
import { Menu as MenuIcon } from "lucide-react";
import AppSidebar from "./AppSidebar";
import { useSidebar } from "@/hooks/use-sidebar-state";

export default function AppLayout() {
    const { collapsed, isMobile, mobileOpen, setMobileOpen } = useSidebar();

    const mainMargin = isMobile ? "ml-0" : collapsed ? "ml-20" : "ml-64";

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <AppSidebar />

            {/* Mobile top bar */}
            {isMobile && (
                <header
                    className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 px-4"
                    style={{
                        background: "#0F172A",
                        borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
                    }}
                >
                    <button
                        aria-label="Open menu"
                        onClick={() => setMobileOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ background: "rgba(30, 41, 59, 0.6)", color: "#e2e8f0", border: "none", cursor: "pointer" }}
                    >
                        <MenuIcon style={{ width: 20, height: 20 }} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                        >
                            Q
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>QuadStack</span>
                    </div>
                </header>
            )}

            {/* Overlay behind the mobile drawer */}
            {isMobile && mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40"
                    style={{ background: "rgba(15, 23, 42, 0.5)" }}
                />
            )}

            <main
                className={`transition-all duration-300 flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 ${mainMargin} ${
                    isMobile ? "pt-20" : ""
                }`}
            >
                <Outlet />
            </main>
        </div>
    );
}
