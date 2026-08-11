import { useMemo, useState } from "react";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { DataTable } from "../../components/common/DataTable";
import { EmptyState } from "../../components/common/EmptyState";
import { Input, Select } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkshop } from "../../contexts/WorkshopContext";
import { useSupabaseCollection } from "../../hooks/useSupabaseCollection";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatDate, formatMoney, normalizeText } from "../../lib/formatters";
import { downloadCsv } from "../../utils/csv";

function toOrder(row) {
  return {
    id:               row.id,
    orderNumber:      row.order_number,
    plate:            row.plate,
    vehicleLabel:     row.vehicle_label,
    clientName:       row.client_name,
    mechanicName:     row.mechanic_name,
    status:           row.status,
    paymentStatus:    row.payment_status,
    diagnosis:        row.diagnosis,
    customerComplaint: row.customer_complaint,
    serviceLines:     row.service_lines  || [],
    partLines:        row.part_lines     || [],
    externalJobs:     row.external_jobs  || [],
    totals:           row.totals         || {},
    enteredAt:        row.entered_at,
    completedAt:      row.completed_at,
    createdAt:        row.created_at
  };
}

function elapsedHours(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  return Math.max(0, ms / 3_600_000);
}

export function HistoryPage() {
  const { workshopId } = useAuth();
  const { workshop } = useWorkshop();
  const { data: rawOrders, loading } = useSupabaseCollection("orders", workshopId, {
    orderBy: { column: "created_at", ascending: false }
  });
  const orders = useMemo(() => rawOrders.map(toOrder), [rawOrders]);

  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("delivered");
  const [from,   setFrom]     = useState("");
  const [to,     setTo]       = useState("");
  const [selected, setSelected] = useState(null);
  const debounced = useDebouncedValue(search);

  const filtered = orders.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    const created = new Date(order.createdAt || 0);
    if (from && created < new Date(`${from}T00:00:00`)) return false;
    if (to   && created > new Date(`${to}T23:59:59`))   return false;
    const text = normalizeText(`${order.orderNumber} ${order.plate} ${order.clientName} ${order.vehicleLabel} ${order.mechanicName}`);
    return text.includes(normalizeText(debounced));
  });

  const totalBilled     = filtered.reduce((sum, item) => sum + Number(item.totals?.total || 0), 0);
  const totalPartsCost  = filtered.reduce((sum, item) => sum + (item.partLines || []).reduce((lineSum, line) => lineSum + Number(line.unitCost || 0) * Number(line.quantity || 0), 0), 0);
  const totalExternal   = filtered.reduce((sum, item) => sum + Number(item.totals?.external || 0), 0);
  const estimatedProfit = totalBilled - totalPartsCost - totalExternal;

  function exportCsv() {
    downloadCsv(
      "historial-ordenes.csv",
      ["Orden", "Fecha", "Placa", "Vehículo", "Cliente", "Estado", "Mecánico", "Total"],
      filtered.map((order) => [order.orderNumber, formatDate(order.createdAt), order.plate, order.vehicleLabel, order.clientName, order.status, order.mechanicName, order.totals?.total || 0])
    );
  }

  const columns = [
    { key: "orderNumber", label: "Orden",       render: (row) => <div className="cell-main"><strong>{row.orderNumber}</strong><small>{formatDate(row.createdAt)}</small></div> },
    { key: "vehicle",     label: "Vehículo",    render: (row) => <div className="cell-main"><strong>{row.plate || "Sin placa"}</strong><small>{row.vehicleLabel}</small></div> },
    { key: "clientName",  label: "Cliente" },
    { key: "time",        label: "Tiempo total", render: (row) => `${elapsedHours(row.enteredAt, row.completedAt || new Date().toISOString()).toFixed(1)} h` },
    { key: "external",    label: "Externos",    render: (row) => formatMoney(row.totals?.external || 0, workshop.currency) },
    { key: "total",       label: "Costo final", render: (row) => <strong>{formatMoney(row.totals?.total || 0, workshop.currency)}</strong> },
    { key: "status",      label: "Estado",      render: (row) => <Badge tone={row.status === "delivered" ? "success" : "neutral"}>{row.status}</Badge> }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Reportes y trazabilidad"
        title="Historial"
        description="Consulta órdenes terminadas, costos, tiempos y desglose financiero."
        actions={<Button type="button" variant="secondary" onClick={exportCsv} disabled={!filtered.length}>Exportar CSV</Button>}
      />

      <div className="stats-grid stats-grid--compact">
        <div className="metric-strip"><span>Órdenes filtradas</span><strong>{filtered.length}</strong></div>
        <div className="metric-strip"><span>Facturación</span><strong>{formatMoney(totalBilled, workshop.currency)}</strong></div>
        <div className="metric-strip"><span>Costos directos</span><strong>{formatMoney(totalPartsCost + totalExternal, workshop.currency)}</strong></div>
        <div className="metric-strip"><span>Margen estimado</span><strong>{formatMoney(estimatedProfit, workshop.currency)}</strong></div>
      </div>

      <div className="toolbar toolbar--wrap">
        <div className="search-box"><span>⌕</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, cliente o mecánico" /></div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="delivered">Entregadas</option>
          <option value="ready">Listas</option>
          <option value="cancelled">Canceladas</option>
          <option value="all">Todos los estados</option>
        </Select>
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Fecha inicial" />
        <Input type="date" value={to}   onChange={(event) => setTo(event.target.value)}   aria-label="Fecha final" />
      </div>

      <SectionCard title="Registro histórico" description="Haz clic en una orden para ver el comprobante detallado.">
        {filtered.length
          ? <DataTable columns={columns} rows={filtered} onRowClick={setSelected} />
          : <EmptyState title={loading ? "Cargando historial…" : "No hay órdenes para mostrar"} description="Las órdenes entregadas aparecerán aquí automáticamente." />}
      </SectionCard>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`Detalle ${selected?.orderNumber || ""}`}
        subtitle={`${selected?.plate || ""} · ${selected?.clientName || ""}`}
        size="xl"
        footer={<><Button variant="ghost" type="button" onClick={() => setSelected(null)}>Cerrar</Button><Button type="button" variant="secondary" onClick={() => window.print()}>Imprimir</Button></>}
      >
        {selected ? (
          <article className="receipt">
            <header className="receipt__header">
              <div><h3>TorqueFlow</h3><p>{workshop.address || "Dirección no configurada"}</p></div>
              <div><strong>{selected.orderNumber}</strong><span>{formatDate(selected.createdAt, { withTime: true })}</span></div>
            </header>
            <div className="receipt__info">
              <div><span>Cliente</span><strong>{selected.clientName}</strong></div>
              <div><span>Vehículo</span><strong>{selected.plate} · {selected.vehicleLabel}</strong></div>
              <div><span>Mecánico</span><strong>{selected.mechanicName || "Sin asignar"}</strong></div>
              <div><span>Pago</span><strong>{selected.paymentStatus || "pending"}</strong></div>
            </div>
            <div className="receipt__section"><h4>Diagnóstico</h4><p>{selected.diagnosis || selected.customerComplaint || "Sin detalle"}</p></div>
            <div className="receipt__section">
              <h4>Servicios</h4>
              {(selected.serviceLines || []).length
                ? (selected.serviceLines || []).map((line, index) => <div key={`${line.name}-${index}`} className="receipt-line"><span>{line.quantity || 1} × {line.name}</span><strong>{formatMoney(Number(line.price || 0) * Number(line.quantity || 1), workshop.currency)}</strong></div>)
                : <p className="muted">Sin servicios registrados.</p>}
            </div>
            <div className="receipt__section">
              <h4>Repuestos</h4>
              {(selected.partLines || []).length
                ? (selected.partLines || []).map((line) => <div key={line.id} className="receipt-line"><span>{line.quantity} × {line.name}</span><strong>{formatMoney(line.quantity * line.unitPrice, workshop.currency)}</strong></div>)
                : <p className="muted">Sin repuestos registrados.</p>}
            </div>
            <div className="receipt__section">
              <h4>Trabajos externos</h4>
              {(selected.externalJobs || []).length
                ? (selected.externalJobs || []).map((job) => <div key={job.id} className="receipt-line"><span>{job.description} · {job.provider || "Proveedor"}</span><strong>{formatMoney(job.cost, workshop.currency)}</strong></div>)
                : <p className="muted">Sin trabajos externos.</p>}
            </div>
            <footer className="receipt__totals">
              <div><span>Servicios</span><strong>{formatMoney(selected.totals?.services || 0, workshop.currency)}</strong></div>
              <div><span>Repuestos</span><strong>{formatMoney(selected.totals?.parts    || 0, workshop.currency)}</strong></div>
              <div><span>Externos</span><strong>{formatMoney(selected.totals?.external  || 0, workshop.currency)}</strong></div>
              <div><span>Mano de obra</span><strong>{formatMoney(selected.totals?.labor  || 0, workshop.currency)}</strong></div>
              <div className="receipt__grand-total"><span>Total final</span><strong>{formatMoney(selected.totals?.total || 0, workshop.currency)}</strong></div>
            </footer>
          </article>
        ) : null}
      </Modal>
    </>
  );
}
