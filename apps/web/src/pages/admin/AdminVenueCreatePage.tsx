import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  type AuthUser,
  type VenueType,
} from "@nocta/shared";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { NoctaLoading } from "../../components/NoctaLoading";

export function AdminVenueCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("boliche");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Montevideo");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [photo, setPhoto] = useState(
    "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=800"
  );
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api<{ users: AuthUser[] }>("/api/admin/users")
      .then((res) => {
        setUsers(res.users);
        if (res.users[0]) setOwnerId(res.users[0].id);
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "No se pudo cargar")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargar una vez al montar
  }, []);

  async function createVenue(e: FormEvent) {
    e.preventDefault();
    if (!ownerId) {
      toast.warning("Seleccioná un organizador");
      return;
    }
    setBusy(true);
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
          ownerId,
        }),
      });
      toast.success(`${name} creado`);
      navigate("/admin/venues");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <Link className="admin-venue-review-back" to="/admin/venues">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span>Espacios</span>
          </Link>
          <p className="admin-page-eyebrow">Administración</p>
          <h1 className="app-title h3 mb-1">Alta de espacio</h1>
          <p className="text-secondary small mb-0">
            Creá un Espacio y asignale un organizador.
          </p>
        </div>
      </header>

      {loading ? (
        <NoctaLoading variant="block" />
      ) : (
        <form className="admin-form" onSubmit={createVenue}>
          <label className="admin-field">
            <span>Nombre</span>
            <input
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Tipo</span>
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
          </label>
          <label className="admin-field">
            <span>Organizador del espacio</span>
            <select
              className="form-select"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              required
            >
              <option value="" disabled>
                Seleccionar organizador
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.profile?.name ? `${u.profile.name} · ${u.email}` : u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Dirección</span>
            <input
              className="form-control"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Ciudad</span>
            <input
              className="form-control"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span>Descripción</span>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>Foto (URL)</span>
            <input
              className="form-control"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
            />
          </label>
          <div className="admin-form-actions">
            <Link className="btn btn-outline-light" to="/admin/venues">
              <i className="bi bi-x-lg" aria-hidden="true" />
              <span>Cancelar</span>
            </Link>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>{busy ? "Creando…" : "Crear espacio"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
