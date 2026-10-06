/**
 * Login Page
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, Segmented } from 'antd';
import { message } from '@/lib/antdHelper';
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { loginApi, fetchCurrentUser } from "@/features/auth";
import { setAuth, homePathFor } from "@/app/store";
import { extractApiError } from "@/lib/errors";

const { Title, Text } = Typography;

type LoginMode = "owner" | "staff";
const MODE_KEY = "qs_login_mode";

/** Shop-floor screens stay on the Staff tab: remember the last one used on this device. */
function savedMode(): LoginMode {
  try {
    return localStorage.getItem(MODE_KEY) === "staff" ? "staff" : "owner";
  } catch {
    return "owner";
  }
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>(savedMode);
  const navigate = useNavigate();

  const changeMode = (next: LoginMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* private browsing — the tab still works, it just isn't remembered */
    }
  };

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const { access_token } = await loginApi({ ...values, login_as: mode });
      // Temporarily store token to make the /me call
      localStorage.setItem("qs_token", access_token);
      const user = await fetchCurrentUser();
      setAuth(access_token, user);
      message.success(`Welcome, ${user.full_name}`);
      navigate(homePathFor(user));
    } catch (err: unknown) {
      message.error(extractApiError(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
        padding: 16,
      }}
    >
      <Card style={{ width: "100%", maxWidth: 400, boxShadow: "0 2px 8px rgba(0,0,0,0.09)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            QuadStack
          </Title>
          <Text type="secondary">
            {mode === "staff" ? "Sign in to see your orders" : "Sign in to your account"}
          </Text>
        </div>

        <Segmented<LoginMode>
          block
          value={mode}
          onChange={changeMode}
          options={[
            { label: "Owner", value: "owner" },
            { label: "Staff", value: "staff" },
          ]}
          style={{ marginBottom: 20 }}
        />

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {mode === "staff" ? "Log in as staff" : "Log in as owner"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
