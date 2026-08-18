import { useEffect, useState } from "react";
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
import { useSupabaseCollection } from "../../hooks/useSupabaseCollection";
import {
  mechanicsService,
  serviceCategoriesService,
  servicesService
} from "../../services/catalog.service";
import { saveWorkshopSettings } from "../../services/settings.service";
import { usersService } from "../../services/users.service";
import { USER_ROLES } from "../../config/constants";
import { formatMoney } from "../../lib/formatters";

const TABS = [
  { id: "business",  label: "Negocio" },
  { id: "operation", label: "Operación" },
  { id: "team",      label: "Equipo" },
  { id: "services",  label: "Servicios" },
  { id: "finance",   label: "Finanzas" },
  { id: "documents", label: "Documentos" }
];

export function SettingsPage() {
  const { workshop } = useWorkshop();
  const { isAdmin, workshopId } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab]         = useState("business");
  const [settings, setSettings] = useState(workshop);
  const [saving, setSaving]   = useState(false);
  const [mechanicModal, setMechanicModal]   = useState(false);
  const [categoryModal, setCategoryModal]   = useState(false);
  const [serviceModal, setServiceModal]     = useState(false);
  const [userModal, setUserModal]           = useState(false);
  const [mechanicForm, setMechanicForm]     = useState({ name: "", phone: "", specialty: "" });
  const [categoryForm, setCategoryForm]     = useState({ name: "", description: "" });
  const [serviceForm, setServiceForm]       = useState({ name: "", description: "", categoryId: "", price: 0 });
  const [userForm, setUserForm]             = useState({ email: "", password: "", displayName: "", role: "advisor" });

  useEffect(() => setSettings(workshop), [workshop]);

  // Supabase Realtime — reemplaza useCollection de Firebase
  const { data: mechanics }   = useSupabaseCollection("mechanics",          workshopId, { orderBy: { column: "name", ascending: true } });
  const { data: categories }  = useSupabaseCollection("service_categories", workshopId, { orderBy: { column: "name", ascending: true } });
  const { data: services }    = useSupabaseCollection("services",           workshopId, { orderBy: { column: "name", ascending: true } });

  // "members" NO se puede leer con el cliente anon (RLS sin política de
  // lectura, a propósito). Por eso no usa useSupabaseCollection como el
  // resto: se pide vía /api/admin/users, que usa service_role del lado
  // del servidor. loadMembers() se llama al montar y otra vez luego de
  // crear/editar un usuario para refrescar la lista.
  const [members, setMembers] = useState([]);

  async function loadMembers() {
    if (!workshopId) return;
    try {
      const rawMembers = await usersService.list(workshopId);
      setMembers(rawMembers.map((m) => ({
        id:          m.id,
        uid:         m.uid,
        email:       m.email,
        displayName: m.displayName,
        role:        m.role,
        active:      m.active
      })));
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  useEffect(() => { loadMembers(); }, [workshopId]);

  function update(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveWorkshopSettings({
        ...settings,
        taxRate:       Number(settings.taxRate       || 0),
        laborHourRate: Number(settings.laborHourRate || 0),
        dailyGoal:     Number(settings.dailyGoal     || 0)
      }, workshopId);
      showToast("Configuración guardada.");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function createMechanic(event) {
    event.preventDefault();
    if (!mechanicForm.name.trim()) return showToast("Ingresa el nombre.", "error");
    try {
      await mechanicsService.create(mechanicForm, workshopId);
      setMechanicForm({ name: "", phone: "", specialty: "" });
      setMechanicModal(false);
      showToast("Mecánico registrado.");
    } catch (error) { showToast(error.message, "error"); }
  }

  async function createCategory(event) {
    event.preventDefault();
    if (!categoryForm.name.trim()) return showToast("Ingresa el nombre.", "error");
    try {
      await serviceCategoriesService.create(categoryForm, workshopId);
      setCategoryForm({ name: "", description: "" });
      setCategoryModal(false);
      showToast("Categoría creada.");
    } catch (error) { showToast(error.message, "error"); }
  }

  async function createService(event) {
    event.preventDefault();
    if (!serviceForm.name.trim()) return showToast("Ingresa el nombre del servicio.", "error");
    try {
      await servicesService.create({ ...serviceForm, price: Number(serviceForm.price || 0) }, workshopId);
      setServiceForm({ name: "", description: "", categoryId: "", price: 0 });
      setServiceModal(false);
      showToast("Servicio creado.");
    } catch (error) { showToast(error.message, "error"); }
  }

  async function createUser(event) {
    event.preventDefault();
    try {
      await usersService.create(workshopId, userForm);
      setUserForm({ email: "", password: "", displayName: "", role: "advisor" });
      setUserModal(false);
      showToast("Usuario creado correctamente.");
      await loadMembers();
    } catch (error) { showToast(error.message, "error"); }
  }

  const mechanicColumns = [
    { key: "name",      label: "Mecánico",   render: (row) => <div className="cell-main"><strong>{row.name}</strong><small>{row.specialty || "Sin especialidad"}</small></div> },
    { key: "phone",     label: "Teléfono" },
    { key: "status",    label: "Estado",     render: (row) => <Badge tone={row.active === false ? "neutral" : "success"}>{row.active === false ? "Inactivo" : "Activo"}</Badge> }
  ];

  const serviceColumns = [
    { key: "name",        label: "Servicio",   render: (row) => <div className="cell-main"><strong>{row.name}</strong><small>{row.description || "Sin descripción"}</small></div> },
    { key: "categoryId",  label: "Categoría",  render: (row) => categories.find((item) => item.id === row.category_id)?.name || "Sin categoría" },
    { key: "price",       label: "Precio",     render: (row) => formatMoney(row.price || 0, settings.currency) }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administración del sistema"
        title="Configuración"
        description="Personaliza el taller y crea todos los catálogos desde cero."
        actions={
          <Button type="submit" form="settings-form" disabled={saving || !isAdmin}>
            {saving ? "Guardando…" : isAdmin ? "Guardar cambios" : "Solo lectura"}
          </Button>
        }
      />

      <div className="settings-layout">
        <nav className="settings-nav">
          {TABS.map((item) => <button type="button" key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>
        <form id="settings-form" className="settings-content" onSubmit={saveSettings}>
          {tab === "business" ? (
            <SectionCard title="Datos del negocio" description="Información que aparecerá en órdenes y reportes.">
              <div className="form-grid">
                <FormField label="Nombre comercial" required><Input value={settings.businessName || ""} onChange={(event) => update("businessName", event.target.value)} /></FormField>
                <FormField label="Razón social"><Input value={settings.legalName || ""} onChange={(event) => update("legalName", event.target.value)} /></FormField>
                <FormField label="RUC"><Input value={settings.taxId || ""} onChange={(event) => update("taxId", event.target.value)} /></FormField>
                <FormField label="Teléfono"><Input value={settings.phone || ""} onChange={(event) => update("phone", event.target.value)} /></FormField>
                <FormField label="Correo"><Input type="email" value={settings.email || ""} onChange={(event) => update("email", event.target.value)} /></FormField>
                <FormField label="Dirección" className="field--wide"><Input value={settings.address || ""} onChange={(event) => update("address", event.target.value)} /></FormField>
              </div>
            </SectionCard>
          ) : null}

          {tab === "operation" ? (
            <SectionCard title="Operación del taller" description="Reglas generales de recepción y órdenes.">
              <div className="form-grid">
                <FormField label="Prefijo de órdenes"><Input value={settings.orderPrefix || "OT"} onChange={(event) => update("orderPrefix", event.target.value.toUpperCase())} /></FormField>
                <FormField label="Siguiente correlativo"><Input value={settings.nextOrderNumber || 1} disabled hint="Se incrementa automáticamente al crear una orden." /></FormField>
                <FormField label="Moneda">
                  <Select value={settings.currency || "PEN"} onChange={(event) => update("currency", event.target.value)}>
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </Select>
                </FormField>
                <FormField label="Aprobación del cliente">
                  <Select value={settings.requireApproval ? "yes" : "no"} onChange={(event) => update("requireApproval", event.target.value === "yes")}>
                    <option value="yes">Obligatoria</option>
                    <option value="no">Opcional</option>
                  </Select>
                </FormField>
                <FormField label="Inventario negativo">
                  <Select value={settings.preventNegativeStock ? "block" : "allow"} onChange={(event) => update("preventNegativeStock", event.target.value === "block")}>
                    <option value="block">Bloquear</option>
                    <option value="allow">Permitir</option>
                  </Select>
                </FormField>
                <FormField label="Correo al cliente: pedido listo" hint="Requiere que el cliente tenga correo registrado.">
                  <Select value={settings.notifyReady ? "yes" : "no"} onChange={(event) => update("notifyReady", event.target.value === "yes")}>
                    <option value="yes">Enviar</option>
                    <option value="no">No enviar</option>
                  </Select>
                </FormField>
                <FormField label="Correo al cliente: pedido entregado" hint="Confirmación/recibo al marcar la orden como entregada.">
                  <Select value={settings.notifyDelivered ? "yes" : "no"} onChange={(event) => update("notifyDelivered", event.target.value === "yes")}>
                    <option value="yes">Enviar</option>
                    <option value="no">No enviar</option>
                  </Select>
                </FormField>
              </div>
            </SectionCard>
          ) : null}

          {tab === "team" ? (
            <div className="settings-stack">
              <SectionCard title="Mecánicos" description="Responsables que pueden asignarse a las órdenes." action={isAdmin ? <Button type="button" variant="secondary" onClick={() => setMechanicModal(true)}>+ Mecánico</Button> : null}>
                {mechanics.length ? <DataTable columns={mechanicColumns} rows={mechanics} /> : <EmptyState title="Sin mecánicos" description="Agrega los integrantes reales de tu taller." />}
              </SectionCard>
              <SectionCard title="Usuarios y permisos" description="Cuentas con acceso a la aplicación." action={isAdmin ? <Button type="button" variant="secondary" onClick={() => setUserModal(true)}>+ Usuario</Button> : null}>
                {members.length ? (
                  <div className="member-list">
                    {members.map((member) => (
                      <div key={member.id} className="member-row">
                        <div className="avatar">{member.displayName?.slice(0, 2).toUpperCase() || "US"}</div>
                        <div><strong>{member.displayName || member.email}</strong><small>{member.email}</small></div>
                        <Badge tone={member.active === false ? "neutral" : "info"}>{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState title="Sin miembros visibles" description="El propietario se crea con el script de inicialización." />}
              </SectionCard>
            </div>
          ) : null}

          {tab === "services" ? (
            <div className="settings-stack">
              <SectionCard title="Categorías de servicios" description="Crea categorías propias." action={isAdmin ? <Button type="button" variant="secondary" onClick={() => setCategoryModal(true)}>+ Categoría</Button> : null}>
                {categories.length ? <div className="chip-list">{categories.map((category) => <Badge key={category.id} tone="info">{category.name}</Badge>)}</div> : <EmptyState title="Sin categorías" description="Agrega mantenimiento, motor, frenos u otras categorías." />}
              </SectionCard>
              <SectionCard title="Catálogo de servicios" description="Precios y tiempos utilizados en Nueva Orden." action={isAdmin ? <Button type="button" onClick={() => setServiceModal(true)}>+ Servicio</Button> : null}>
                {services.length ? <DataTable columns={serviceColumns} rows={services} /> : <EmptyState title="Sin servicios" description="Crea tus servicios y precios reales." />}
              </SectionCard>
            </div>
          ) : null}

          {tab === "finance" ? (
            <SectionCard title="Finanzas" description="Parámetros para cotizaciones e indicadores.">
              <div className="form-grid">
                <FormField label="IGV (%)"><Input type="number" min="0" step="0.01" value={settings.taxRate || 0} onChange={(event) => update("taxRate", event.target.value)} /></FormField>
                <FormField label="Precio por hora"><Input type="number" min="0" step="0.01" value={settings.laborHourRate || 0} onChange={(event) => update("laborHourRate", event.target.value)} /></FormField>
                <FormField label="Meta diaria"><Input type="number" min="0" step="0.01" value={settings.dailyGoal || 0} onChange={(event) => update("dailyGoal", event.target.value)} /></FormField>
              </div>
            </SectionCard>
          ) : null}

          {tab === "documents" ? (
            <SectionCard title="Documentos" description="Texto utilizado en comprobantes e impresiones.">
              <div className="form-grid">
                <FormField label="Términos y condiciones" className="field--wide"><Textarea rows="6" value={settings.terms || ""} onChange={(event) => update("terms", event.target.value)} placeholder="Condiciones de recepción, garantía y custodia…" /></FormField>
                <FormField label="Pie del documento" className="field--wide"><Textarea rows="3" value={settings.documentFooter || ""} onChange={(event) => update("documentFooter", event.target.value)} /></FormField>
              </div>
            </SectionCard>
          ) : null}
        </form>
      </div>

      <Modal open={mechanicModal} onClose={() => setMechanicModal(false)} title="Nuevo mecánico" footer={<><Button variant="ghost" type="button" onClick={() => setMechanicModal(false)}>Cancelar</Button><Button type="submit" form="mechanic-form">Guardar</Button></>}>
        <form id="mechanic-form" className="form-grid" onSubmit={createMechanic}>
          <FormField label="Nombre" required className="field--wide"><Input value={mechanicForm.name} onChange={(event) => setMechanicForm({ ...mechanicForm, name: event.target.value })} /></FormField>
          <FormField label="Teléfono"><Input value={mechanicForm.phone} onChange={(event) => setMechanicForm({ ...mechanicForm, phone: event.target.value })} /></FormField>
          <FormField label="Especialidad"><Input value={mechanicForm.specialty} onChange={(event) => setMechanicForm({ ...mechanicForm, specialty: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Nueva categoría" footer={<><Button variant="ghost" type="button" onClick={() => setCategoryModal(false)}>Cancelar</Button><Button type="submit" form="category-form">Guardar</Button></>}>
        <form id="category-form" className="form-grid" onSubmit={createCategory}>
          <FormField label="Nombre" required className="field--wide"><Input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></FormField>
          <FormField label="Descripción" className="field--wide"><Textarea rows="3" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={serviceModal} onClose={() => setServiceModal(false)} title="Nuevo servicio" footer={<><Button variant="ghost" type="button" onClick={() => setServiceModal(false)}>Cancelar</Button><Button type="submit" form="service-form">Guardar</Button></>}>
        <form id="service-form" className="form-grid" onSubmit={createService}>
          <FormField label="Nombre" required className="field--wide"><Input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} /></FormField>
          <FormField label="Categoría">
            <Select value={serviceForm.categoryId} onChange={(event) => setServiceForm({ ...serviceForm, categoryId: event.target.value })}>
              <option value="">Sin categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Precio"><Input type="number" min="0" step="0.01" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} /></FormField>
          <FormField label="Descripción" className="field--wide"><Textarea rows="3" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Nuevo usuario" subtitle="Crea una cuenta y asigna su rol dentro del sistema." footer={<><Button variant="ghost" type="button" onClick={() => setUserModal(false)}>Cancelar</Button><Button type="submit" form="user-form">Crear usuario</Button></>}>
        <form id="user-form" className="form-grid" onSubmit={createUser}>
          <FormField label="Nombre" required><Input value={userForm.displayName} onChange={(event) => setUserForm({ ...userForm, displayName: event.target.value })} /></FormField>
          <FormField label="Rol">
            <Select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
              {(USER_ROLES || []).map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Correo" required><Input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></FormField>
          <FormField label="Contraseña temporal" required><Input type="password" minLength="8" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></FormField>
        </form>
      </Modal>
    </>
  );
}
