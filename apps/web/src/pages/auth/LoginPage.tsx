/**
 * Login Page
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography } from 'antd';
import { message } from '@/lib/antdHelper';
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { loginApi, fetchCurrentUser } from "@/features/auth";
import { setAuth } from "@/app/store";
import { extractApiError } from "@/lib/errors";

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const { access_token } = await loginApi(values);
      // Temporarily store token to make the /me call
      localStorage.setItem("qs_token", access_token);
      const user = await fetchCurrentUser();
      setAuth(access_token, user);
      message.success(`Welcome, ${user.full_name}`);
      navigate("/app/home");
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
          <Text type="secondary">Sign in to your account</Text>
        </div>

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
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
