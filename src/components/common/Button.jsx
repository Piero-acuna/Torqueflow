export function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
