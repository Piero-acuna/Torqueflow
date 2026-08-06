import { Button } from "./Button";

export function EmptyState({ icon = "◇", title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel ? <Button type="button" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}
