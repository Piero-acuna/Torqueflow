import test from "node:test";
import assert from "node:assert/strict";
import { validateClient, validatePart } from "../src/lib/validators.js";

test("valida los campos mínimos del cliente", () => {
  assert.deepEqual(Object.keys(validateClient({ name: "", phone: "", email: "invalido" })).sort(), ["email", "name", "phone"]);
  assert.deepEqual(validateClient({ name: "Cliente", phone: "999999999", email: "correo@dominio.com" }), {});
});

test("valida un repuesto", () => {
  const errors = validatePart({ name: "", sku: "", stock: -1, cost: -1 });
  assert.ok(errors.name && errors.sku && errors.stock && errors.cost);
});
