import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import { Button } from "../../components/common/Button";
import { EmptyState } from "../../components/common/EmptyState";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import { Badge } from "../../components/common/Badge";
import { useCollection } from "../../hooks/useCollection";
import { clientsRef, vehiclesRef } from "../../services/clients.service";
import { mechanicsRef, servicesRef } from "../../services/catalog.service";
import { attachOrderPhotos, createOrder } from "../../services/orders.service";
import { uploadOrderPhotos } from "../../services/storage.service";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useWorkshop } from "../../contexts/WorkshopContext";
import { formatMoney } from "../../lib/formatters";
import { navigate } from "../../hooks/useHashRoute";
import { ORDER_PRIORITIES } from "../../config/constants";

function getQueryParam(name) {
  const query = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(query).get(name) || "";
}

const INITIAL_FORM = {
  clientId: "",
  vehicleId: "",
  mechanicId: "",
  priority: "normal",
  enteredAt: new Date().toISOString().slice(0, 16),
  promisedAt: "",
  fuelLevel: 50,
  mileage: "",
  diagnosis: "",
  customerComplaint: "",
  inspectionNotes: "",
  budget: 0,
  laborCost: 0,
  otherCosts: 0,
  discount: 0,
  approvalStatus: "pending",
  paymentStatus: "pending"
};

export function NewOrderPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { workshop } = useWorkshop();
  const clientCollection = useMemo(() => clientsRef(), []);
  const vehicleCollection = useMemo(() => vehiclesRef(), []);
  const mechanicCollection = useMemo(() => mechanicsRef(), []);
  const serviceCollection = useMemo(() => servicesRef(), []);
  const { data: clients } = useCollection(clientCollection, orderBy("name", "asc"));
  const { data: vehicles } = useCollection(vehicleCollection, orderBy("plate", "asc"));
  const { data: mechanics } = useCollection(mechanicCollection, orderBy("name", "asc"));
  const { data: services } = useCollection(serviceCollection, orderBy("name", "asc"));
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, clientId: getQueryParam("client") }));
  const [selectedServices, setSelectedServices] = useState([]);
  const [customService, setCustomService] = useState({ name: "", price: 0 });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const activeClients = clients.filter((item) => item.active !== false);
  const clientVehicles = vehicles.filter((item) => item.clientId === form.clientId && item.active !== false);
  const activeServices = services.filter((item) => item.active !== false);
  const serviceTotal = selectedServices.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 1), 0);
  const estimatedTotal = serviceTotal + Number(form.laborCost || 0) + Number(form.otherCosts || 0) - Number(form.discount || 0);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleService(service) {
    setSelectedServices((current) => {
      const exists = current.some((item) => item.serviceId === service.id);
      if (exists) return current.filter((item) => item.serviceId !== service.id);
      return [...current, { serviceId: service.id, name: service.name, categoryId: service.categoryId || "", quantity: 1, price: Number(service.price || 0) }];
    });
  }

  function addCustomService() {
    if (!customService.name.trim()) return showToast("Escribe el nombre del servicio.", "error");
    setSelectedServices((current) => [...current, { serviceId: "", name: customService.name.trim(), categoryId: "custom", quantity: 1, price: Number(customService.price || 0) }]);
    setCustomService({ name: "", price: 0 });
  }

  async function submit(event) {
    event.preventDefault();
    const client = clients.find((item) => item.id === form.clientId);
    const vehicle = vehicles.find((item) => item.id === form.vehicleId);
    const mechanic = mechanics.find((item) => item.id === form.mechanicId);
    if (!client) return showToast("Selecciona un cliente.", "error");
    if (!vehicle) return showToast("Selecciona un vehículo.", "error");
    if (!form.diagnosis.trim() && !form.customerComplaint.trim()) return showToast("Registra la falla o diagnóstico inicial.", "error");

    setSaving(true);
    try {
      const result = await createOrder({
        ...form,
        budget: Number(form.budget || 0),
        laborCost: Number(form.laborCost || 0),
        otherCosts: Number(form.otherCosts || 0),
        discount: Number(form.discount || 0),
        fuelLevel: Number(form.fuelLevel || 0),
        mileage: Number(form.mileage || vehicle.mileage || 0),
        clientName: client.name,
        clientPhone: client.phone || "",
        vehicleLabel: `${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""}`.trim(),
        plate: vehicle.plate || "",
        mechanicName: mechanic?.name || "Sin asignar",
        serviceLines: selectedServices
      }, user);

      if (files.length) {
        const photoEvidence = await uploadOrderPhotos(result.id, files);
        await attachOrderPhotos(result.id, photoEvidence);
      }
      showToast(`Orden ${result.orderNumber} creada correctamente.`);
      navigate(`/orders?open=${result.id}`);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Recepción del vehículo" title="Nueva orden de trabajo" description="Completa el ingreso. Todos los datos se guardan en tiempo real." actions={<Button variant="ghost" type="button" onClick={() => navigate("/orders")}>Ver órdenes</Button>} />

      <form className="order-create-layout" onSubmit={submit}>
        <div className="order-create-main">
          <SectionCard title="1. Cliente y vehículo" description="Selecciona registros existentes o créalos desde Clientes.">
            {!activeClients.length ? (
              <EmptyState title="Primero registra un cliente" description="El sistema está vacío y no contiene información de demostración." actionLabel="Ir a clientes" onAction={() => navigate("/clients")} />
            ) : (
              <div className="form-grid">
                <FormField label="Cliente" required><Select value={form.clientId} onChange={(event) => { updateField("clientId", event.target.value); updateField("vehicleId", ""); }}><option value="">Selecciona un cliente</option>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.phone}</option>)}</Select></FormField>
                <FormField label="Vehículo" required hint={!form.clientId ? "Selecciona primero el cliente." : ""}><Select value={form.vehicleId} disabled={!form.clientId} onChange={(event) => updateField("vehicleId", event.target.value)}><option value="">Selecciona un vehículo</option>{clientVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.brand} {vehicle.model}</option>)}</Select></FormField>
                <FormField label="Kilometraje"><Input type="number" min="0" value={form.mileage} onChange={(event) => updateField("mileage", event.target.value)} /></FormField>
                <FormField label="Nivel de combustible"><div className="range-field"><Input type="range" min="0" max="100" step="5" value={form.fuelLevel} onChange={(event) => updateField("fuelLevel", event.target.value)} /><strong>{form.fuelLevel}%</strong></div></FormField>
              </div>
            )}
          </SectionCard>

          <SectionCard title="2. Diagnóstico y recepción" description="Deja constancia del estado en que ingresa el vehículo.">
            <div className="form-grid">
              <FormField label="Falla reportada por el cliente" className="field--wide" required><Textarea rows="4" value={form.customerComplaint} onChange={(event) => updateField("customerComplaint", event.target.value)} placeholder="Ej.: ruido al frenar, pérdida de potencia…" /></FormField>
              <FormField label="Diagnóstico inicial" className="field--wide"><Textarea rows="4" value={form.diagnosis} onChange={(event) => updateField("diagnosis", event.target.value)} placeholder="Hallazgos técnicos preliminares" /></FormField>
              <FormField label="Observaciones de inspección" className="field--wide"><Textarea rows="3" value={form.inspectionNotes} onChange={(event) => updateField("inspectionNotes", event.target.value)} placeholder="Rayones, accesorios, objetos dejados…" /></FormField>
              <FormField label="Evidencias fotográficas" className="field--wide" hint="Imágenes JPG, PNG o WebP; se guardarán de forma segura."><Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></FormField>
            </div>
          </SectionCard>

          <SectionCard title="3. Catálogo de servicios" description="Selecciona servicios configurados o agrega uno específico.">
            {activeServices.length ? (
              <div className="service-catalog">
                {activeServices.map((service) => {
                  const active = selectedServices.some((item) => item.serviceId === service.id);
                  return (
                    <button key={service.id} className={`service-option ${active ? "is-selected" : ""}`} type="button" onClick={() => toggleService(service)}>
                      <span className="service-option__check">{active ? "✓" : "+"}</span>
                      <div><strong>{service.name}</strong><small>{service.description || "Servicio del taller"}</small></div>
                      <strong>{formatMoney(service.price || 0, workshop.currency)}</strong>
                    </button>
                  );
                })}
              </div>
            ) : <EmptyState title="Catálogo vacío" description="Puedes crear servicios en Configuración o agregar uno personalizado abajo." />}
            <div className="inline-form">
              <Input value={customService.name} onChange={(event) => setCustomService({ ...customService, name: event.target.value })} placeholder="Servicio personalizado" />
              <Input type="number" min="0" step="0.01" value={customService.price} onChange={(event) => setCustomService({ ...customService, price: event.target.value })} placeholder="Precio" />
              <Button type="button" variant="secondary" onClick={addCustomService}>Agregar</Button>
            </div>
            {selectedServices.length ? (
              <div className="selected-lines">
                {selectedServices.map((line, index) => (
                  <div key={`${line.serviceId}-${index}`} className="selected-line"><span>{line.name}</span><strong>{formatMoney(line.price, workshop.currency)}</strong><button type="button" className="icon-button" onClick={() => setSelectedServices((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="4. Planificación" description="Asigna responsable, prioridad y fechas comprometidas.">
            <div className="form-grid">
              <FormField label="Mecánico asignado"><Select value={form.mechanicId} onChange={(event) => updateField("mechanicId", event.target.value)}><option value="">Sin asignar</option>{mechanics.filter((item) => item.active !== false).map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}</Select></FormField>
              <FormField label="Prioridad"><Select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>{ORDER_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
              <FormField label="Fecha y hora de ingreso"><Input type="datetime-local" value={form.enteredAt} onChange={(event) => updateField("enteredAt", event.target.value)} /></FormField>
              <FormField label="Entrega estimada"><Input type="datetime-local" value={form.promisedAt} onChange={(event) => updateField("promisedAt", event.target.value)} /></FormField>
            </div>
          </SectionCard>
        </div>

        <aside className="quote-panel">
          <div className="quote-panel__header"><span className="eyebrow">Cotización en vivo</span><h2>Resumen económico</h2></div>
          <div className="quote-lines">
            <div><span>Servicios</span><strong>{formatMoney(serviceTotal, workshop.currency)}</strong></div>
            <div><span>Mano de obra</span><Input type="number" min="0" step="0.01" value={form.laborCost} onChange={(event) => updateField("laborCost", event.target.value)} /></div>
            <div><span>Otros costos</span><Input type="number" min="0" step="0.01" value={form.otherCosts} onChange={(event) => updateField("otherCosts", event.target.value)} /></div>
            <div><span>Descuento</span><Input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => updateField("discount", event.target.value)} /></div>
          </div>
          <div className="quote-total"><span>Total estimado</span><strong>{formatMoney(estimatedTotal, workshop.currency)}</strong></div>
          <FormField label="Presupuesto máximo autorizado"><Input type="number" min="0" step="0.01" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} /></FormField>
          {Number(form.budget || 0) > 0 && estimatedTotal > Number(form.budget) ? <div className="form-alert form-alert--warning">La estimación supera el presupuesto autorizado.</div> : null}
          <div className="quote-panel__meta"><Badge tone={files.length ? "success" : "neutral"}>{files.length} fotos</Badge><Badge tone={selectedServices.length ? "info" : "neutral"}>{selectedServices.length} servicios</Badge></div>
          <Button type="submit" disabled={saving || !activeClients.length}>{saving ? "Generando orden…" : "Generar orden de trabajo"}</Button>
        </aside>
      </form>
    </>
  );
}
