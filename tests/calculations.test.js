import test from "node:test";
import assert from "node:assert/strict";
import { calculateOrderTotals, stockState } from "../src/lib/calculations.js";

 test("calcula el total de una orden sin datos de demostración", () => {
  const totals = calculateOrderTotals({
    serviceLines: [{ price: 100, quantity: 2 }],
    partLines: [{ unitPrice: 50, quantity: 3 }],
    externalJobs: [{ cost: 80 }],
    laborCost: 120,
    otherCosts: 20,
    discount: 30
  });
  assert.equal(totals.services, 200);
  assert.equal(totals.parts, 150);
  assert.equal(totals.external, 80);
  assert.equal(totals.total, 540);
});

test("nunca devuelve un total negativo", () => {
  assert.equal(calculateOrderTotals({ discount: 100 }).total, 0);
});

test("clasifica el stock correctamente", () => {
  assert.equal(stockState({ stock: 0, minimumStock: 2 }), "out");
  assert.equal(stockState({ stock: 2, minimumStock: 2 }), "low");
  assert.equal(stockState({ stock: 5, minimumStock: 2, maximumStock: 10 }), "ok");
  assert.equal(stockState({ stock: 12, minimumStock: 2, maximumStock: 10 }), "over");
});
