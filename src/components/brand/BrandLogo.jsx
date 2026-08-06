export function BrandLogo({ className = "", size = "default" }) {
  const classes = ["brand-logo", `brand-logo--${size}`, className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-label="TorqueFlow">
      <img src="/torqueflow-mark.svg" alt="" aria-hidden="true" />
      <strong>TorqueFlow</strong>
    </div>
  );
}
