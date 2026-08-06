import { BrandLogo } from "../brand/BrandLogo";

export function LoadingScreen({ message = "Cargando información…" }) {
  return (
    <div className="loading-screen">
      <BrandLogo size="large" />
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}
