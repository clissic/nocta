import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function linkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "active" : undefined;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const logoutBtn = (
    <button
      className="btn btn-sm btn-link link-light text-decoration-none p-0"
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
          <header className="app-top">
            <NavLink className="brand" to="/admin">
              Noc<span>ta</span>
            </NavLink>
            <span className="text-secondary small d-none d-md-inline">Admin</span>
            {logoutBtn}
          </header>
          <main className="app-main admin-main px-3 px-md-4">
            <Outlet />
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
            Noc<span>ta</span>
          </NavLink>

          {/* Tablet + desktop */}
          <nav className="top-nav" aria-label="Navegación principal">
            <NavLink to="/" end className={linkClass}>
              <i className="bi bi-geo-alt" aria-hidden="true"></i>
              Locales
            </NavLink>
            <NavLink to="/discover" className={linkClass}>
              <i className="bi bi-fire" aria-hidden="true"></i>
              Discover
            </NavLink>
            <NavLink to="/matches" className={linkClass}>
              <i className="bi bi-chat-heart" aria-hidden="true"></i>
              Matches
            </NavLink>
            <NavLink to="/profile" className={linkClass}>
              <i className="bi bi-person" aria-hidden="true"></i>
              Perfil
            </NavLink>
          </nav>

          {logoutBtn}
        </header>

        <main className="app-main">
          <Outlet />
        </main>

        {/* Solo mobile */}
        <nav className="tab-bar" aria-label="Navegación móvil">
          <NavLink to="/" end className={linkClass}>
            <i className="bi bi-geo-alt" aria-hidden="true"></i>
            Locales
          </NavLink>
          <NavLink to="/discover" className={linkClass}>
            <i className="bi bi-fire" aria-hidden="true"></i>
            Discover
          </NavLink>
          <NavLink to="/matches" className={linkClass}>
            <i className="bi bi-chat-heart" aria-hidden="true"></i>
            Matches
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <i className="bi bi-person" aria-hidden="true"></i>
            Perfil
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
