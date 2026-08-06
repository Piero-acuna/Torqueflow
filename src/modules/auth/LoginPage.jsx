import { useState } from "react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/common/Button";
import { FormField, Input } from "../../components/common/FormField";
import { useAuth } from "../../contexts/AuthContext";

export function LoginPage() {
  const { login, error } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
    } catch {
      // El contexto muestra el mensaje amigable.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <BrandLogo size="hero" />
        <h1>Control total del taller, desde una sola pantalla.</h1>
        <p>Administra órdenes, clientes, repuestos, costos y tiempos con información sincronizada en cada área.</p>
        <div className="auth-grid">
          <div><strong>Órdenes</strong><span>Seguimiento de principio a fin</span></div>
          <div><strong>Inventario</strong><span>Stock y movimientos controlados</span></div>
          <div><strong>Finanzas</strong><span>Costos y márgenes visibles</span></div>
        </div>
      </section>
      <section className="auth-card">
        <BrandLogo className="auth-card__brand" size="large" />
        <div>
          <span className="eyebrow">Bienvenido</span>
          <h2>Inicia sesión</h2>
          <p>Ingresa con tu correo y contraseña.</p>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <FormField label="Correo electrónico" required>
            <Input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </FormField>
          <FormField label="Contraseña" required>
            <Input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </FormField>
          {error ? <div className="form-alert form-alert--error">{error}</div> : null}
          <Button type="submit" disabled={submitting}>{submitting ? "Ingresando…" : "Ingresar"}</Button>
        </form>
      </section>
    </main>
  );
}

export function AccessPending() {
  const { user, logout } = useAuth();
  return (
    <main className="auth-page auth-page--center">
      <section className="auth-card">
        <BrandLogo className="auth-card__brand" size="large" />
        <span className="eyebrow">Acceso pendiente</span>
        <h2>Tu cuenta aún no tiene acceso</h2>
        <p>El usuario <strong>{user?.email}</strong> todavía no ha sido habilitado por un administrador.</p>
        <Button type="button" variant="secondary" onClick={logout}>Cerrar sesión</Button>
      </section>
    </main>
  );
}
