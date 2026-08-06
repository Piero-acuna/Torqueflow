import { PartsPage } from "./modules/inventory/PartsPage";

// Adaptador mantenido para proyectos que ya importaban WarehouseModule.
// El módulo utiliza el catálogo y Kardex independientes de Firestore.
export default function WarehouseModule() {
  return <PartsPage />;
}
