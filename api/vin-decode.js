// api/vin-decode.js
//
// Decodifica un VIN usando la API pública y gratuita del NHTSA (vPIC —
// Vehicle Product Information Catalog), https://vpic.nhtsa.dot.gov/api/.
// No requiere API key ni tiene límite de uso documentado. Es la referencia
// oficial del gobierno de EE.UU. y cubre el estándar ISO 3779 (WMI), por lo
// que decodifica razonablemente bien VINs de fabricantes globales, aunque
// los campos específicos de mercado (versión/trim local) están más
// completos para vehículos vendidos en EE.UU./Norteamérica.
import { parseBody, requireMember, resolveWorkshopId, send } from "./_lib/firebase-admin.js";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i; // 17 caracteres, sin I, O, Q (estándar ISO 3779)

// Mapeamos solo los campos con Value real (NHTSA devuelve ~150 filas, la
// mayoría vacías para un VIN dado) a nombres útiles para el formulario.
const FIELD_MAP = {
  Make: "make",
  Model: "model",
  "Model Year": "modelYear",
  "Vehicle Type": "vehicleType",
  "Body Class": "bodyClass",
  "Fuel Type - Primary": "fuelType",
  "Engine Number of Cylinders": "engineCylinders",
  "Displacement (L)": "engineDisplacementL",
  "Drive Type": "driveType",
  Trim: "trim",
  "Plant Country": "plantCountry",
  "Error Text": "errorText"
};

export default async function handler(request, response) {
  try {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      return send(response, 405, { error: "Método no permitido." });
    }
    const body = parseBody(request);
    const workshopId = resolveWorkshopId(request, body);
    await requireMember(request, workshopId);

    const qs = new URL(request.url, "http://localhost").searchParams;
    const vin = (qs.get("vin") || "").trim().toUpperCase();

    if (!VIN_REGEX.test(vin)) {
      return send(response, 400, { error: "VIN inválido: debe tener 17 caracteres (sin I, O, Q)." });
    }

    const nhtsaResponse = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    if (!nhtsaResponse.ok) {
      return send(response, 502, { error: "El servicio de decodificación de VIN no respondió." });
    }
    const payload = await nhtsaResponse.json();
    const rows = payload?.Results || [];

    const decoded = {};
    for (const row of rows) {
      const key = FIELD_MAP[row.Variable];
      if (key && row.Value && row.Value !== "Not Applicable") decoded[key] = row.Value;
    }

    // "Error Text" con código 0 significa "sin errores" — no es un error real.
    const errorText = decoded.errorText || "";
    delete decoded.errorText;
    const hasCriticalError = /^[^0]/.test(errorText) && !/^0\b/.test(errorText);

    if (!decoded.make && !decoded.model) {
      return send(response, 404, {
        error: hasCriticalError
          ? `No se pudo decodificar este VIN: ${errorText}`
          : "No se encontraron datos para este VIN."
      });
    }

    return send(response, 200, { vin, decoded });
  } catch (error) {
    console.error(error);
    return send(response, error.status || 500, { error: error.message || "Error interno." });
  }
}
