import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

import { useListClients } from "@dataconnect/generated/react";

export default function ClientsCatalog() {
  const { data, isLoading, error } = useListClients();

  if (isLoading) return <p>Cargando clientes...</p>;
  if (error) return <p>No se pudieron cargar los clientes.</p>;

  return (
    <div>
      {data?.clients?.map((client) => (
        <article key={client.id}>
          <strong>{client.name}</strong>
          <span>{client.phone || "Sin teléfono"}</span>
        </article>
      ))}
    </div>
  );
}