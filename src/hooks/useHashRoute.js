import { useEffect, useState } from "react";

function currentPath() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "/dashboard";
}

export function navigate(path) {
  window.location.hash = path;
}

export function useHashRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const handle = () => setPath(currentPath());
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  return path;
}
