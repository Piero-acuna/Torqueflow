import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// service_role ignora RLS — nunca usar esta clave en el navegador.
let cachedClient = null;

function supabase() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw Object.assign(
      new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados."),
      { status: 500 }
    );
  }
  cachedClient = createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });
  return cachedClient;
}

export function getSupabaseAdmin() {
  return supabase();
}

/**
 * Resuelve uid -> workshopId desde la tabla users.
 * Usado por /api/auth/user para el bootstrap de sesión.
 */
export async function getUserRecord(uid) {
  const { data } = await supabase()
    .from("users")
    .select("uid, workshop_id, email")
    .eq("uid", uid)
    .maybeSingle();
  if (!data) return null;
  return {
    uid:        data.uid,
    workshopId: data.workshop_id,
    email:      data.email
  };
}

function fail(error) {
  throw Object.assign(
    new Error(error.message),
    { status: error.code === "23505" ? 409 : 502 }
  );
}

// ============================================================
// TRANSFORMADORES snake_case → camelCase
// ============================================================

function toClient(row) {
  if (!row) return null;
  return {
    id:             row.id,
    type:           row.type,
    documentType:   row.document_type,
    documentNumber: row.document_number,
    name:           row.name,
    phone:          row.phone,
    email:          row.email,
    address:        row.address,
    segment:        row.segment,
    creditLimit:    row.credit_limit,
    notes:          row.notes,
    active:         row.active,
    workshopId:     row.workshop_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
    vehicles:       row.vehicles ? row.vehicles.map(toVehicle) : undefined
  };
}

function toVehicle(row) {
  if (!row) return null;
  return {
    id:         row.id,
    plate:      row.plate,
    brand:      row.brand,
    model:      row.model,
    year:       row.year,
    color:      row.color,
    mileage:    row.mileage,
    fuelType:   row.fuel_type,
    vin:        row.vin,
    notes:      row.notes,
    active:     row.active,
    workshopId: row.workshop_id,
    client:     row.client
      ? { id: row.client.id, name: row.client.name, phone: row.client.phone, email: row.client.email }
      : undefined
  };
}

function toWorkshop(row) {
  if (!row) return null;
  return {
    id:                   row.id,
    businessName:         row.business_name,
    legalName:            row.legal_name,
    taxId:                row.tax_id,
    phone:                row.phone,
    email:                row.email,
    address:              row.address,
    currency:             row.currency,
    taxRate:              row.tax_rate,
    laborHourRate:        row.labor_hour_rate,
    dailyGoal:            row.daily_goal,
    orderPrefix:          row.order_prefix,
    nextOrderNumber:      row.next_order_number,
    requireApproval:      row.require_approval,
    preventNegativeStock: row.prevent_negative_stock,
    notifyReady:          row.notify_ready,
    notifyDelay:          row.notify_delay,
    notifyDelivered:      row.notify_delivered,   // columna de migración 0007
    active:               row.active,
    terms:                row.terms,
    documentFooter:       row.document_footer
  };
}

function toMember(row) {
  if (!row) return null;
  return {
    id:          row.id,
    uid:         row.uid,
    email:       row.email,
    displayName: row.display_name,
    role:        row.role,
    active:      row.active,
    workshopId:  row.workshop_id
  };
}

function toMechanic(row) {
  if (!row) return null;
  return {
    id:         row.id,
    name:       row.name,
    phone:      row.phone,
    specialty:  row.specialty,
    hourlyCost: row.hourly_cost,
    active:     row.active,
    workshopId: row.workshop_id
  };
}

function toService(row) {
  if (!row) return null;
  return {
    id:             row.id,
    name:           row.name,
    description:    row.description,
    categoryId:     row.category_id,
    price:          row.price,
    estimatedHours: row.estimated_hours,
    active:         row.active,
    workshopId:     row.workshop_id
  };
}

function toPart(row) {
  if (!row) return null;
  return {
    id:             row.id,
    sku:            row.sku,
    barcode:        row.barcode,
    name:           row.name,
    brand:          row.brand,
    category:       row.category,
    description:    row.description,
    unit:           row.unit,
    compatibility:  row.compatibility,
    location:       row.location,
    supplier:       row.supplier,
    stock:          row.stock,
    averageCost:    row.average_cost,
    salePrice:      row.sale_price,
    minimumStock:   row.minimum_stock,
    maximumStock:   row.maximum_stock,
    notes:          row.notes,
    condition:      row.condition,
    warrantyMonths: row.warranty_months,
    active:         row.active,
    workshopId:     row.workshop_id,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at
  };
}

function toOrder(row) {
  if (!row) return null;
  return {
    id:                row.id,
    workshopId:        row.workshop_id,
    orderNumber:       row.order_number,
    sequence:          row.sequence,
    clientId:          row.client_id,
    vehicleId:         row.vehicle_id,
    mechanicId:        row.mechanic_id,
    clientName:        row.client_name,
    clientPhone:       row.client_phone,
    vehicleLabel:      row.vehicle_label,
    plate:             row.plate,
    mechanicName:      row.mechanic_name,
    status:            row.status,
    priority:          row.priority,
    paymentStatus:     row.payment_status,
    approvalStatus:    row.approval_status,
    customerComplaint: row.customer_complaint,
    diagnosis:         row.diagnosis,
    inspectionNotes:   row.inspection_notes,
    internalNotes:     row.internal_notes,
    serviceLines:      row.service_lines  || [],
    partLines:         row.part_lines     || [],
    externalJobs:      row.external_jobs  || [],
    photoEvidence:     row.photo_evidence || [],
    timeline:          row.timeline       || [],
    laborCost:         row.labor_cost,
    otherCosts:        row.other_costs,
    discount:          row.discount,
    budget:            row.budget,
    totals:            row.totals         || {},
    fuelLevel:         row.fuel_level,
    mileage:           row.mileage,
    promisedAt:        row.promised_at,
    enteredAt:         row.entered_at,
    completedAt:       row.completed_at,
    createdBy:         row.created_by,
    active:            row.active,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at
  };
}

export { toClient, toVehicle, toWorkshop, toMember, toMechanic, toService, toPart, toOrder, fail };
