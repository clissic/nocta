import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  FollowListUser,
  FollowRequestProfile,
  Venue,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";
import { FollowRequestProfileModal } from "./FollowRequestProfileModal";
import { useToast } from "./ToastProvider";

export type ProfileConnectionsMode = "followers" | "following" | "venues";

type Props = {
  mode: ProfileConnectionsMode;
  onClose: () => void;
  onRemoved: (mode: ProfileConnectionsMode) => void;
};

type PublicUserResponse = {
  id: string;
  name: string;
  age: number;
  photo?: string;
  heightCm?: number;
  livesIn?: FollowRequestProfile["livesIn"];
  socials?: FollowRequestProfile["socials"];
};

export function ProfileConnectionsModal({
  mode,
  onClose,
  onRemoved,
}: Props) {
  const toast = useToast();
  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reducedProfile, setReducedProfile] =
    useState<FollowRequestProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    setLoading(true);
    setUsers([]);
    setVenues([]);
    setQuery("");
    setSelectedUserId(null);
    setReducedProfile(null);

    const load =
      mode === "followers"
        ? api<{ users: FollowListUser[] }>("/api/me/followers").then(
            (response) => setUsers(response.users ?? [])
          )
        : api<{ users: FollowListUser[]; venues: Venue[] }>(
            "/api/me/following"
          ).then((response) => {
            if (mode === "venues") {
              setVenues(response.venues ?? []);
            } else {
              setUsers(response.users ?? []);
            }
          });

    void load
      .catch(() => toast.error("No se pudo cargar la lista"))
      .finally(() => setLoading(false));

    return () => {
      document.body.style.overflow = "";
    };
  }, [mode, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedUserId) {
        setSelectedUserId(null);
        setReducedProfile(null);
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, selectedUserId]);

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const filtered = normalized
      ? users.filter((user) =>
          user.name.toLocaleLowerCase("es").includes(normalized)
        )
      : users;
    return filtered.slice(0, 10);
  }, [query, users]);

  const visibleVenues = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const filtered = normalized
      ? venues.filter((venue) =>
          venue.name.toLocaleLowerCase("es").includes(normalized)
        )
      : venues;
    return filtered.slice(0, 10);
  }, [query, venues]);

  async function openReducedProfile(user: FollowListUser) {
    setSelectedUserId(user.id);
    setReducedProfile(null);
    setProfileLoading(true);
    try {
      const response = await api<{ user: PublicUserResponse }>(
        `/api/users/${user.id}`
      );
      const u = response.user;
      setReducedProfile({
        id: u.id,
        name: u.name,
        age: u.age,
        photo: u.photo,
        heightCm: u.heightCm,
        livesIn: u.livesIn,
        socials: u.socials,
      });
    } catch (error) {
      setSelectedUserId(null);
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudo cargar el perfil"
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function removeUser(user: FollowListUser) {
    setBusyId(user.id);
    try {
      const endpoint =
        mode === "followers"
          ? `/api/me/followers/${user.id}`
          : `/api/users/${user.id}/follow`;
      await api(endpoint, { method: "DELETE" });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onRemoved(mode);
      toast.success(
        mode === "followers" ? "Seguidor eliminado" : "Dejaste de seguir"
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo actualizar"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeVenue(venue: Venue) {
    setBusyId(venue.id);
    try {
      await api(`/api/venues/${venue.id}/follow`, { method: "DELETE" });
      setVenues((current) => current.filter((item) => item.id !== venue.id));
      onRemoved("venues");
      toast.success("Dejaste de seguir el espacio");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo actualizar"
      );
    } finally {
      setBusyId(null);
    }
  }

  const title =
    mode === "followers"
      ? "Seguidores"
      : mode === "following"
        ? "Seguidos"
        : "Espacios";

  const emptyCopy = query.trim()
    ? "No hay resultados para esa búsqueda."
    : mode === "followers"
      ? "Todavía no tenés seguidores."
      : mode === "following"
        ? "Todavía no seguís a nadie."
        : "Todavía no seguís espacios.";

  const isVenues = mode === "venues";
  const listEmpty = isVenues
    ? visibleVenues.length === 0
    : visibleUsers.length === 0;

  return (
    <div
      className="profile-connections-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-connections-title"
    >
      <button
        type="button"
        className="profile-connections-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="profile-connections-dialog">
        <header className="profile-connections-head">
          <h2 id="profile-connections-title">{title}</h2>
          <button
            type="button"
            className="profile-connections-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="profile-connections-body">
          <label
            className="visually-hidden"
            htmlFor="profile-connections-search"
          >
            Buscar por nombre
          </label>
          <input
            id="profile-connections-search"
            type="search"
            className="form-control profile-connections-search"
            placeholder={`Buscar en ${title.toLocaleLowerCase("es")}…`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {loading ? (
            <p className="text-secondary small mb-0">Cargando…</p>
          ) : listEmpty ? (
            <p className="text-secondary small mb-0">{emptyCopy}</p>
          ) : isVenues ? (
            <ul className="profile-connections-list">
              {visibleVenues.map((venue) => (
                <li key={venue.id} className="profile-connections-item">
                  <div className="profile-connections-user">
                    {venue.photos?.[0] ? (
                      <img src={venue.photos[0]} alt="" />
                    ) : (
                      <span aria-hidden="true">
                        {venue.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/venues/${venue.id}`}
                        className="profile-connections-link"
                        onClick={onClose}
                      >
                        {venue.name}
                      </Link>
                      {(venue.city || venue.address) && (
                        <div className="text-secondary small text-truncate">
                          {venue.city || venue.address}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="profile-connections-remove"
                    aria-label={`Dejar de seguir ${venue.name}`}
                    title="Dejar de seguir"
                    disabled={busyId === venue.id}
                    onClick={() => void removeVenue(venue)}
                  >
                    <i className="bi bi-dash-lg" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="profile-connections-list">
              {visibleUsers.map((user) => (
                <li key={user.id} className="profile-connections-item">
                  <div className="profile-connections-user">
                    {user.photo ? (
                      <img src={user.photo} alt="" />
                    ) : (
                      <span aria-hidden="true">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="profile-follow-request-name"
                        onClick={() => void openReducedProfile(user)}
                      >
                        {user.name}
                      </button>
                      <span className="text-secondary"> · {user.age}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="profile-connections-remove"
                    aria-label={
                      mode === "followers"
                        ? `Eliminar a ${user.name} de tus seguidores`
                        : `Dejar de seguir a ${user.name}`
                    }
                    title={
                      mode === "followers"
                        ? "Eliminar seguidor"
                        : "Dejar de seguir"
                    }
                    disabled={busyId === user.id}
                    onClick={() => void removeUser(user)}
                  >
                    <i
                      className={`bi ${
                        mode === "followers"
                          ? "bi-person-x"
                          : "bi-person-dash"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {selectedUserId && (
        <FollowRequestProfileModal
          profile={reducedProfile}
          loading={profileLoading}
          onClose={() => {
            setSelectedUserId(null);
            setReducedProfile(null);
          }}
        />
      )}
    </div>
  );
}
