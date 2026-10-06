import { useState, createContext, useContext } from "react";
import type { ReactNode, Dispatch, SetStateAction, JSX } from "react";

interface SidebarContextType {
    collapsed: boolean;
    setCollapsed: Dispatch<SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({
    children,
}: {
    children: ReactNode;
}): JSX.Element {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
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
