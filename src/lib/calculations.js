export function calculateOrderTotals(order = {}) {
  const services = (order.serviceLines || []).reduce(
    (sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 1),
    0
  );
  const parts = (order.partLines || []).reduce(
    (sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0),
    0
  );
  const external = (order.externalJobs || []).reduce(
    (sum, line) => sum + Number(line.cost || 0),
    0
  );
  const labor = Number(order.laborCost || 0);
  const other = Number(order.otherCosts || 0);
  const discount = Number(order.discount || 0);
  const total = Math.max(0, services + parts + external + labor + other - discount);
  return { services, parts, external, labor, other, discount, total };
}

export function stockState(part = {}) {
  const stock   = Number(part.stock || 0);
  const minimum = Number(part.minimumStock || part.minimum_stock || 0);
  const maximum = Number(part.maximumStock || part.maximum_stock || 0);
  if (stock <= 0)                         return "out";
  if (stock <= minimum)                   return "low";
  if (maximum > 0 && stock > maximum)     return "over";
  return "ok";
}
