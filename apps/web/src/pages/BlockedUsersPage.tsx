import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BlockedUser, PaginationMeta } from "@nocta/shared";
import { ApiError, api } from "../lib/api";
import { NoctaLoading } from "../components/NoctaLoading";
import { useToast } from "../components/ToastProvider";

const PAGE_SIZE = 20;

export function BlockedUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api<{ users: BlockedUser[]; pagination: PaginationMeta }>(
      `/api/me/blocked-users?page=${page}&limit=${PAGE_SIZE}`
    )
      .then((response) => {
        if (!alive) return;
        setUsers((current) =>
          page === 1 ? response.users : [...current, ...response.users]
        );
        setPagination(response.pagination);
      })
      .catch((err) => {
        if (!alive) return;
        toast.error(
          err instanceof ApiError
            ? err.message
            : "No se pudieron cargar los usuarios bloqueados"
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, toast]);

  async function unblock(user: BlockedUser) {
    if (busyId) return;
    setBusyId(user.id);
    try {
      await api(`/api/me/blocked-users/${user.id}`, { method: "DELETE" });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setPagination((current) =>
        current
          ? { ...current, total: Math.max(0, current.total - 1) }
          : current
      );
      toast.success(`${user.name} fue desbloqueado`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "No se pudo desbloquear"
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="blocked-users-page">
      <header className="blocked-users-head">
        <Link
          className="btn btn-sm btn-outline-light"
          to="/profile"
          aria-label="Volver al perfil"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </Link>
        <div>
          <p className="admin-page-eyebrow mb-1">Privacidad y seguridad</p>
          <h1 className="app-title h3 mb-0">Usuarios bloqueados</h1>
        </div>
      </header>

      {loading && page === 1 ? (
        <NoctaLoading />
      ) : users.length === 0 ? (
        <div className="blocked-users-empty">
          <i className="bi bi-person-check" aria-hidden="true" />
          <strong>No bloqueaste a nadie</strong>
          <p className="text-secondary small mb-0">
            Los perfiles que bloquees aparecerán en esta lista.
          </p>
        </div>
      ) : (
        <div className="blocked-users-list">
          {users.map((user) => (
            <article className="blocked-user-row" key={user.id}>
              {user.photo ? (
                <img src={user.photo} alt="" />
              ) : (
                <span className="blocked-user-avatar" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <strong className="d-block text-truncate">{user.name}</strong>
                <small className="text-secondary">
                  Bloqueado el{" "}
                  {new Date(user.blockedAt).toLocaleDateString("es-UY")}
                </small>
              </div>
              <button
                className="btn btn-sm btn-outline-light"
                type="button"
                disabled={busyId === user.id}
                onClick={() => void unblock(user)}
              >
                {busyId === user.id ? "Desbloqueando…" : "Desbloquear"}
              </button>
            </article>
          ))}
          {pagination?.hasMore && (
            <button
              className="btn btn-outline-light blocked-users-more"
              type="button"
              disabled={loading}
              onClick={() => setPage((current) => current + 1)}
            >
              {loading ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
