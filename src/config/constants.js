export const ORDER_STATUSES = [
  { value: "review", label: "En revisión" },
  { value: "waiting_parts", label: "Esperando repuestos" },
  { value: "external", label: "En trabajo externo" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" }
];

export const ORDER_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" }
];

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Pagado" }
];

export const USER_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "advisor", label: "Asesor" },
  { value: "mechanic", label: "Mecánico" },
  { value: "cashier", label: "Caja" }
];

export const STOCK_MOVEMENT_TYPES = [
  { value: "purchase", label: "Entrada por compra", direction: 1 },
  { value: "order_use", label: "Salida a orden", direction: -1 },
  { value: "return", label: "Devolución", direction: 1 },
  { value: "positive_adjustment", label: "Ajuste positivo", direction: 1 },
  { value: "negative_adjustment", label: "Ajuste negativo", direction: -1 }
];

export const PART_CONDITIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "usado", label: "Usado" },
  { value: "reacondicionado", label: "Reacondicionado" }
];

export const EMPTY_WORKSHOP_SETTINGS = {
  businessName: "",
  legalName: "",
  taxId: "",
  phone: "",
  email: "",
  address: "",
  currency: "PEN",
  taxRate: 18,
  laborHourRate: 0,
  dailyGoal: 0,
  orderPrefix: "OT",
  requireApproval: true,
  preventNegativeStock: true,
  notifyReady: true,
  notifyDelay: true,
  notifyDelivered: true
};
