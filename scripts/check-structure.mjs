import fs from "node:fs";
import path from "node:path";

const required = [
  "src/App.jsx",
  "src/main.jsx",
  "src/InventorySystem.jsx",
  "src/WarehouseModule.jsx",
  "src/components/layout/AppLayout.jsx",
  "src/contexts/AuthContext.jsx",
  "src/firebase/client.js",
  "src/modules/orders/OrdersPage.jsx",
  "src/modules/inventory/PartsPage.jsx",
  "src/services/orders.service.js",
  "firestore.rules",
  "storage.rules",
  "vercel.json"
];

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error("Faltan archivos:", missing.join(", "));
  process.exit(1);
}

const forbidden = ["Carlos Mendoza", "María Torres", "OT-1048", "Toyota Hilux 2021", "sampleData", "demoOrders"];
const sourceFiles = [];
function walk(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) walk(full);
    else if (/\.(js|jsx|json)$/.test(item.name)) sourceFiles.push(full);
  }
}
walk(path.resolve("src"));

const violations = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of forbidden) if (text.includes(pattern)) violations.push(`${file}: ${pattern}`);
}
if (violations.length) {
  console.error("Se encontraron datos de demostración:", violations.join("\n"));
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const dependency of ["react", "react-dom", "firebase"]) {
  if (!packageJson.dependencies?.[dependency]) throw new Error(`Falta la dependencia ${dependency}`);
}

console.log(`Estructura validada: ${required.length} archivos esenciales y ${sourceFiles.length} archivos fuente.`);
console.log("No se encontraron datos comerciales de demostración.");
