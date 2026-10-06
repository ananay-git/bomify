/**
 * @component StaffLayout
 *
 * The only screen frame staff see: a slim top bar (brand, notifications, who's
 * signed in, log out) above the task dashboard. No owner menus.
 */

import { Outlet, useNavigate } from "react-router-dom";
import { Button, Tag } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { clearAuth, getUser } from "@/app/store";
import NotificationBell from "@/features/notifications/components/NotificationBell";

export default function StaffLayout() {
    const navigate = useNavigate();
    const user = getUser();

    const handleLogout = () => {
        clearAuth();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            <header
                className="sticky top-0 z-40 flex h-16 items-center justify-between bg-white px-4 sm:px-8"
                style={{ borderBottom: "1px solid #e5e7eb" }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
                        style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                    >
                        Q
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>QuadStack</span>
                    <Tag color="green" style={{ marginInlineEnd: 0 }}>Staff</Tag>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                    <NotificationBell variant="header" />
                    <span className="hidden sm:inline" style={{ fontSize: 14, color: "#475569" }}>
                        {user?.full_name}
                    </span>
                    <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                        Log out
                    </Button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-8 sm:py-8">
                <Outlet />
            </main>
        </div>
    );
}
