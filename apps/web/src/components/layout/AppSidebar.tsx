import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    BarChart3,
    ShoppingCart,
    Factory,
    Package,
    Truck,
    Users,
    ChevronLeft,
    ChevronRight,
    Settings,
    LogOut,
    ClipboardList,
    Building2,
    Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSidebar } from "@/hooks/use-sidebar-state";
import { clearAuth, hasModule } from "@/app/store";
import { settingsApi } from "@/features/settings/api";
import NotificationBell from "@/features/notifications/components/NotificationBell";

const navGroups = [
    {
        title: "Overview",
        items: [
            { label: "Dashboard", icon: LayoutDashboard, path: "/app/home", module: "dashboard" },
        ]
    },
    {
        title: "Transactions",
        items: [
            { label: "Sales Orders", icon: ShoppingCart, path: "/app/sales", module: "sales" },
            { label: "Purchases", icon: ClipboardList, path: "/app/purchases", module: "purchases" },
            { label: "Production", icon: Factory, path: "/app/production", module: "production" },
            { label: "Inventory", icon: Package, path: "/app/inventory", module: "inventory" },
            { label: "Inventory Dashboard", icon: BarChart3, path: "/app/inventory/dashboard", module: "inventory" },
            { label: "Dispatch", icon: Truck, path: "/app/dispatch", module: "dispatch" },
        ]
    },
    {
        title: "Masters",
        items: [
            { label: "Parties", icon: Building2, path: "/app/companies", module: "parties" },
        ]
    }
];

// All known nav paths, used to resolve prefix collisions (e.g. /app/inventory vs /app/inventory/dashboard).
const allNavPaths = [
    ...navGroups.flatMap(g => g.items.map(i => i.path)),
    "/app/copilot",
    "/app/users",
    "/app/settings",
];

const AppSidebar = () => {
    const { collapsed: collapsedRaw, setCollapsed, isMobile, mobileOpen, setMobileOpen } = useSidebar();
    // On mobile the sidebar is an off-canvas drawer, always shown expanded.
    const collapsed = isMobile ? false : collapsedRaw;
    const location = useLocation();
    const navigate = useNavigate();

    const closeOnMobileNav = () => {
        if (isMobile) setMobileOpen(false);
    };

    const [modules, setModules] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        settingsApi.getByCategory("modules").then(setModules).catch(console.error);
    }, []);

    const handleLogout = () => {
        clearAuth();
        navigate("/login");
    };

    const isPathActive = (path: string) => {
        // Exact match for dashboard/home, startsWith for others
        if (path === "/app/home") {
            return location.pathname === "/app/home" || location.pathname === "/app";
        }
        if (location.pathname === path) return true;
        // Prefix match, but only if no other (more specific) nav path matches better
        // e.g. "/app/inventory/dashboard" must win over "/app/inventory" for its own route.
        if (!location.pathname.startsWith(path + "/")) return false;
        const moreSpecificMatch = allNavPaths.some(
            (p) => p !== path && p.length > path.length && p.startsWith(path) &&
                (location.pathname === p || location.pathname.startsWith(p + "/"))
        );
        return !moreSpecificMatch;
    };

    const visibleGroups = navGroups.map(group => {
        return {
            ...group,
            items: group.items.filter(item => {
                if (!hasModule(item.module)) return false;
                if (!modules) return true;
                if (item.label === "Sales Orders" && modules.sales_enabled === false) return false;
                if (item.label === "Purchases" && modules.purchases_enabled === false) return false;
                if (item.label === "Production" && modules.production_enabled === false) return false;
                if ((item.label === "Inventory" || item.label === "Inventory Dashboard") && modules.inventory_enabled === false) return false;
                if (item.label === "Dispatch" && modules.dispatch_enabled === false) return false;
                return true;
            })
        }
    }).filter(group => group.items.length > 0);

    return (
        <aside
            className={`fixed left-0 top-0 flex h-screen flex-col transition-all duration-300 ease-in-out ${
                isMobile ? "w-64" : collapsed ? "w-20" : "w-64"
            }`}
            style={{ 
                background: '#0F172A', 
                borderRight: '1px solid rgba(51, 65, 85, 0.5)',
                borderRadius: '0 10px 10px 0',
                boxShadow: '4px 0 24px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden',
                zIndex: isMobile ? 50 : 40,
                transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
            }}
        >
            {/* Header / Logo */}
            <div
                className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'px-5 gap-3'}`}
                style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}
            >
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', boxShadow: '0 2px 8px rgba(29, 78, 216, 0.3)' }}
                >
                    Q
                </div>
                {!collapsed && (
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.025em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        QuadStack
                    </span>
                )}
            </div>

            {/* Navigation */}
            <nav
                className="sidebar-nav flex-1 overflow-y-auto overflow-x-hidden"
                style={{ padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
                {visibleGroups.map((group, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {!collapsed && (
                            <div style={{
                                padding: '0 12px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#64748b',
                            }}>
                                {group.title}
                            </div>
                        )}
                        {group.items.map((item) => {
                            const isActive = isPathActive(item.path);

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    title={collapsed ? item.label : undefined}
                                    onClick={closeOnMobileNav}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        fontSize: '15px',
                                        fontWeight: 500,
                                        textDecoration: 'none',
                                        transition: 'all 0.2s ease',
                                        background: isActive ? 'rgba(30, 64, 175, 0.15)' : 'transparent',
                                        color: isActive ? '#60a5fa' : '#94a3b8',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
                                            e.currentTarget.style.color = '#cbd5e1';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = '#94a3b8';
                                        }
                                    }}
                                >
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            height: '20px',
                                            width: '3px',
                                            borderRadius: '0 4px 4px 0',
                                            background: '#3b82f6',
                                        }} />
                                    )}
                                    <item.icon
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            flexShrink: 0,
                                            color: isActive ? '#60a5fa' : '#94a3b8',
                                            transition: 'color 0.2s ease',
                                        }}
                                    />
                                    {!collapsed && (
                                        <span style={{ whiteSpace: 'nowrap' }}>
                                            {item.label}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}

                {hasModule("copilot") && (!modules || modules.copilot_enabled !== false) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                        {!collapsed && (
                            <div style={{
                                padding: '0 12px 8px',
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#64748b',
                            }}>
                                Intelligence
                            </div>
                        )}
                        <Link
                            to="/app/copilot"
                            title={collapsed ? "AI Copilot" : undefined}
                            onClick={closeOnMobileNav}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '15px',
                                fontWeight: 500,
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                background: isPathActive("/app/copilot") ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                                color: isPathActive("/app/copilot") ? '#c084fc' : '#94a3b8',
                            }}
                            onMouseEnter={(e) => {
                                if (!isPathActive("/app/copilot")) {
                                    e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
                                    e.currentTarget.style.color = '#cbd5e1';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isPathActive("/app/copilot")) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#94a3b8';
                                }
                            }}
                        >
                            {isPathActive("/app/copilot") && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    height: '20px',
                                    width: '3px',
                                    borderRadius: '0 4px 4px 0',
                                    background: '#a855f7',
                                }} />
                            )}
                            <Sparkles
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    flexShrink: 0,
                                    color: isPathActive("/app/copilot") ? '#c084fc' : '#94a3b8',
                                    transition: 'color 0.2s ease',
                                }}
                            />
                            {!collapsed && (
                                <span style={{ whiteSpace: 'nowrap' }}>
                                    AI Copilot
                                </span>
                            )}
                        </Link>
                    </div>
                )}
            </nav>

            {/* Bottom Section */}
            <div style={{
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                borderTop: '1px solid rgba(51, 65, 85, 0.4)',
                background: '#0F172A',
            }}>
                {/* Notifications (new staff updates, orders ready to dispatch) */}
                <NotificationBell variant="sidebar" collapsed={collapsed} />

                {/* Users & Team */}
                {hasModule("users") && <Link
                    to="/app/users"
                    onClick={closeOnMobileNav}
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '15px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        background: isPathActive("/app/users") ? 'rgba(30, 64, 175, 0.15)' : 'transparent',
                        color: isPathActive("/app/users") ? '#60a5fa' : '#94a3b8',
                    }}
                    onMouseEnter={(e) => {
                        if (!isPathActive("/app/users")) {
                            e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
                            e.currentTarget.style.color = '#cbd5e1';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isPathActive("/app/users")) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#94a3b8';
                        }
                    }}
                >
                    {isPathActive("/app/users") && (
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: '20px',
                            width: '3px',
                            borderRadius: '0 4px 4px 0',
                            background: '#3b82f6',
                        }} />
                    )}
                    <Users style={{ width: '20px', height: '20px', flexShrink: 0, color: isPathActive("/app/users") ? '#60a5fa' : '#94a3b8' }} />
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>Users & Team</span>}
                </Link>}

                {/* Settings */}
                {hasModule("settings") && <Link
                    to="/app/settings"
                    onClick={closeOnMobileNav}
                    style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '15px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        background: isPathActive("/app/settings") ? 'rgba(30, 64, 175, 0.15)' : 'transparent',
                        color: isPathActive("/app/settings") ? '#60a5fa' : '#94a3b8',
                    }}
                    onMouseEnter={(e) => {
                        if (!isPathActive("/app/settings")) {
                            e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
                            e.currentTarget.style.color = '#cbd5e1';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isPathActive("/app/settings")) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#94a3b8';
                        }
                    }}
                >
                    {isPathActive("/app/settings") && (
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: '20px',
                            width: '3px',
                            borderRadius: '0 4px 4px 0',
                            background: '#3b82f6',
                        }} />
                    )}
                    <Settings style={{ width: '20px', height: '20px', flexShrink: 0, color: isPathActive("/app/settings") ? '#60a5fa' : '#94a3b8' }} />
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>Settings</span>}
                </Link>}

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: '12px',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '15px',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: 'transparent',
                        color: '#94a3b8',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(51, 65, 85, 0.4)';
                        e.currentTarget.style.color = '#f87171';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#94a3b8';
                    }}
                >
                    <LogOut style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>Log out</span>}
                </button>

                {/* Collapse Toggle */}
                {!isMobile && <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 500,
                        border: '1px solid rgba(51, 65, 85, 0.5)',
                        cursor: 'pointer',
                        marginTop: '8px',
                        marginLeft: collapsed ? 'auto' : '0px',
                        marginRight: collapsed ? 'auto' : '0px',
                        background: 'rgba(30, 41, 59, 0.4)',
                        color: '#94a3b8',
                        transition: 'all 0.2s ease',
                        width: collapsed ? '40px' : '100%',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(51, 65, 85, 0.7)';
                        e.currentTarget.style.color = '#e2e8f0';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
                        e.currentTarget.style.color = '#94a3b8';
                    }}
                >
                    {collapsed ? (
                        <ChevronRight style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                    ) : (
                        <>
                            <ChevronLeft style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap' }}>Collapse</span>
                        </>
                    )}
                </button>}
            </div>

            {/* Premium scrollbar styles */}
            <style>{`
                .sidebar-nav {
                    scrollbar-width: thin;
                    scrollbar-color: transparent transparent;
                    transition: scrollbar-color 0.3s ease;
                }
                .sidebar-nav:hover {
                    scrollbar-color: rgba(100, 116, 139, 0.35) transparent;
                }
                .sidebar-nav::-webkit-scrollbar {
                    width: 4px;
                }
                .sidebar-nav::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sidebar-nav::-webkit-scrollbar-thumb {
                    background: transparent;
                    border-radius: 4px;
                    transition: background 0.3s ease;
                }
                .sidebar-nav:hover::-webkit-scrollbar-thumb {
                    background: rgba(100, 116, 139, 0.35);
                }
                .sidebar-nav::-webkit-scrollbar-thumb:hover {
                    background: rgba(100, 116, 139, 0.55);
                }
            `}</style>
        </aside>
    );
};

export default AppSidebar;
