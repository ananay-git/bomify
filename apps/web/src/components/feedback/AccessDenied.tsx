/**
 * @component AccessDenied
 *
 * Generic 403 result page displayed when a user navigates to a
 * route they are not authorized to access.
 */

import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="Access Denied"
      subTitle="You do not have permission to view this page."
      extra={
        <Button type="primary" onClick={() => navigate("/app/home")}>
          Back to Home
        </Button>
      }
    />
  );
}
