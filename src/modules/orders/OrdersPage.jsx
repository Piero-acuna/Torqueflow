import { useEffect, useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { DataTable } from "../../components/common/DataTable";
import { EmptyState } from "../../components/common/EmptyState";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useWorkshop } from "../../contexts/WorkshopContext";
import { useCollection } from "../../hooks/useCollection";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeText, formatMoney, formatDate } from "../../lib/formatters";
import { partsRef } from "../../services/inventory.service";
import {
  addExternalJob,
  addPartToOrder,
  changeOrderStatus,
  ordersRef,
  removeExternalJob,
  removePartFromOrder,
  updateOrder
} from "../../services/orders.service";
import { ORDER_PRIORITIES, ORDER_STATUSES, PAYMENT_STATUSES } from "../../config/constants";
import { navigate } from "../../hooks/useHashRoute";

const KANBAN_STATUSES = ORDER_STATUSES.filter((item) => ["review", "waiting_parts", "external", "ready"].includes(item.value));
const statusMap = Object.fromEntries(ORDER_STATUSES.map((item) => [item.value, item.label]));

function queryValue(name) {
  const query = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(query).get(name) || "";
}

function orderTone(status) {
  if (status === "ready" || status === "delivered") return "success";
  if (status === "external" || status === "waiting_parts") return "warning";
  if (status === "cancelled") return "danger";
  return "info";
}

export function OrdersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { workshop } = useWorkshop();
  const orderCollection = useMemo(() => ordersRef(), []);
  const partCollection = useMemo(() => partsRef(), []);
  const { data: orders, loading } = useCollection(orderCollection, orderBy("createdAt", "desc"));
  const { data: parts } = useCollection(partCollection, orderBy("name", "asc"));
  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState(() => queryValue("search"));
  const [statusFilter, setStatusFilter] = useState("active");
  const debouncedSearch = useDebouncedValue(search);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [tab, setTab] = useState("summary");
  const [saving, setSaving] = useState(false);
  const [partForm, setPartForm] = useState({ partId: "", quantity: 1, unitPrice: 0 });
  const [externalForm, setExternalForm] = useState({ provider: "", description: "", sentAt: "", returnedAt: "", cost: 0, status: "sent" });

  useEffect(() => {
    const openId = queryValue("open");
    if (openId && orders.length) {
      const found = orders.find((item) => item.id === openId);
      if (found && selected?.id !== found.id) openOrder(found);
    }
  }, [orders, selected?.id]);

  const filtered = orders.filter((order) => {
    if (statusFilter === "active" && ["delivered", "cancelled"].includes(order.status)) return false;
    if (statusFilter !== "all" && statusFilter !== "active" && order.status !== statusFilter) return false;
    const text = normalizeText(`${order.orderNumber} ${order.plate} ${order.clientName} ${order.vehicleLabel} ${order.mechanicName} ${order.diagnosis}`);
    return text.includes(normalizeText(debouncedSearch));
  });

  function openOrder(order) {
    setSelected(order);
    setEditForm({
      diagnosis: order.diagnosis || "",
      customerComplaint: order.customerComplaint || "",
      mechanicId: order.mechanicId || "",
      mechanicName: order.mechanicName || "Sin asignar",
      priority: order.priority || "normal",
      promisedAt: order.promisedAt || "",
      budget: Number(order.budget || 0),
      laborCost: Number(order.laborCost || 0),
      otherCosts: Number(order.otherCosts || 0),
      discount: Number(order.discount || 0),
      paymentStatus: order.paymentStatus || "pending",
      approvalStatus: order.approvalStatus || "pending",
      internalNotes: order.internalNotes || ""
    });
    setTab("summary");
    setPartForm({ partId: "", quantity: 1, unitPrice: 0 });
    setExternalForm({ provider: "", description: "", sentAt: "", returnedAt: "", cost: 0, status: "sent" });
  }

  async function saveOrder() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateOrder(selected.id, editForm, user);
      showToast("Orden actualizada.");
      setSelected(null);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function moveStatus(orderId, status) {
    try {
      await changeOrderStatus(orderId, status, user);
      showToast(`Estado actualizado a ${statusMap[status]}.`);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function addPart(event) {
    event.preventDefault();
    if (!selected) return;
    if (!partForm.partId) return showToast("Selecciona un repuesto.", "error");
    setSaving(true);
    try {
      await addPartToOrder(selected.id, partForm, user);
      showToast("Repuesto agregado y stock descontado.");
      setPartForm({ partId: "", quantity: 1, unitPrice: 0 });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function removePart(lineId) {
    if (!selected) return;
    setSaving(true);
    try {
      await removePartFromOrder(selected.id, lineId, user);
      showToast("Repuesto retirado y devuelto al stock.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function addExternal(event) {
    event.preventDefault();
    if (!selected) return;
    if (!externalForm.description.trim()) return showToast("Describe el trabajo externo.", "error");
    setSaving(true);
    try {
      await addExternalJob(selected.id, externalForm, user);
      showToast("Trabajo externo registrado.");
      setExternalForm({ provider: "", description: "", sentAt: "", returnedAt: "", cost: 0, status: "sent" });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeExternal(jobId) {
    if (!selected) return;
    try {
      await removeExternalJob(selected.id, jobId, user);
      showToast("Trabajo externo eliminado.");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  const columns = [
    { key: "orderNumber", label: "Orden", render: (row) => <div className="cell-main"><strong>{row.orderNumber}</strong><small>{formatDate(row.createdAt, { withTime: true })}</small></div> },
    { key: "vehicle", label: "Vehículo", render: (row) => <div className="cell-main"><strong>{row.plate || "Sin placa"}</strong><small>{row.vehicleLabel}</small></div> },
    { key: "clientName", label: "Cliente" },
    { key: "status", label: "Estado", render: (row) => <Badge tone={orderTone(row.status)}>{statusMap[row.status] || row.status}</Badge> },
    { key: "mechanicName", label: "Mecánico" },
    { key: "total", label: "Total", render: (row) => <strong>{formatMoney(row.totals?.total || 0, workshop.currency)}</strong> }
  ];

  const freshSelected = selected ? orders.find((item) => item.id === selected.id) || selected : null;

  return (
    <>
      <PageHeader eyebrow="Control del taller" title="Órdenes de trabajo" description="Tablero operativo, costos, repuestos y trabajos externos en tiempo real." actions={<Button type="button" onClick={() => navigate("/orders/new")}>+ Nueva orden</Button>} />

      <div className="toolbar toolbar--wrap">
        <div className="search-box"><span>⌕</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Orden, placa, cliente, vehículo o mecánico" /></div>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Órdenes activas</option><option value="all">Todos los estados</option>{ORDER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        <div className="segmented"><button type="button" className={view === "kanban" ? "is-active" : ""} onClick={() => setView("kanban")}>Kanban</button><button type="button" className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>Tabla</button></div>
        <span className="toolbar__count">{filtered.length} órdenes</span>
      </div>

      {filtered.length ? view === "kanban" ? (
        <div className="kanban">
          {KANBAN_STATUSES.map((status) => {
            const rows = filtered.filter((order) => order.status === status.value);
            return (
              <section
                key={status.value}
                className="kanban-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => moveStatus(event.dataTransfer.getData("text/order-id"), status.value)}
              >
                <header><div><span className={`status-mark status-mark--${status.value}`} /><strong>{status.label}</strong></div><Badge>{rows.length}</Badge></header>
                <div className="kanban-column__body">
                  {rows.map((order) => (
                    <article key={order.id} className="order-card" draggable onDragStart={(event) => event.dataTransfer.setData("text/order-id", order.id)} onClick={() => openOrder(order)}>
                      <div className="order-card__top"><strong>{order.orderNumber}</strong><Badge tone={order.priority === "urgent" ? "danger" : order.priority === "high" ? "warning" : "neutral"}>{order.priority || "normal"}</Badge></div>
                      <div className="order-card__vehicle"><span className="plate">{order.plate || "SIN-PLACA"}</span><div><strong>{order.vehicleLabel || "Vehículo"}</strong><small>{order.clientName || "Cliente"}</small></div></div>
                      <p>{order.customerComplaint || order.diagnosis || "Sin diagnóstico"}</p>
                      <div className="order-card__meta"><span>👤 {order.mechanicName || "Sin asignar"}</span><span>◷ {order.promisedAt ? formatDate(order.promisedAt, { withTime: true }) : "Sin fecha"}</span></div>
                      <div className="order-card__cost"><span>Costo registrado</span><strong>{formatMoney(order.totals?.total || 0, workshop.currency)}</strong></div>
                    </article>
                  ))}
                  {!rows.length ? <div className="kanban-empty">Arrastra una orden aquí</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : <SectionCard><DataTable columns={columns} rows={filtered} onRowClick={openOrder} /></SectionCard> : (
        <EmptyState title={loading ? "Cargando órdenes…" : "No hay órdenes de trabajo"} description="El sistema está limpio. Crea la primera orden para iniciar el tablero." actionLabel="Crear orden" onAction={() => navigate("/orders/new")} />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={freshSelected?.orderNumber || "Orden de trabajo"}
        subtitle={`${freshSelected?.plate || "Sin placa"} · ${freshSelected?.clientName || "Cliente"}`}
        size="xl"
        footer={<><Button variant="ghost" type="button" onClick={() => setSelected(null)}>Cerrar</Button><Button type="button" disabled={saving} onClick={saveOrder}>{saving ? "Guardando…" : "Guardar cambios"}</Button></>}
      >
        {freshSelected ? (
          <>
            <div className="modal-tabs">
              {[{ id: "summary", label: "Resumen" }, { id: "parts", label: `Piezas (${freshSelected.partLines?.length || 0})` }, { id: "external", label: `Externos (${freshSelected.externalJobs?.length || 0})` }, { id: "activity", label: "Actividad" }].map((item) => <button type="button" key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
            </div>

            {tab === "summary" ? (
              <div className="order-editor-grid">
                <div className="form-grid">
                  <FormField label="Falla reportada" className="field--wide"><Textarea rows="3" value={editForm.customerComplaint || ""} onChange={(event) => setEditForm({ ...editForm, customerComplaint: event.target.value })} /></FormField>
                  <FormField label="Diagnóstico" className="field--wide"><Textarea rows="4" value={editForm.diagnosis || ""} onChange={(event) => setEditForm({ ...editForm, diagnosis: event.target.value })} /></FormField>
                  <FormField label="Prioridad"><Select value={editForm.priority || "normal"} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}>{ORDER_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
                  <FormField label="Entrega estimada"><Input type="datetime-local" value={editForm.promisedAt || ""} onChange={(event) => setEditForm({ ...editForm, promisedAt: event.target.value })} /></FormField>
                  <FormField label="Estado"><Select value={freshSelected.status} onChange={(event) => moveStatus(freshSelected.id, event.target.value)}>{ORDER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
                  <FormField label="Pago"><Select value={editForm.paymentStatus || "pending"} onChange={(event) => setEditForm({ ...editForm, paymentStatus: event.target.value })}>{PAYMENT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
                  <FormField label="Mano de obra"><Input type="number" min="0" step="0.01" value={editForm.laborCost || 0} onChange={(event) => setEditForm({ ...editForm, laborCost: Number(event.target.value) })} /></FormField>
                  <FormField label="Otros costos"><Input type="number" min="0" step="0.01" value={editForm.otherCosts || 0} onChange={(event) => setEditForm({ ...editForm, otherCosts: Number(event.target.value) })} /></FormField>
                  <FormField label="Descuento"><Input type="number" min="0" step="0.01" value={editForm.discount || 0} onChange={(event) => setEditForm({ ...editForm, discount: Number(event.target.value) })} /></FormField>
                  <FormField label="Presupuesto"><Input type="number" min="0" step="0.01" value={editForm.budget || 0} onChange={(event) => setEditForm({ ...editForm, budget: Number(event.target.value) })} /></FormField>
                  <FormField label="Notas internas" className="field--wide"><Textarea rows="3" value={editForm.internalNotes || ""} onChange={(event) => setEditForm({ ...editForm, internalNotes: event.target.value })} /></FormField>
                </div>
                <aside className="cost-summary">
                  <h3>Resumen de costos</h3>
                  <div><span>Servicios</span><strong>{formatMoney(freshSelected.totals?.services || 0, workshop.currency)}</strong></div>
                  <div><span>Repuestos</span><strong>{formatMoney(freshSelected.totals?.parts || 0, workshop.currency)}</strong></div>
                  <div><span>Externos</span><strong>{formatMoney(freshSelected.totals?.external || 0, workshop.currency)}</strong></div>
                  <div><span>Mano de obra</span><strong>{formatMoney(freshSelected.totals?.labor || 0, workshop.currency)}</strong></div>
                  <div className="cost-summary__total"><span>Total actual</span><strong>{formatMoney(freshSelected.totals?.total || 0, workshop.currency)}</strong></div>
                  <small>El total se recalcula al guardar o modificar piezas y externos.</small>
                </aside>
              </div>
            ) : null}

            {tab === "parts" ? (
              <div className="editor-section">
                <form className="inline-form inline-form--4" onSubmit={addPart}>
                  <Select value={partForm.partId} onChange={(event) => { const part = parts.find((item) => item.id === event.target.value); setPartForm({ ...partForm, partId: event.target.value, unitPrice: Number(part?.salePrice || 0) }); }}><option value="">Seleccionar repuesto</option>{parts.filter((part) => part.active !== false).map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name} · stock {part.stock || 0}</option>)}</Select>
                  <Input type="number" min="1" step="1" value={partForm.quantity} onChange={(event) => setPartForm({ ...partForm, quantity: Number(event.target.value) })} placeholder="Cantidad" />
                  <Input type="number" min="0" step="0.01" value={partForm.unitPrice} onChange={(event) => setPartForm({ ...partForm, unitPrice: Number(event.target.value) })} placeholder="Precio unitario" />
                  <Button type="submit" disabled={saving}>Agregar pieza</Button>
                </form>
                <div className="line-list">
                  {(freshSelected.partLines || []).map((line) => (
                    <div key={line.id} className="line-row"><div><strong>{line.name}</strong><small>{line.sku || "Sin SKU"}</small></div><span>{line.quantity} × {formatMoney(line.unitPrice, workshop.currency)}</span><strong>{formatMoney(line.quantity * line.unitPrice, workshop.currency)}</strong><Button variant="danger" size="sm" type="button" onClick={() => removePart(line.id)}>Retirar</Button></div>
                  ))}
                  {!freshSelected.partLines?.length ? <EmptyState title="Sin repuestos utilizados" description="Agrega piezas y el stock se descontará de forma transaccional." /> : null}
                </div>
              </div>
            ) : null}

            {tab === "external" ? (
              <div className="editor-section">
                <form className="form-grid" onSubmit={addExternal}>
                  <FormField label="Proveedor"><Input value={externalForm.provider} onChange={(event) => setExternalForm({ ...externalForm, provider: event.target.value })} /></FormField>
                  <FormField label="Estado"><Select value={externalForm.status} onChange={(event) => setExternalForm({ ...externalForm, status: event.target.value })}><option value="sent">Enviado</option><option value="in_progress">En proceso</option><option value="returned">Regresó</option></Select></FormField>
                  <FormField label="Descripción" className="field--wide"><Input value={externalForm.description} onChange={(event) => setExternalForm({ ...externalForm, description: event.target.value })} /></FormField>
                  <FormField label="Hora de salida"><Input type="datetime-local" value={externalForm.sentAt} onChange={(event) => setExternalForm({ ...externalForm, sentAt: event.target.value })} /></FormField>
                  <FormField label="Hora de retorno"><Input type="datetime-local" value={externalForm.returnedAt} onChange={(event) => setExternalForm({ ...externalForm, returnedAt: event.target.value })} /></FormField>
                  <FormField label="Costo"><Input type="number" min="0" step="0.01" value={externalForm.cost} onChange={(event) => setExternalForm({ ...externalForm, cost: Number(event.target.value) })} /></FormField>
                  <div className="field field--actions"><Button type="submit" disabled={saving}>Registrar trabajo externo</Button></div>
                </form>
                <div className="line-list">
                  {(freshSelected.externalJobs || []).map((job) => (
                    <div key={job.id} className="line-row"><div><strong>{job.description}</strong><small>{job.provider || "Proveedor no indicado"}</small></div><span>{job.status}</span><strong>{formatMoney(job.cost, workshop.currency)}</strong><Button variant="danger" size="sm" type="button" onClick={() => removeExternal(job.id)}>Eliminar</Button></div>
                  ))}
                  {!freshSelected.externalJobs?.length ? <EmptyState title="Sin trabajos externos" description="Registra torno, rectificadora, refaccionaria u otro proveedor." /> : null}
                </div>
              </div>
            ) : null}

            {tab === "activity" ? (
              <div className="timeline">
                {[...(freshSelected.timeline || [])].reverse().map((event) => (
                  <div className="timeline__item" key={event.id}><span /><div><strong>{event.description}</strong><small>{event.actorName || "Sistema"} · {formatDate(event.createdAt, { withTime: true })}</small></div></div>
                ))}
                {!freshSelected.timeline?.length ? <EmptyState title="Sin actividad" description="Los cambios de la orden aparecerán aquí." /> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>
    </>
  );
}
