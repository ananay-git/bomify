import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import StaffLayout from "@/components/layout/StaffLayout";
import StaffDashboardPage from "@/pages/staff/StaffDashboardPage";
import AccessDenied from "@/components/feedback/AccessDenied";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import UserListPage from "@/pages/users/UserListPage";
import { isAuthenticated, hasModule, getUser, homePathFor } from "@/app/store";
import type { UserRole } from "@/app/store";
import CompanyListPage from "@/pages/companies/CompanyListPage";

// 1. Import your new Detail View (Already there)
import PartyDetailView from "@/features/parties/components/PartyDetailView";

// 2. Import your new Purchase Order List Page
import PurchaseOrderListPage from "@/pages/purchases/PurchaseOrderListPage";

// 3. Import new modules
import InventoryListPage from "@/pages/inventory/InventoryListPage";
import InventoryDashboardPage from "@/pages/inventory/InventoryDashboardPage";
import SalesOrderListPage from "@/pages/sales/SalesOrderListPage";
import CreateOrderConfirmationPage from "@/pages/sales/CreateOrderConfirmationPage";
import OrderConfirmationDetailPage from "@/pages/sales/OrderConfirmationDetailPage";
import ProductionListPage from "@/pages/production/ProductionListPage";
import DispatchListPage from "@/pages/dispatch/DispatchListPage";
import CreateDispatchPage from "@/pages/dispatch/CreateDispatchPage";
import DispatchDetailPage from "@/pages/dispatch/DispatchDetailPage";
import CreatePurchaseOrderPage from "@/pages/purchases/CreatePurchaseOrderPage";
import PurchaseOrderDetailPage from "@/pages/purchases/PurchaseOrderDetailPage";
import CreateSalesOrderPage from "@/pages/sales/CreateSalesOrderPage";
import SalesOrderDetailPage from "@/pages/sales/SalesOrderDetailPage";
import CopilotPage from "@/pages/copilot/CopilotPage";
// 4. Missing purchase document imports
import CreateServiceOrderPage from "@/pages/purchases/CreateServiceOrderPage";
import CreateInwardPage from "@/pages/purchases/CreateInwardPage";
import InwardDetailPage from "@/pages/purchases/InwardDetailPage";
import { default as CreatePurchaseSalesOrderPage } from "@/pages/purchases/CreateSalesOrderPage";
import OrderConfirmationPurchaseDetailPage from "@/pages/purchases/OrderConfirmationPurchaseDetailPage";
import CreateServiceConfirmationPage from "@/pages/purchases/CreateServiceConfirmationPage";
import ServiceConfirmationDetailPage from "@/pages/purchases/ServiceConfirmationDetailPage";
import CreateInvoicePage from "@/pages/purchases/CreateInvoicePage";
import InvoiceDetailPage from "@/pages/purchases/InvoiceDetailPage";
import CreateAdhocInvoicePage from "@/pages/purchases/CreateAdhocInvoicePage";
import AdhocInvoiceDetailPage from "@/pages/purchases/AdhocInvoiceDetailPage";
import SettingsPage from "@/pages/settings/SettingsPage";


/**
 * Keeps signed-out visitors on the login page, and keeps each kind of account in
 * its own area: staff are sent to their dashboard, owners to the main app.
 */
function ProtectedRoute({
    children,
    role,
}: {
    children: React.ReactNode;
    role: UserRole;
}) {
    const user = getUser();
    if (!isAuthenticated() || !user) {
        return <Navigate to="/login" replace />;
    }
    if (user.role !== role) {
        return <Navigate to={homePathFor(user)} replace />;
    }
    return <>{children}</>;
}

function ModuleGuard({
    module,
    children,
}: {
    module: string;
    children: React.ReactNode;
}) {
    if (!hasModule(module)) {
        return <AccessDenied />;
    }
    return <>{children}</>;
}

export default function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute role="owner">
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/app/home" replace />} />
                <Route path="app/home" element={<DashboardPage />} />
                <Route
                    path="app/users"
                    element={
                        <ModuleGuard module="users">
                            <UserListPage />
                        </ModuleGuard>
                    }
                />
                <Route path="app/companies" element={<CompanyListPage />} />
                <Route path="app/companies/:id" element={<PartyDetailView />} />

                {/* 3. Add the New Purchases Route Here */}
                <Route
                    path="app/purchases"
                    element={<PurchaseOrderListPage />}
                />
                <Route
                    path="app/purchases/create"
                    element={<CreatePurchaseOrderPage />}
                />
                <Route
                    path="app/purchases/service-orders/create"
                    element={<CreateServiceOrderPage />}
                />
                <Route
                    path="app/purchases/:id/inward/create"
                    element={<CreateInwardPage />}
                />
                <Route
                    path="app/purchases/:id/inward/:grnId"
                    element={<InwardDetailPage />}
                />
                {/* Purchase-side document routes (must be before generic :id) */}
                <Route path="app/purchases/order-confirmation/create" element={<CreatePurchaseSalesOrderPage />} />
                <Route path="app/purchases/order-confirmation/:id" element={<OrderConfirmationPurchaseDetailPage />} />
                <Route path="app/purchases/service-confirmation/create" element={<CreateServiceConfirmationPage />} />
                <Route path="app/purchases/service-confirmation/:id" element={<ServiceConfirmationDetailPage />} />
                <Route path="app/purchases/invoice/create" element={<CreateInvoicePage />} />
                <Route path="app/purchases/invoice/:id" element={<InvoiceDetailPage />} />
                <Route path="app/purchases/adhoc-invoice/create" element={<CreateAdhocInvoicePage />} />
                <Route path="app/purchases/adhoc-invoice/:id" element={<AdhocInvoiceDetailPage />} />
                <Route
                    path="app/purchases/:id"
                    element={<PurchaseOrderDetailPage />}
                />
                
                {/* 4. Newly mapped routes */}
                <Route path="app/inventory" element={<InventoryListPage />} />
                <Route path="app/inventory/dashboard" element={<InventoryDashboardPage />} />

                {/* Sales Order routes */}
                <Route path="app/sales" element={<SalesOrderListPage />} />
                <Route path="app/sales/create" element={<CreateSalesOrderPage />} />
                <Route path="app/sales/:id" element={<SalesOrderDetailPage />} />
                
                <Route path="app/production" element={<ProductionListPage />} />
                <Route path="app/copilot" element={<CopilotPage />} />
                <Route path="app/dispatch" element={<DispatchListPage />} />
                <Route path="app/dispatch/create" element={<CreateDispatchPage />} />
                <Route path="app/dispatch/:id" element={<DispatchDetailPage />} />

                {/* Settings (Admin only) */}
                <Route
                    path="app/settings"
                    element={
                        <ModuleGuard module="settings">
                            <SettingsPage />
                        </ModuleGuard>
                    }
                />

            </Route>

            {/* Staff: one shared task dashboard, nothing else */}
            <Route
                path="/staff"
                element={
                    <ProtectedRoute role="staff">
                        <StaffLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<StaffDashboardPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
