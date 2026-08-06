import { BrandLogo } from "./components/brand/BrandLogo";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingScreen } from "./components/common/LoadingScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { WorkshopProvider } from "./contexts/WorkshopContext";
import { workshopId } from "./firebase/client";
import { useHashRoute } from "./hooks/useHashRoute";
import { LoginPage, AccessPending } from "./modules/auth/LoginPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { ClientsPage } from "./modules/clients/ClientsPage";
import { NewOrderPage } from "./modules/orders/NewOrderPage";
import { OrdersPage } from "./modules/orders/OrdersPage";
import { HistoryPage } from "./modules/history/HistoryPage";
import InventorySystem from "./InventorySystem";
import { SettingsPage } from "./modules/settings/SettingsPage";

function ConfigMissing() {
  return (
    <main className="auth-page auth-page--center">
      <section className="auth-card">
        <BrandLogo className="auth-card__brand" size="large" />
        <span className="eyebrow">Configuración requerida</span>
        <h2>La aplicación aún no está configurada</h2>
        <p>Copia <code>.env.example</code> como <code>.env.local</code> y completa las variables de entorno requeridas.</p>
      </section>
    </main>
  );
}

function RoutedApplication() {
  const { user, member, loading } = useAuth();
  const path = useHashRoute();
  const basePath = path.split("?")[0];

  if (!workshopId) return <ConfigMissing />;
  if (loading) return <LoadingScreen message="Validando acceso…" />;
  if (!user) return <LoginPage />;
  if (!member || member.active === false) return <AccessPending />;

  let page;
  switch (basePath) {
    case "/dashboard": page = <DashboardPage />; break;
    case "/orders/new": page = <NewOrderPage />; break;
    case "/orders": page = <OrdersPage />; break;
    case "/history": page = <HistoryPage />; break;
    case "/parts": page = <InventorySystem />; break;
    case "/clients": page = <ClientsPage />; break;
    case "/settings": page = <SettingsPage />; break;
    default: page = <DashboardPage />;
  }

  return (
    <WorkshopProvider>
      <AppLayout path={basePath}>{page}</AppLayout>
    </WorkshopProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RoutedApplication />
      </AuthProvider>
    </ToastProvider>
  );
}
