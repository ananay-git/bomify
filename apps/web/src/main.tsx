import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

import { SidebarProvider } from "@/hooks/use-sidebar-state";
ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <SidebarProvider>
                <App />
            </SidebarProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
