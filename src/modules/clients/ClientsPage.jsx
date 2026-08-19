import { useState } from "react";
import { Button } from "../../components/common/Button";
import { DataTable } from "../../components/common/DataTable";
import { EmptyState } from "../../components/common/EmptyState";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import { Modal } from "../../components/common/Modal";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionCard } from "../../components/common/SectionCard";
import { Badge } from "../../components/common/Badge";
import { useSupabaseCollection } from "../../hooks/useSupabaseCollection";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useClients, useClientMutations, useVehicles, useVehicleMutations, useVinDecoder } from "../../services/clients.service";
import { useAuth } from "../../contexts/AuthContext";
import { validateClient } from "../../lib/validators";
import { formatMoney } from "../../lib/formatters";
import { useToast } from "../../contexts/ToastContext";
import { useWorkshop } from "../../contexts/WorkshopContext";
import { navigate } from "../../hooks/useHashRoute";

const EMPTY_CLIENT = {
  type: "person",
  name: "",
  documentType: "DNI",
  documentNumber: "",
  phone: "",
  email: "",
  address: "",
  segment: "new",
  creditLimit: 0,
  notes: ""
};

const EMPTY_VEHICLE = {
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  fuelType: "Gasolina",
  vin: "",
  mileage: "",
  notes: ""
};

// NHTSA vPIC devuelve el combustible en inglés; el selector del formulario
// usa las opciones en español ya definidas en el proyecto.
function mapFuelType(value) {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("diesel")) return "Diésel";
  if (text.includes("electric")) return "Eléctrico";
  if (text.includes("hybrid")) return "Híbrido";
  if (text.includes("gasoline") || text.includes("flexible fuel")) return "Gasolina";
  if (text.includes("natural gas") || text.includes("cng")) return "GNV";
  if (text.includes("propane") || text.includes("lpg")) return "GLP";
  return null; // Sin equivalente conocido: se conserva el valor actual del formulario.
}

export function ClientsPage() {
  const { workshop } = useWorkshop();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const { data: clients = [], isLoading: loading, isError, error: clientsError } = useClients(debouncedSearch);
  const { data: vehicles = [] } = useVehicles();
  const clientMutations = useClientMutations();
  const vehicleMutations = useVehicleMutations();
  const vinDecoder = useVinDecoder();

  const { workshopId } = useAuth();
  const [clientModal, setClientModal] = useState(false);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Solo cargamos órdenes del cliente seleccionado, no de todo el taller
  const { data: rawOrders } = useSupabaseCollection("orders", workshopId, {
    filter:  selected ? { column: "client_id", value: selected.id } : undefined,
    orderBy: { column: "created_at", ascending: false },
    enabled: !!selected
  });
  const selectedOrders  = rawOrders.map((row) => ({ ...row, clientId: row.client_id, totals: row.totals || {} }));
  const selectedBilling = selectedOrders.reduce((sum, order) => sum + Number(order.totals?.total || 0), 0);
  const selectedVehicles = vehicles.filter((v) => v.client?.id === selected?.id);

  function openCreate() {
    setSelected(null);
    setClientForm(EMPTY_CLIENT);
    setErrors({});
    setClientModal(true);
  }

  function openEdit(client) {
    setSelected(client);
    setClientForm({ ...EMPTY_CLIENT, ...client });
    setErrors({});
    setClientModal(true);
  }

  async function saveClient(event) {
    event.preventDefault();
    const nextErrors = validateClient(clientForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      if (selected?.id) await clientMutations.update.mutateAsync({ id: selected.id, ...clientForm });
      else await clientMutations.create.mutateAsync(clientForm);
      showToast(selected ? "Cliente actualizado." : "Cliente registrado.");
      setClientModal(false);
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function openVehicle() {
    if (!selected?.id) return;
    setVehicleForm(EMPTY_VEHICLE);
    setVehicleModal(true);
  }

  async function saveVehicle(event) {
    event.preventDefault();
    if (!vehicleForm.plate.trim()) return showToast("Ingresa la placa.", "error");
    setSaving(true);
    try {
      await vehicleMutations.create.mutateAsync({ ...vehicleForm, clientId: selected.id, plate: vehicleForm.plate.toUpperCase() });
      showToast("Vehículo registrado.");
      setVehicleModal(false);
    } catch (mutationError) {
      showToast(mutationError.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDecodeVin() {
    const vin = vehicleForm.vin.trim().toUpperCase();
    if (vin.length !== 17) return showToast("El VIN debe tener 17 caracteres.", "error");
    try {
      const decoded = await vinDecoder.mutateAsync(vin);
      setVehicleForm((current) => ({
        ...current,
        vin,
        brand: decoded.make || current.brand,
        model: decoded.model || current.model,
        year: decoded.modelYear || current.year,
        fuelType: mapFuelType(decoded.fuelType) || current.fuelType
      }));
      showToast("VIN decodificado: se completaron marca, modelo y año.");
    } catch (decodeError) {
      showToast(decodeError.message, "error");
    }
  }

  const columns = [
    { key: "name", label: "Cliente", render: (row) => <div className="cell-main"><strong>{row.name}</strong><small>{row.documentType || "Doc."} {row.documentNumber || "—"}</small></div> },
    { key: "phone", label: "Contacto", render: (row) => <div className="cell-main"><span>{row.phone || "—"}</span><small>{row.email || "Sin correo"}</small></div> },
    { key: "segment", label: "Segmento", render: (row) => <Badge tone={row.segment === "vip" ? "warning" : "info"}>{row.segment || "new"}</Badge> },
    { key: "vehicles", label: "Vehículos", render: (row) => vehicles.filter((vehicle) => vehicle.client?.id === row.id).length },
    { key: "actions", label: "", render: (row) => <Button variant="ghost" size="sm" type="button" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>Editar</Button> }
  ];

  return (
    <>
      <PageHeader eyebrow="CRM del taller" title="Clientes" description="Personas, empresas, vehículos y trazabilidad comercial." actions={<Button type="button" onClick={openCreate}>+ Nuevo cliente</Button>} />

      <div className="toolbar">
        <div className="search-box"><span>⌕</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, documento o teléfono" /></div>
        <span className="toolbar__count">{clients.length} clientes activos</span>
      </div>

      <div className="master-detail">
        <SectionCard title="Catálogo de clientes" description="Selecciona una fila para revisar su ficha.">
          {isError ? (
            <EmptyState title="No se pudo cargar" description={clientsError?.message || "Intenta de nuevo en unos segundos."} />
          ) : clients.length ? (
            <DataTable columns={columns} rows={clients} onRowClick={setSelected} />
          ) : (
            <EmptyState title={loading ? "Cargando…" : "No hay clientes"} description="Registra tu primer cliente. No se cargan datos de demostración." actionLabel="Registrar cliente" onAction={openCreate} />
          )}
        </SectionCard>

        <SectionCard title="Ficha del cliente" description={selected ? "Información consolidada" : "Selecciona un cliente"}>
          {selected ? (
            <div className="client-profile">
              <div className="client-profile__hero">
                <div className="avatar avatar--large">{selected.name?.slice(0, 2).toUpperCase()}</div>
                <div><h3>{selected.name}</h3><p>{selected.phone} · {selected.email || "Sin correo"}</p></div>
              </div>
              <div className="mini-stats">
                <div><span>Vehículos</span><strong>{selectedVehicles.length}</strong></div>
                <div><span>Órdenes</span><strong>{selectedOrders.length}</strong></div>
                <div><span>Facturación</span><strong>{formatMoney(selectedBilling, workshop.currency)}</strong></div>
              </div>
              <div className="profile-actions">
                <Button type="button" variant="secondary" onClick={openVehicle}>+ Vehículo</Button>
                <Button type="button" onClick={() => navigate(`/orders/new?client=${selected.id}`)}>Nueva orden</Button>
              </div>
              <div className="profile-list">
                <h4>Vehículos</h4>
                {selectedVehicles.length ? selectedVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="profile-list__row"><strong>{vehicle.plate}</strong><span>{vehicle.brand} {vehicle.model} {vehicle.year}</span></div>
                )) : <p className="muted">No tiene vehículos registrados.</p>}
              </div>
            </div>
          ) : <EmptyState icon="◎" title="Ficha 360°" description="Selecciona un cliente para ver vehículos, órdenes y facturación." />}
        </SectionCard>
      </div>

      <Modal open={clientModal} onClose={() => setClientModal(false)} title={selected ? "Editar cliente" : "Nuevo cliente"} subtitle="Los datos se guardan en la base SQL del taller." footer={<><Button variant="ghost" type="button" onClick={() => setClientModal(false)}>Cancelar</Button><Button type="submit" form="client-form" disabled={saving}>{saving ? "Guardando…" : "Guardar cliente"}</Button></>}>
        <form id="client-form" className="form-grid" onSubmit={saveClient}>
          <FormField label="Tipo"><Select value={clientForm.type} onChange={(event) => setClientForm({ ...clientForm, type: event.target.value })}><option value="person">Persona</option><option value="company">Empresa</option></Select></FormField>
          <FormField label="Nombre o razón social" required error={errors.name}><Input value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} /></FormField>
          <FormField label="Tipo de documento"><Select value={clientForm.documentType} onChange={(event) => setClientForm({ ...clientForm, documentType: event.target.value })}><option>DNI</option><option>RUC</option><option>CE</option><option>Pasaporte</option></Select></FormField>
          <FormField label="Número de documento"><Input value={clientForm.documentNumber} onChange={(event) => setClientForm({ ...clientForm, documentNumber: event.target.value })} /></FormField>
          <FormField label="Teléfono" required error={errors.phone}><Input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} /></FormField>
          <FormField label="Correo" error={errors.email}><Input type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /></FormField>
          <FormField label="Dirección" className="field--wide"><Input value={clientForm.address} onChange={(event) => setClientForm({ ...clientForm, address: event.target.value })} /></FormField>
          <FormField label="Segmento"><Select value={clientForm.segment} onChange={(event) => setClientForm({ ...clientForm, segment: event.target.value })}><option value="new">Nuevo</option><option value="frequent">Frecuente</option><option value="vip">VIP</option><option value="inactive">Inactivo</option></Select></FormField>
          <FormField label="Límite de crédito"><Input type="number" min="0" step="0.01" value={clientForm.creditLimit} onChange={(event) => setClientForm({ ...clientForm, creditLimit: Number(event.target.value) })} /></FormField>
          <FormField label="Notas internas" className="field--wide"><Textarea rows="3" value={clientForm.notes} onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={vehicleModal} onClose={() => setVehicleModal(false)} title="Registrar vehículo" subtitle={`Propietario: ${selected?.name || ""}`} footer={<><Button variant="ghost" type="button" onClick={() => setVehicleModal(false)}>Cancelar</Button><Button type="submit" form="vehicle-form" disabled={saving}>Guardar vehículo</Button></>}>
        <form id="vehicle-form" className="form-grid" onSubmit={saveVehicle}>
          <FormField label="Placa" required><Input value={vehicleForm.plate} onChange={(event) => setVehicleForm({ ...vehicleForm, plate: event.target.value.toUpperCase() })} /></FormField>
          <FormField label="Marca"><Input value={vehicleForm.brand} onChange={(event) => setVehicleForm({ ...vehicleForm, brand: event.target.value })} /></FormField>
          <FormField label="Modelo"><Input value={vehicleForm.model} onChange={(event) => setVehicleForm({ ...vehicleForm, model: event.target.value })} /></FormField>
          <FormField label="Año"><Input type="number" value={vehicleForm.year} onChange={(event) => setVehicleForm({ ...vehicleForm, year: event.target.value })} /></FormField>
          <FormField label="Color"><Input value={vehicleForm.color} onChange={(event) => setVehicleForm({ ...vehicleForm, color: event.target.value })} /></FormField>
          <FormField label="Combustible"><Select value={vehicleForm.fuelType} onChange={(event) => setVehicleForm({ ...vehicleForm, fuelType: event.target.value })}><option>Gasolina</option><option>Diésel</option><option>GLP</option><option>GNV</option><option>Híbrido</option><option>Eléctrico</option></Select></FormField>
          <FormField label="VIN" className="field--wide" hint="17 caracteres. Decodifica para autocompletar marca, modelo, año y combustible (fuente: NHTSA vPIC, EE.UU.).">
            <div className="row-actions">
              <Input value={vehicleForm.vin} maxLength={17} onChange={(event) => setVehicleForm({ ...vehicleForm, vin: event.target.value.toUpperCase() })} />
              <Button type="button" variant="secondary" onClick={handleDecodeVin} disabled={vinDecoder.isPending || vehicleForm.vin.trim().length !== 17}>{vinDecoder.isPending ? "Decodificando…" : "Decodificar"}</Button>
            </div>
          </FormField>
          <FormField label="Kilometraje"><Input type="number" min="0" value={vehicleForm.mileage} onChange={(event) => setVehicleForm({ ...vehicleForm, mileage: event.target.value })} /></FormField>
          <FormField label="Observaciones" className="field--wide"><Textarea rows="3" value={vehicleForm.notes} onChange={(event) => setVehicleForm({ ...vehicleForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>
    </>
  );
}
