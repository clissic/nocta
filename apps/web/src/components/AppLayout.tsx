import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ADMIN_NAV } from "./admin/AdminLayout";
import { AppFooter } from "./AppFooter";
import { NoctaWordmark } from "./NoctaWordmark";

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

function discoverClass({ isActive }: { isActive: boolean }) {
  return ["nav-discover", isActive ? "active" : undefined].filter(Boolean).join(" ");
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  useEffect(() => {
    setAdminMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!adminMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdminMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [adminMenuOpen]);

  function isAdminItemActive(to: string, end?: boolean) {
    if (to === "/admin/requests" && location.pathname.startsWith("/admin/venue-requests/")) {
      return true;
    }
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  const logoutBtn = (
    <button
      className="btn btn-sm btn-link link-light text-decoration-none p-0 app-top-logout"
      type="button"
      onClick={() => {
        logout();
        navigate("/login");
      }}
      aria-label="Salir"
    >
      <i className="bi bi-box-arrow-right fs-5" aria-hidden="true"></i>
    </button>
  );

  if (isAdmin) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <header className="app-top admin-top">
            <NavLink className="brand admin-brand" to="/admin/overview" aria-label="Nocta Admin">
              <span className="admin-brand-wordmark">
                <NoctaWordmark />
              </span>
              <img
                className="admin-brand-moon"
                src="/images/nocta-logo-limaneon-nobg.png"
                alt=""
                aria-hidden="true"
              />
            </NavLink>
            <span className="nav-discover admin-role-pill">
              <i className="bi bi-shield-check" aria-hidden="true" />
              Admin
            </span>
            <span className="admin-desktop-logout">{logoutBtn}</span>
            <button
              className="admin-menu-toggle"
              type="button"
              aria-label="Abrir menú administrativo"
              aria-controls="admin-drawer"
              aria-expanded={adminMenuOpen}
              onClick={() => setAdminMenuOpen(true)}
            >
              <i className="bi bi-list" aria-hidden="true" />
            </button>
          </header>
          <button
            className={`admin-drawer-backdrop${adminMenuOpen ? " is-open" : ""}`}
            type="button"
            aria-label="Cerrar menú administrativo"
            tabIndex={adminMenuOpen ? 0 : -1}
            onClick={() => setAdminMenuOpen(false)}
          />
          <aside
            id="admin-drawer"
            className={`admin-drawer${adminMenuOpen ? " is-open" : ""}`}
            aria-label="Navegación administrativa"
            aria-hidden={!adminMenuOpen}
          >
            <div className="admin-drawer-head">
              <span>Panel admin</span>
              <button
                type="button"
                aria-label="Cerrar menú administrativo"
                onClick={() => setAdminMenuOpen(false)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <nav className="admin-drawer-nav">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  className={
                    isAdminItemActive(item.to, "end" in item ? item.end : false)
                      ? "is-active"
                      : undefined
                  }
                  tabIndex={adminMenuOpen ? 0 : -1}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </NavLink>
              ))}
            </nav>
            <button
              className="admin-drawer-logout"
              type="button"
              tabIndex={adminMenuOpen ? 0 : -1}
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </aside>
          <main className="app-main admin-main px-3 px-md-4">
            <Outlet />
            <AppFooter className="d-none d-md-flex" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-top">
          <NavLink className="brand" to="/">
            <NoctaWordmark />
          </NavLink>

          {/* Tablet + desktop */}
          <nav className="top-nav" aria-label="Navegación principal">
            <NavLink to="/" end className={linkClass}>
              <i className="bi bi-newspaper" aria-hidden="true" />
              Muro
            </NavLink>
            <NavLink to="/venues" className={linkClass}>
              <i className="bi bi-geo-alt" aria-hidden="true" />
              Espacios
            </NavLink>
            <NavLink to="/discover" className={discoverClass}>
              <i className="bi bi-fire" aria-hidden="true" />
              Discover
            </NavLink>
            <NavLink to="/matches" className={linkClass}>
              <i className="bi bi-chat-heart" aria-hidden="true" />
              Matches
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              <i className="bi bi-person" aria-hidden="true" />
              Perfil
            </NavLink>
          </nav>

          {logoutBtn}
        </header>

        <main className="app-main">
          <Outlet />
          <AppFooter
            className={
              location.pathname === "/profile" ? undefined : "d-none d-md-flex"
            }
          />
        </main>

        {/* Solo mobile */}
        <nav className="tab-bar" aria-label="Navegación móvil">
          <NavLink to="/" end className={linkClass}>
            <i className="bi bi-newspaper" aria-hidden="true" />
            Muro
          </NavLink>
          <NavLink to="/venues" className={linkClass}>
            <i className="bi bi-geo-alt" aria-hidden="true" />
            Espacios
          </NavLink>
          <NavLink to="/discover" className={discoverClass}>
            <i className="bi bi-fire" aria-hidden="true" />
            <span>Discover</span>
          </NavLink>
          <NavLink to="/matches" className={linkClass}>
            <i className="bi bi-chat-heart" aria-hidden="true" />
            Matches
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <i className="bi bi-person" aria-hidden="true" />
            Perfil
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
