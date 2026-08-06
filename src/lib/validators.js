export function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function isEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateClient(input) {
  const errors = {};
  if (!required(input.name)) errors.name = "Ingresa el nombre o razón social.";
  if (!required(input.phone)) errors.phone = "Ingresa un teléfono.";
  if (!isEmail(input.email)) errors.email = "El correo no es válido.";
  return errors;
}

export function validatePart(input) {
  const errors = {};
  if (!required(input.name)) errors.name = "Ingresa el nombre del repuesto.";
  if (!required(input.sku)) errors.sku = "Ingresa un código o SKU.";
  if (Number(input.stock || 0) < 0) errors.stock = "El stock no puede ser negativo.";
  if (Number(input.cost || 0) < 0) errors.cost = "El costo no puede ser negativo.";
  return errors;
}
