import { ConfigProvider, theme, App as AntApp } from "antd";
import AppRouter from "@/app/router";
import { setAntdContext } from "@/lib/antdHelper";

function AntdContextInitializer() {
    const { message } = AntApp.useApp();
    setAntdContext({ message });
    return null;
}

export default function App() {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.defaultAlgorithm,
                token: {
                    colorPrimary: "#1677ff",
                    borderRadius: 6,
                },
            }}
        >
            <AntApp>
                <AntdContextInitializer />
                <AppRouter />
            </AntApp>
        </ConfigProvider>
    );
}
