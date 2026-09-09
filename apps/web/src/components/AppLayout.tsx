import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ADMIN_NAV } from "./admin/AdminLayout";
import { AppFooter } from "./AppFooter";
import { NoctaWordmark } from "./NoctaWordmark";
import { NotificationsBell } from "./NotificationsBell";
import { OverflowFade } from "./OverflowFade";

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
  const [logoutOpen, setLogoutOpen] = useState(false);

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

  useEffect(() => {
    if (!logoutOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogoutOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [logoutOpen]);

  function isAdminItemActive(to: string, end?: boolean) {
    if (to === "/admin/requests" && location.pathname.startsWith("/admin/venue-requests/")) {
      return true;
    }
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  function confirmLogout() {
    logout();
    navigate("/login");
  }

  const logoutModal =
    logoutOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="logout-confirm-layer" role="presentation">
            <button
              type="button"
              className="logout-confirm-backdrop"
              aria-label="Cancelar cierre de sesión"
              onClick={() => setLogoutOpen(false)}
            />
            <section
              className="logout-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title"
              aria-describedby="logout-confirm-description"
            >
              <div className="logout-confirm-icon" aria-hidden="true">
                <i className="bi bi-box-arrow-right" />
              </div>
              <h2 id="logout-confirm-title">¿Cerrar sesión?</h2>
              <p id="logout-confirm-description">
                Tendrás que volver a ingresar tus datos para acceder a Nocta.
              </p>
              <div className="logout-confirm-actions">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  onClick={() => setLogoutOpen(false)}
                  autoFocus
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  const logoutBtn = (
    <button
      className="btn btn-sm btn-link link-light text-decoration-none p-0 app-top-logout"
      type="button"
      onClick={() => setLogoutOpen(true)}
      aria-label="Salir"
    >
      <i className="bi bi-box-arrow-right fs-5" aria-hidden="true"></i>
    </button>
  );

  if (isAdmin) {
    return (
      <div className="app-shell">
        {logoutModal}
        <div className="app-frame">
          <header className="app-top">
            <NavLink className="brand" to="/admin/overview">
              <NoctaWordmark />
            </NavLink>

            <nav className="top-nav" aria-label="Navegación principal">
              <NavLink className="nav-discover active" to="/admin/overview">
                <i className="bi bi-shield-check" aria-hidden="true" />
                Admin
              </NavLink>
            </nav>

            <div className="app-top-actions">
              <NotificationsBell />
              {logoutBtn}
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
            </div>
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
            <OverflowFade
              className="admin-drawer-nav"
              role="navigation"
              aria-label="Navegación administrativa"
            >
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
            </OverflowFade>
            <button
              className="admin-drawer-logout"
              type="button"
              tabIndex={adminMenuOpen ? 0 : -1}
              onClick={() => {
                setAdminMenuOpen(false);
                setLogoutOpen(true);
              }}
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </aside>
          <main className="app-main">
            <Outlet />
            {location.pathname === "/profile" && <AppFooter />}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {logoutModal}
      <div className="app-frame">
        <header className="app-top">
          <NavLink className="brand" to="/venues">
            <NoctaWordmark />
          </NavLink>

          {/* Tablet + desktop */}
          <nav className="top-nav" aria-label="Navegación principal">
            <NavLink to="/venues" className={linkClass}>
              <i className="bi bi-geo-alt" aria-hidden="true" />
              Espacios
            </NavLink>
            <NavLink to="/likes" className={linkClass}>
              <i className="bi bi-heart" aria-hidden="true" />
              Likes
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

          <div className="app-top-actions">
            <NotificationsBell />
            {logoutBtn}
          </div>
        </header>

        <main className="app-main">
          <Outlet />
          {location.pathname === "/profile" && <AppFooter />}
        </main>

        {/* Solo mobile */}
        <nav className="tab-bar" aria-label="Navegación móvil">
          <NavLink to="/venues" className={linkClass}>
            <i className="bi bi-geo-alt" aria-hidden="true" />
            Espacios
          </NavLink>
          <NavLink to="/likes" className={linkClass}>
            <i className="bi bi-heart" aria-hidden="true" />
            Likes
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
