/**
 * @component NotificationBell
 *
 * Bell with an unread count and a menu of recent notifications. Used in the
 * owner's sidebar ("sidebar") and the staff top bar ("header").
 */

import { useState } from "react";
import { Badge, Button, Popover, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Bell } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { useNotifications } from "../useNotifications";
import type { AppNotification } from "../api";

const { Text } = Typography;

interface Props {
  variant: "sidebar" | "header";
  /** Sidebar only: show just the icon. */
  collapsed?: boolean;
}

function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      style={{
        display: "flex",
        gap: 10,
        width: "100%",
        textAlign: "left",
        padding: "10px 8px",
        border: "none",
        borderBottom: "1px solid #f0f0f0",
        background: n.is_read ? "#fff" : "#f0f7ff",
        cursor: n.link ? "pointer" : "default",
      }}
    >
      <span
        aria-hidden
        style={{
          marginTop: 6,
          width: 8,
          height: 8,
          flexShrink: 0,
          borderRadius: "50%",
          background: n.is_read ? "transparent" : "#1677ff",
        }}
      />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: n.is_read ? 500 : 700,
            color: "#262626",
          }}
        >
          {n.title}
        </span>
        <span
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontSize: 13,
            color: "#595959",
            whiteSpace: "pre-line",
          }}
        >
          {n.message}
        </span>
        <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "#8c8c8c" }}>
          {timeAgo(n.created_at)}
        </span>
      </span>
    </button>
  );
}

export default function NotificationBell({ variant, collapsed = false }: Props) {
  const { items, unread, permission, openNotification, markAllRead, enableBrowserAlerts } =
    useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpen = (n: AppNotification) => {
    setOpen(false);
    void openNotification(n);
  };

  const menu = (
    <div style={{ width: 340, maxWidth: "calc(100vw - 80px)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Text strong>Notifications</Text>
        <Button type="link" size="small" disabled={unread === 0} onClick={() => void markAllRead()}>
          Mark all as read
        </Button>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "28px 8px", textAlign: "center", color: "#8c8c8c", fontSize: 13 }}>
            Nothing yet. New orders and updates will show up here.
          </div>
        ) : (
          items.map((n) => <NotificationItem key={n.id} n={n} onOpen={handleOpen} />)
        )}
      </div>

      {permission === "default" && (
        <div style={{ paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
          <Text type="secondary" style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
            Get a pop-up in your browser when something new comes in.
          </Text>
          <Button type="primary" size="small" onClick={() => void enableBrowserAlerts()}>
            Turn on browser alerts
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div style={{ paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Browser alerts are blocked for this site. Allow notifications in your browser's site
            settings to get pop-ups.
          </Text>
        </div>
      )}
    </div>
  );

  const trigger =
    variant === "header" ? (
      <Badge count={unread} size="small" overflowCount={99}>
        <Button
          shape="circle"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          icon={<BellOutlined style={{ fontSize: 18 }} />}
        />
      </Badge>
    ) : (
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 12,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 15,
          fontWeight: 500,
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          background: open ? "rgba(30, 64, 175, 0.15)" : "transparent",
          color: open ? "#60a5fa" : "#94a3b8",
          transition: "all 0.2s ease",
        }}
      >
        <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
          <Bell style={{ width: 20, height: 20 }} />
          {unread > 0 && collapsed && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#ef4444",
                border: "2px solid #0F172A",
              }}
            />
          )}
        </span>
        {!collapsed && <span style={{ whiteSpace: "nowrap", flex: 1 }}>Notifications</span>}
        {!collapsed && unread > 0 && (
          <span
            style={{
              minWidth: 20,
              padding: "0 6px",
              borderRadius: 10,
              background: "#ef4444",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: "20px",
              textAlign: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    );

  return (
    <Popover
      content={menu}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement={variant === "header" ? "bottomRight" : "rightBottom"}
    >
      {trigger}
    </Popover>
  );
}
