import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { initials } from "../../lib/formatters";
import { navigate } from "../../hooks/useHashRoute";

export function Topbar({ onMenu }) {
  const { user, member, logout } = useAuth();
  const [query, setQuery] = useState("");

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/orders?search=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="topbar">
      <button className="icon-button topbar__menu" type="button" onClick={onMenu} aria-label="Abrir menú">☰</button>
      <form className="global-search" onSubmit={submitSearch}>
        <span>⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar orden, placa o cliente" />
      </form>
      <div className="topbar__user">
        <div className="avatar">{initials(member?.displayName || user?.email)}</div>
        <div className="topbar__identity">
          <strong>{member?.displayName || user?.email}</strong>
          <span>{member?.role || "Usuario"}</span>
        </div>
        <button className="button button--ghost button--sm" type="button" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
