import { useState } from "react";
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
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { stockState } from "../../lib/calculations";
import { formatDate, formatMoney, normalizeText } from "../../lib/formatters";
import { validatePart } from "../../lib/validators";
import { partsService, registerStockMovement } from "../../services/inventory.service";
import { STOCK_MOVEMENT_TYPES, PART_CONDITIONS } from "../../config/constants";
import { downloadCsv } from "../../utils/csv";

const EMPTY_PART = {
  sku: "",
  barcode: "",
  name: "",
  brand: "",
  category: "",
  unit: "unidad",
  compatibility: "",
  location: "",
  supplier: "",
  minimumStock: 0,
  maximumStock: 0,
  averageCost: 0,
  salePrice: 0,
  notes: "",
  condition: "nuevo",
  warrantyMonths: 0
};

const EMPTY_MOVEMENT = {
  partId: "",
  type: "purchase",
  quantity: 1,
  unitCost: 0,
  reference: "",
  supplier: "",
  notes: ""
};

function stockBadge(part) {
  const state = stockState(part);
  if (state === "out") return <Badge tone="danger">Agotado</Badge>;
  if (state === "low") return <Badge tone="warning">Stock bajo</Badge>;
  if (state === "over") return <Badge tone="info">Sobrestock</Badge>;
  return <Badge tone="success">Disponible</Badge>;
}

function conditionBadge(condition) {
  if (condition === "usado") return <Badge tone="warning">Usado</Badge>;
  if (condition === "reacondicionado") return <Badge tone="info">Reacondicionado</Badge>;
  return <Badge tone="success">Nuevo</Badge>;
}

export function PartsPage() {
  const { user, workshopId } = useAuth();
  const { workshop } = useWorkshop();
  const { showToast } = useToast();

  // Supabase Realtime — reemplaza useCollection + partsRef / stockMovementsRef
  const { data: rawParts, loading } = useSupabaseCollection("parts", workshopId, {
    orderBy: { column: "name", ascending: true }
  });
  const { data: rawMovements } = useSupabaseCollection("stock_movements", workshopId, {
    orderBy: { column: "created_at", ascending: false }
  });

  // Normalizar snake_case → camelCase para compatibilidad con helpers existentes
  const parts = rawParts.map((row) => ({
    ...row,
    minimumStock: row.minimum_stock ?? row.minimumStock ?? 0,
    maximumStock: row.maximum_stock ?? row.maximumStock ?? 0,
    averageCost:  row.average_cost  ?? row.averageCost  ?? 0,
    salePrice:    row.sale_price    ?? row.salePrice    ?? 0
  }));
  const movements = rawMovements.map((row) => ({
    ...row,
    partName:      row.part_name      ?? row.partName      ?? "",
    actorName:     row.actor_name     ?? row.actorName     ?? "",
    previousStock: row.previous_stock ?? row.previousStock ?? 0,
    nextStock:     row.next_stock     ?? row.nextStock     ?? 0,
    createdAt:     row.created_at     ?? row.createdAt
  }));

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const debounced = useDebouncedValue(search);
  const [partModal, setPartModal] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [partForm, setPartForm] = useState(EMPTY_PART);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const activeParts = parts.filter((part) => part.active !== false);
  const filtered = activeParts.filter((part) => {
    if (stockFilter !== "all" && stockState(part) !== stockFilter) return false;
    const text = normalizeText(`${part.sku} ${part.barcode} ${part.name} ${part.brand} ${part.category} ${part.supplier} ${part.location}`);
    return text.includes(normalizeText(debounced));
  });
  const inventoryValue = activeParts.reduce((sum, part) => sum + Number(part.stock || 0) * Number(part.averageCost || 0), 0);
  const potentialSale = activeParts.reduce((sum, part) => sum + Number(part.stock || 0) * Number(part.salePrice || 0), 0);
  const lowCount = activeParts.filter((part) => ["out", "low"].includes(stockState(part))).length;

  function openCreate() {
    setSelected(null);
    setPartForm(EMPTY_PART);
    setErrors({});
    setPartModal(true);
  }

  function openEdit(part) {
    setSelected(part);
    setPartForm({ ...EMPTY_PART, ...part });
    setErrors({});
    setPartModal(true);
  }

  async function savePart(event) {
    event.preventDefault();
    const nextErrors = validatePart(partForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const payload = {
        ...partForm,
        minimumStock: Number(partForm.minimumStock || 0),
        maximumStock: Number(partForm.maximumStock || 0),
        averageCost: Number(partForm.averageCost || 0),
        salePrice: Number(partForm.salePrice || 0),
        ...(selected ? {} : { stock: 0 })
      };
      if (selected) await partsService.update(selected.id, payload, workshopId);
      else await partsService.create(payload, workshopId);
      showToast(selected ? "Repuesto actualizado." : "Repuesto creado con stock inicial cero.");
      setPartModal(false);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function openMovement(part = null) {
    setMovementForm({ ...EMPTY_MOVEMENT, partId: part?.id || "", unitCost: Number(part?.averageCost || 0) });
    setMovementModal(true);
  }

  async function saveMovement(event) {
    event.preventDefault();
    if (!movementForm.partId) return showToast("Selecciona un repuesto.", "error");
    setSaving(true);
    try {
      const part = parts.find((item) => item.id === movementForm.partId);
      await registerStockMovement({
        ...movementForm,
        partName: part?.name || "",
        quantity: Number(movementForm.quantity || 0),
        unitCost: Number(movementForm.unitCost || 0)
      }, user, workshopId);
      showToast("Movimiento registrado correctamente.");
      setMovementModal(false);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      "inventario-repuestos.csv",
      ["SKU", "Nombre", "Marca", "Categoría", "Stock", "Costo promedio", "Precio venta", "Ubicación", "Proveedor"],
      filtered.map((part) => [part.sku, part.name, part.brand, part.category, part.stock || 0, part.averageCost || 0, part.salePrice || 0, part.location, part.supplier])
    );
  }

  const columns = [
    { key: "name", label: "Repuesto", render: (row) => <div className="cell-main"><strong>{row.name}</strong><small>{row.sku || "Sin SKU"} · {row.brand || "Sin marca"}</small></div> },
    { key: "category", label: "Categoría" },
    { key: "condition", label: "Estado", render: (row) => conditionBadge(row.condition) },
    { key: "stock", label: "Stock", render: (row) => <div className="stock-cell"><strong>{row.stock || 0} {row.unit || "unidad"}</strong>{stockBadge(row)}</div> },
    { key: "cost", label: "Costo / Venta", render: (row) => <div className="cell-main"><span>{formatMoney(row.averageCost || 0, workshop.currency)}</span><small>{formatMoney(row.salePrice || 0, workshop.currency)}</small></div> },
    { key: "warranty", label: "Garantía", render: (row) => row.warrantyMonths > 0 ? `${row.warrantyMonths} ${row.warrantyMonths === 1 ? "mes" : "meses"}` : "Sin garantía" },
    { key: "location", label: "Ubicación" },
    { key: "supplier", label: "Proveedor" },
    { key: "actions", label: "Acciones", render: (row) => <div className="row-actions"><Button size="sm" variant="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>Editar</Button><Button size="sm" variant="secondary" type="button" onClick={(event) => { event.stopPropagation(); openMovement(row); }}>Movimiento</Button></div> }
  ];

  const movementColumns = [
    { key: "date", label: "Fecha", render: (row) => formatDate(row.createdAt, { withTime: true }) },
    { key: "partName", label: "Repuesto" },
    { key: "type", label: "Movimiento", render: (row) => STOCK_MOVEMENT_TYPES.find((item) => item.value === row.type)?.label || row.type },
    { key: "quantity", label: "Cantidad", render: (row) => `${row.direction > 0 ? "+" : "−"}${row.quantity}` },
    { key: "stock", label: "Stock", render: (row) => `${row.previousStock} → ${row.nextStock}` },
    { key: "reference", label: "Referencia" },
    { key: "actorName", label: "Usuario" }
  ];

  return (
    <>
      <PageHeader eyebrow="Inventario y Kardex" title="Repuestos" description="Catálogo, existencias, compras, consumos, ajustes y trazabilidad." actions={<><Button variant="secondary" type="button" onClick={exportCsv} disabled={!filtered.length}>Exportar</Button><Button variant="secondary" type="button" onClick={() => openMovement()}>Registrar movimiento</Button><Button type="button" onClick={openCreate}>+ Nuevo repuesto</Button></>} />

      <div className="stats-grid stats-grid--compact">
        <div className="metric-strip"><span>Repuestos activos</span><strong>{activeParts.length}</strong></div>
        <div className="metric-strip"><span>Valor a costo</span><strong>{formatMoney(inventoryValue, workshop.currency)}</strong></div>
        <div className="metric-strip"><span>Potencial de venta</span><strong>{formatMoney(potentialSale, workshop.currency)}</strong></div>
        <div className="metric-strip"><span>Requieren reposición</span><strong>{lowCount}</strong></div>
      </div>

      <div className="toolbar toolbar--wrap">
        <div className="search-box"><span>⌕</span><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU, nombre, marca, categoría, proveedor o ubicación" /></div>
        <Select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Todo el stock</option><option value="out">Agotado</option><option value="low">Stock bajo</option><option value="ok">Disponible</option><option value="over">Sobrestock</option></Select>
        <span className="toolbar__count">{filtered.length} artículos</span>
      </div>

      <SectionCard title="Catálogo de repuestos" description="El stock solo cambia mediante movimientos o consumo en órdenes.">
        {filtered.length ? <DataTable columns={columns} rows={filtered} /> : <EmptyState title={loading ? "Cargando inventario…" : "No hay repuestos"} description="Crea tu primer artículo. El proyecto no contiene productos de demostración." actionLabel="Crear repuesto" onAction={openCreate} />}
      </SectionCard>

      <SectionCard title="Últimos movimientos" description="Kardex inmutable de entradas, salidas, devoluciones y ajustes.">
        {movements.length ? <DataTable columns={movementColumns} rows={movements.slice(0, 30)} /> : <EmptyState title="Kardex vacío" description="Los movimientos de inventario aparecerán aquí." />}
      </SectionCard>

      <Modal open={partModal} onClose={() => setPartModal(false)} title={selected ? "Editar repuesto" : "Nuevo repuesto"} subtitle="El stock inicial permanece en cero; regístralo mediante un movimiento." footer={<><Button variant="ghost" type="button" onClick={() => setPartModal(false)}>Cancelar</Button><Button type="submit" form="part-form" disabled={saving}>Guardar repuesto</Button></>}>
        <form id="part-form" className="form-grid" onSubmit={savePart}>
          <FormField label="Código / SKU" required error={errors.sku}><Input value={partForm.sku} onChange={(event) => setPartForm({ ...partForm, sku: event.target.value.toUpperCase() })} /></FormField>
          <FormField label="Código de barras"><Input value={partForm.barcode} onChange={(event) => setPartForm({ ...partForm, barcode: event.target.value })} /></FormField>
          <FormField label="Nombre" required error={errors.name} className="field--wide"><Input value={partForm.name} onChange={(event) => setPartForm({ ...partForm, name: event.target.value })} /></FormField>
          <FormField label="Marca"><Input value={partForm.brand} onChange={(event) => setPartForm({ ...partForm, brand: event.target.value })} /></FormField>
          <FormField label="Categoría"><Input value={partForm.category} onChange={(event) => setPartForm({ ...partForm, category: event.target.value })} placeholder="Motor, frenos, filtros…" /></FormField>
          <FormField label="Unidad"><Select value={partForm.unit} onChange={(event) => setPartForm({ ...partForm, unit: event.target.value })}><option value="unidad">Unidad</option><option value="juego">Juego</option><option value="litro">Litro</option><option value="metro">Metro</option><option value="caja">Caja</option></Select></FormField>
          <FormField label="Estado de la pieza"><Select value={partForm.condition} onChange={(event) => setPartForm({ ...partForm, condition: event.target.value })}>{PART_CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
          <FormField label="Garantía del proveedor (meses)"><Input type="number" min="0" step="1" value={partForm.warrantyMonths} onChange={(event) => setPartForm({ ...partForm, warrantyMonths: event.target.value })} placeholder="0 = sin garantía" /></FormField>
          <FormField label="Ubicación"><Input value={partForm.location} onChange={(event) => setPartForm({ ...partForm, location: event.target.value })} /></FormField>
          <FormField label="Proveedor"><Input value={partForm.supplier} onChange={(event) => setPartForm({ ...partForm, supplier: event.target.value })} /></FormField>
          <FormField label="Stock mínimo"><Input type="number" min="0" value={partForm.minimumStock} onChange={(event) => setPartForm({ ...partForm, minimumStock: event.target.value })} /></FormField>
          <FormField label="Stock máximo"><Input type="number" min="0" value={partForm.maximumStock} onChange={(event) => setPartForm({ ...partForm, maximumStock: event.target.value })} /></FormField>
          <FormField label="Costo promedio"><Input type="number" min="0" step="0.01" value={partForm.averageCost} onChange={(event) => setPartForm({ ...partForm, averageCost: event.target.value })} /></FormField>
          <FormField label="Precio de venta"><Input type="number" min="0" step="0.01" value={partForm.salePrice} onChange={(event) => setPartForm({ ...partForm, salePrice: event.target.value })} /></FormField>
          <FormField label="Compatibilidad" className="field--wide"><Textarea rows="2" value={partForm.compatibility} onChange={(event) => setPartForm({ ...partForm, compatibility: event.target.value })} placeholder="Modelos, motores o aplicaciones" /></FormField>
          <FormField label="Notas" className="field--wide"><Textarea rows="2" value={partForm.notes} onChange={(event) => setPartForm({ ...partForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>

      <Modal open={movementModal} onClose={() => setMovementModal(false)} title="Movimiento de inventario" subtitle="La operación actualiza stock y Kardex en una única transacción." footer={<><Button variant="ghost" type="button" onClick={() => setMovementModal(false)}>Cancelar</Button><Button type="submit" form="movement-form" disabled={saving}>Registrar movimiento</Button></>}>
        <form id="movement-form" className="form-grid" onSubmit={saveMovement}>
          <FormField label="Repuesto" required className="field--wide"><Select value={movementForm.partId} onChange={(event) => { const part = parts.find((item) => item.id === event.target.value); setMovementForm({ ...movementForm, partId: event.target.value, unitCost: Number(part?.averageCost || 0) }); }}><option value="">Selecciona un repuesto</option>{activeParts.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name} · stock {part.stock || 0}</option>)}</Select></FormField>
          <FormField label="Tipo de movimiento"><Select value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}>{STOCK_MOVEMENT_TYPES.filter((item) => item.value !== "order_use").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></FormField>
          <FormField label="Cantidad"><Input type="number" min="1" step="1" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} /></FormField>
          <FormField label="Costo unitario"><Input type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={(event) => setMovementForm({ ...movementForm, unitCost: event.target.value })} /></FormField>
          <FormField label="Factura / referencia"><Input value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} /></FormField>
          <FormField label="Proveedor / responsable"><Input value={movementForm.supplier} onChange={(event) => setMovementForm({ ...movementForm, supplier: event.target.value })} /></FormField>
          <FormField label="Observaciones" className="field--wide"><Textarea rows="3" value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} /></FormField>
        </form>
      </Modal>
    </>
  );
}
