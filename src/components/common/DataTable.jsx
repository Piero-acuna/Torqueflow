export function DataTable({ columns, rows, rowKey = "id", onRowClick, emptyMessage = "No hay registros." }) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row[rowKey]} onClick={() => onRowClick?.(row)} className={onRowClick ? "is-clickable" : ""}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? "—"}</td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length} className="table-empty">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
