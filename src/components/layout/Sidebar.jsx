import { NAVIGATION } from "../../config/navigation";
import { navigate } from "../../hooks/useHashRoute";
import { BrandLogo } from "../brand/BrandLogo";

export function Sidebar({ path, open, onClose }) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? "is-open" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <BrandLogo className="sidebar__brand" />
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {NAVIGATION.map((item) => {
            const active = path === item.path || (item.path !== "/dashboard" && path.startsWith(`${item.path}/`));
            return (
              <button
                key={item.path}
                type="button"
                className={`nav-item ${active ? "is-active" : ""}`}
                onClick={() => {
                  navigate(item.path);
                  onClose?.();
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <span className="status-dot" />
          <div><strong>Sistema conectado</strong><small>Datos en tiempo real</small></div>
        </div>
      </aside>
    </>
  );
}
