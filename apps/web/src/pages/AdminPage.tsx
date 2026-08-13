import { FormEvent, useEffect, useState } from "react";
import {
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type AuthUser,
  type Promotion,
  type Venue,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError } from "../lib/api";

interface Stats {
  users: number;
  venues: number;
  activePresences: number;
  matches: number;
}

export function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [promosByVenue, setPromosByVenue] = useState<Record<string, Promotion[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Buenos Aires");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(
    "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=800"
  );

  async function loadPromos(venueList: Venue[]) {
    const entries = await Promise.all(
      venueList.map(async (v) => {
        const data = await api<{ promotions: Promotion[] }>(
          `/api/venues/${v.id}/promotions`
        );
        return [v.id, data.promotions] as const;
      })
    );
    setPromosByVenue(Object.fromEntries(entries));
  }

  async function load() {
    const [statsRes, venuesRes, usersRes] = await Promise.all([
      api<{ stats: Stats }>("/api/admin/stats"),
      api<{ venues: Venue[] }>("/api/venues/admin/all"),
      api<{ users: AuthUser[] }>("/api/admin/users"),
    ]);
    setStats(statsRes.stats);
    setVenues(venuesRes.venues);
    setUsers(usersRes.users);
    await loadPromos(venuesRes.venues);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar admin")
    );
  }, []);

  async function createVenue(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/venues", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          address,
          city,
          description: description || undefined,
          photos: photo ? [photo] : [],
        }),
      });
      setName("");
      setAddress("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVenue(venue: Venue) {
    await api(`/api/venues/${venue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !venue.active }),
    });
    await load();
  }

  async function addPromo(venueId: string) {
    const title = window.prompt("Título de la promo");
    if (!title) return;
    const description = window.prompt("Descripción") ?? "";
    await api(`/api/venues/${venueId}/promotions`, {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
    await load();
  }

  async function togglePromo(promo: Promotion) {
    await api(`/api/admin/promotions/${promo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !promo.active }),
    });
    await load();
  }

  async function deactivatePromo(promo: Promotion) {
    await api(`/api/admin/promotions/${promo.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="pb-4 fade-in">
      <h1 className="app-title h3 mb-1">Panel admin</h1>
      <p className="text-secondary small mb-3">Locales, promos y usuarios.</p>

      {stats && (
        <div className="d-flex flex-wrap gap-3 mb-3 small">
          {[
            ["Usuarios", stats.users],
            ["Locales", stats.venues],
            ["Presencias", stats.activePresences],
            ["Matches", stats.matches],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="fs-4 fw-semibold lh-1">{value}</div>
              <div className="text-secondary">{label}</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-danger small">{error}</p>}

      <h2 className="h6 text-secondary text-uppercase mb-2">Nuevo local</h2>
      <form className="d-grid gap-2 mb-4" style={{ maxWidth: 560 }} onSubmit={createVenue}>
        <input
          className="form-control"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select
          className="form-select"
          value={type}
          onChange={(e) => setType(e.target.value as VenueType)}
        >
          {VENUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {VENUE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          className="form-control"
          placeholder="Dirección"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <input
          className="form-control"
          placeholder="Ciudad"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        <textarea
          className="form-control"
          rows={2}
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="form-control"
          placeholder="Foto URL"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>
          {busy ? "Creando…" : "Crear local"}
        </button>
      </form>

      <h2 className="h6 text-secondary text-uppercase mb-2">Locales y promos</h2>
      <div className="mb-4">
        {venues.map((v) => (
          <div key={v.id} className="py-3 border-bottom border-secondary">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
              <div>
                <div className="fw-semibold">{v.name}</div>
                <div className="text-secondary small">
                  {VENUE_TYPE_LABELS[v.type]} · {v.active ? "Activo" : "Inactivo"}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-light"
                  type="button"
                  onClick={() => toggleVenue(v)}
                  aria-label={v.active ? "Desactivar" : "Activar"}
                >
                  <i
                    className={`bi ${v.active ? "bi-toggle-on" : "bi-toggle-off"}`}
                    aria-hidden="true"
                  ></i>
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  type="button"
                  onClick={() => addPromo(v.id)}
                  aria-label="Agregar promo"
                >
                  <i className="bi bi-tag" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            {(promosByVenue[v.id] ?? []).map((p) => (
              <div
                key={p.id}
                className="d-flex justify-content-between align-items-start gap-2 mt-2 ps-1"
              >
                <div className="small">
                  <strong>{p.title}</strong>
                  <span className="text-secondary"> · {p.active ? "activa" : "inactiva"}</span>
                  <div className="text-secondary">{p.description}</div>
                </div>
                <div className="d-flex gap-1">
                  <button
                    className="btn btn-sm btn-link link-light p-0"
                    type="button"
                    onClick={() => togglePromo(p)}
                    aria-label="Alternar promo"
                  >
                    <i className="bi bi-arrow-repeat" aria-hidden="true"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-link link-danger p-0"
                    type="button"
                    onClick={() => deactivatePromo(p)}
                    aria-label="Desactivar promo"
                  >
                    <i className="bi bi-trash" aria-hidden="true"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h2 className="h6 text-secondary text-uppercase mb-2">Usuarios</h2>
      <div className="table-responsive">
        <table className="table table-sm table-dark table-borderless align-middle mb-0">
          <thead>
            <tr className="text-secondary">
              <th>Email</th>
              <th>Nombre</th>
              <th>Perfil</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.profile?.name ?? "—"}</td>
                <td>{u.profileComplete ? "OK" : "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
