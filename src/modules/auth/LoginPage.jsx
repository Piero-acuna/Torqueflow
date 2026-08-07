import { useEffect, useState } from "react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/common/Button";
import { FormField, Input } from "../../components/common/FormField";
import { useAuth } from "../../contexts/AuthContext";
import { getLockoutStatus, formatRemaining } from "../../lib/loginAttempts";

export function LoginPage() {
  const { login, resetPassword, error } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login");
  const [resetMessage, setResetMessage] = useState("");
  const [lockout, setLockout] = useState({ locked: false, remainingMs: 0 });

  useEffect(() => {
    if (!lockout.locked) return undefined;
    const interval = setInterval(() => {
      const next = getLockoutStatus(form.email);
      setLockout(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockout.locked, form.email]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
    } catch {
      setLockout(getLockoutStatus(form.email));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    if (!form.email.trim()) return;
    setSubmitting(true);
    setResetMessage("");
    try {
      await resetPassword(form.email.trim());
    } catch {
      // No revelamos si el correo existe o no: mismo mensaje en ambos casos.
    } finally {
      setResetMessage("Si el correo pertenece a una cuenta del taller, enviamos un enlace para restablecer la contraseña.");
      setSubmitting(false);
    }
  }

  if (mode === "reset") {
    return (
      <main className="auth-page auth-page--center">
        <section className="auth-card">
          <BrandLogo className="auth-card__brand" size="large" />
          <div>
            <span className="eyebrow">Recuperar acceso</span>
            <h2>Restablecer contraseña</h2>
            <p>Te enviaremos un enlace a tu correo para crear una nueva contraseña.</p>
          </div>
          <form className="form-stack" onSubmit={handleReset}>
            <FormField label="Correo electrónico" required>
              <Input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </FormField>
            {resetMessage ? <div className="form-alert form-alert--success">{resetMessage}</div> : null}
            <Button type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar enlace"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("login"); setResetMessage(""); }}>Volver a iniciar sesión</Button>
          </form>
        </section>
      </main>
    );
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
          <Button type="submit" disabled={submitting || lockout.locked}>
            {lockout.locked ? `Bloqueado (${formatRemaining(lockout.remainingMs)})` : submitting ? "Ingresando…" : "Ingresar"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setMode("reset"); setResetMessage(""); }}>Olvidé mi contraseña</Button>
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
