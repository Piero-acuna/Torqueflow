import { useMemo } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { SectionCard } from "../../components/common/SectionCard";
import { EmptyState } from "../../components/common/EmptyState";
import { Badge } from "../../components/common/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { useSupabaseCollection } from "../../hooks/useSupabaseCollection";
import { useClients } from "../../services/clients.service";
import { formatDate, formatMoney } from "../../lib/formatters";
import { useWorkshop } from "../../contexts/WorkshopContext";
import { navigate } from "../../hooks/useHashRoute";

const ACTIVE = new Set(["review", "waiting_parts", "external", "ready"]);

function toOrder(row) {
  return {
    id:           row.id,
    orderNumber:  row.order_number,
    plate:        row.plate,
    vehicleLabel: row.vehicle_label,
    clientName:   row.client_name,
    status:       row.status,
    promisedAt:   row.promised_at,
    budget:       row.budget,
    totals:       row.totals || {},
    createdAt:    row.created_at
  };
}

export function DashboardPage() {
  const { workshopId } = useAuth();
  const { workshop } = useWorkshop();
  const { data: rawOrders, loading } = useSupabaseCollection("orders", workshopId, {
    orderBy: { column: "created_at", ascending: false }
  });
  const { data: rawParts } = useSupabaseCollection("parts", workshopId, {
    orderBy: { column: "name", ascending: true }
  });
  const { data: clients = [] } = useClients();

  const orders = useMemo(() => rawOrders.map(toOrder), [rawOrders]);
  const parts  = rawParts;

  const activeOrders  = orders.filter((order) => ACTIVE.has(order.status));
  const readyOrders   = orders.filter((order) => order.status === "ready");
  const delayedOrders = activeOrders.filter((order) => order.promisedAt && new Date(order.promisedAt) < new Date());
  const lowStock      = parts.filter((part) => Number(part.stock || 0) <= Number(part.minimum_stock || 0));
  const projected     = activeOrders.reduce((sum, order) => sum + Number(order.totals?.total || order.budget || 0), 0);
  const billed        = orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + Number(order.totals?.total || 0), 0);
  const goal          = Number(workshop.dailyGoal || 0);
  const goalPercent   = goal > 0 ? Math.min(100, (billed / goal) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Centro de mando"
        title="Dashboard"
        description="Resumen operativo y financiero en tiempo real con Supabase Realtime."
        actions={<button className="button button--primary" type="button" onClick={() => navigate("/orders/new")}>+ Nueva orden</button>}
      />

      <div className="stats-grid">
        <StatCard label="Órdenes activas"     value={activeOrders.length}  detail="En proceso actual"     tone="blue"   icon="▤" />
        <StatCard label="Vehículos listos"    value={readyOrders.length}   detail="Pendientes de entrega" tone="green"  icon="✓" />
        <StatCard label="Demorados"           value={delayedOrders.length} detail="Superaron la promesa"  tone="orange" icon="!" />
        <StatCard label="Clientes"            value={clients.length}       detail="Registrados en el taller" tone="purple" icon="◎" />
      </div>

      <div className="dashboard-grid">
        <SectionCard title="Resumen financiero" description="Montos calculados a partir de órdenes reales.">
          <div className="finance-summary">
            <div><span>Trabajo proyectado</span><strong>{formatMoney(projected, workshop.currency)}</strong></div>
            <div><span>Facturación histórica</span><strong>{formatMoney(billed, workshop.currency)}</strong></div>
          </div>
          <div className="goal-block">
            <div><span>Meta configurada</span><strong>{formatMoney(goal, workshop.currency)}</strong></div>
            <div className="progress"><span style={{ width: `${goalPercent}%` }} /></div>
            <small>{goal > 0 ? `${goalPercent.toFixed(0)}% alcanzado` : "Configura la meta diaria en Configuración"}</small>
          </div>
        </SectionCard>

        <SectionCard title="Alertas operativas" description="Situaciones que requieren atención.">
          <div className="alert-list">
            {delayedOrders.slice(0, 3).map((order) => (
              <button type="button" key={order.id} className="alert-row" onClick={() => navigate(`/orders?open=${order.id}`)}>
                <span className="alert-row__icon alert-row__icon--orange">!</span>
                <div><strong>{order.orderNumber}</strong><small>Entrega vencida · {order.plate}</small></div>
              </button>
            ))}
            {lowStock.slice(0, 3).map((part) => (
              <button type="button" key={part.id} className="alert-row" onClick={() => navigate("/parts")}>
                <span className="alert-row__icon alert-row__icon--red">↓</span>
                <div><strong>{part.name}</strong><small>Stock: {part.stock || 0} · mínimo: {part.minimum_stock || 0}</small></div>
              </button>
            ))}
            {!delayedOrders.length && !lowStock.length ? <EmptyState title="Sin alertas" description="No hay retrasos ni repuestos bajo mínimo." /> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Órdenes recientes" description="Últimos ingresos registrados en el sistema.">
        {orders.length ? (
          <div className="recent-list">
            {orders.slice(0, 8).map((order) => (
              <button type="button" key={order.id} className="recent-row" onClick={() => navigate(`/orders?open=${order.id}`)}>
                <div className="recent-row__main"><strong>{order.orderNumber}</strong><span>{order.plate || "Sin placa"} · {order.vehicleLabel || "Vehículo"}</span></div>
                <div><span>{order.clientName || "Cliente"}</span><small>{formatDate(order.createdAt, { withTime: true })}</small></div>
                <Badge tone={order.status === "ready" ? "success" : order.status === "external" ? "warning" : "info"}>{order.status || "review"}</Badge>
                <strong>{formatMoney(order.totals?.total || order.budget || 0, workshop.currency)}</strong>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title={loading ? "Cargando órdenes…" : "Todavía no hay órdenes"}
            description="Registra la primera orden de trabajo para empezar a operar."
            actionLabel="Crear primera orden"
            onAction={() => navigate("/orders/new")}
          />
        )}
      </SectionCard>
    </>
  );
}
