import { useState, createContext, useContext, useEffect } from "react";
import type { ReactNode, Dispatch, SetStateAction, JSX } from "react";

const MOBILE_BREAKPOINT = 1024;

interface SidebarContextType {
    collapsed: boolean;
    setCollapsed: Dispatch<SetStateAction<boolean>>;
    isMobile: boolean;
    mobileOpen: boolean;
    setMobileOpen: Dispatch<SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({
    children,
}: {
    children: ReactNode;
}): JSX.Element {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            // Ensure the drawer never stays open when switching to desktop.
            if (!mobile) setMobileOpen(false);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <SidebarContext.Provider
            value={{ collapsed, setCollapsed, isMobile, mobileOpen, setMobileOpen }}
        >
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar(): SidebarContextType {
    const context = useContext(SidebarContext);

    if (!context) {
        throw new Error("useSidebar must be used inside SidebarProvider");
    }

    return context;
}
