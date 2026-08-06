import { useListClients } from "@dataconnect/generated/react";

export default function ClientsCatalog() {
  const { data, isLoading, error } = useListClients();

  if (isLoading) {
    return <p>Cargando clientes...</p>;
  }

  if (error) {
    return (
      <section>
        <h2>No se pudieron cargar los clientes</h2>
        <p>{error.message}</p>
      </section>
    );
  }

  const clients = data?.clients ?? [];

  return (
    <section>
      <header>
        <h1>Clientes</h1>
        <p>{clients.length} clientes registrados</p>
      </header>

      {clients.length === 0 ? (
        <div>
          <h2>No hay clientes registrados</h2>
          <p>Los clientes nuevos aparecerán aquí.</p>
        </div>
      ) : (
        <div>
          {clients.map((client) => (
            <article key={client.id}>
              <strong>{client.name}</strong>
              <p>{client.phone || "Sin teléfono"}</p>
              <p>{client.email || "Sin correo"}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}