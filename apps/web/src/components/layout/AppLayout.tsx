import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useSidebar } from "@/hooks/use-sidebar-state";

export default function AppLayout() {
    const { collapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <AppSidebar />

            <main
                className={`transition-all duration-300 flex flex-col min-h-screen p-8 ${
                    collapsed ? "ml-20" : "ml-64"
                }`}
            >
                <Outlet />
            </main>
        </div>
    );
}
