import { NavLink, Outlet, useLocation } from "react-router-dom";

export const ADMIN_NAV = [
  { to: "/admin/overview", label: "Resumen", icon: "bi-speedometer2", end: true },
  { to: "/admin/requests", label: "Solicitudes", icon: "bi-inbox", end: true },
  { to: "/admin/venues", label: "Espacios", icon: "bi-geo-alt" },
  { to: "/admin/content", label: "Contenido", icon: "bi-newspaper", end: true },
  { to: "/admin/users", label: "Usuarios", icon: "bi-people", end: true },
  { to: "/admin/reports", label: "Denuncias", icon: "bi-flag", end: true },
] as const;

export function AdminLayout() {
  const location = useLocation();

  function isItemActive(to: string, end?: boolean) {
    if (to === "/admin/requests" && location.pathname.startsWith("/admin/venue-requests/")) {
      return true;
    }
    if (end) return location.pathname === to;
    return (
      location.pathname === to || location.pathname.startsWith(`${to}/`)
    );
  }

  return (
    <div className="admin-shell fade-in">
      <aside className="admin-sidebar d-none d-lg-flex" aria-label="Navegación admin">
        <p className="admin-sidebar-title">Panel</p>
        <div className="admin-nav">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={() =>
                `admin-nav-link${isItemActive(item.to, "end" in item ? item.end : false) ? " is-active" : ""}`
              }
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
