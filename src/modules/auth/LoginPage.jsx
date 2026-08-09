import { useEffect, useState } from "react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/common/Button";
import { FormField, Input } from "../../components/common/FormField";
import { useAuth } from "../../contexts/AuthContext";
import { getLockoutStatus, formatRemaining } from "../../lib/loginAttempts";

const EMPTY_REGISTER_FORM = { workshopName: "", ownerName: "", email: "", password: "", confirmPassword: "" };

export function LoginPage() {
  const { login, register, resetPassword, error } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER_FORM);
  const [registerError, setRegisterError] = useState("");
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

  async function handleRegister(event) {
    event.preventDefault();
    setRegisterError("");
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError("Las contraseñas no coinciden.");
      return;
    }
    if (registerForm.password.length < 8) {
      setRegisterError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await register(registerForm);
      // Si register() no lanza error, ya inició sesión automáticamente
      // (llama a login() internamente) y App.jsx redirige solo.
    } catch (registerErr) {
      setRegisterError(registerErr.message);
    } finally {
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

  if (mode === "register") {
    return (
      <main className="auth-page auth-page--center">
        <section className="auth-card">
          <BrandLogo className="auth-card__brand" size="large" />
          <div>
            <span className="eyebrow">Nuevo taller</span>
            <h2>Crea tu taller en TorqueFlow</h2>
            <p>Esto crea un espacio de trabajo nuevo e independiente. Serás el administrador.</p>
          </div>
          <form className="form-stack" onSubmit={handleRegister}>
            <FormField label="Nombre del taller" required>
              <Input value={registerForm.workshopName} onChange={(event) => setRegisterForm({ ...registerForm, workshopName: event.target.value })} required />
            </FormField>
            <FormField label="Tu nombre" required>
              <Input value={registerForm.ownerName} onChange={(event) => setRegisterForm({ ...registerForm, ownerName: event.target.value })} required />
            </FormField>
            <FormField label="Correo electrónico" required>
              <Input type="email" autoComplete="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} required />
            </FormField>
            <FormField label="Contraseña" required>
              <Input type="password" autoComplete="new-password" minLength="8" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} required />
            </FormField>
            <FormField label="Confirmar contraseña" required>
              <Input type="password" autoComplete="new-password" minLength="8" value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} required />
            </FormField>
            {registerError ? <div className="form-alert form-alert--error">{registerError}</div> : null}
            <Button type="submit" disabled={submitting}>{submitting ? "Creando taller…" : "Crear taller"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setMode("login"); setRegisterError(""); }}>Ya tengo una cuenta</Button>
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
          <Button type="button" variant="ghost" onClick={() => { setMode("register"); setRegisterError(""); }}>Crear un taller nuevo</Button>
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
