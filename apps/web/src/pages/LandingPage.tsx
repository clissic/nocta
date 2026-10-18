import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NoctaLoading } from "../components/NoctaLoading";
import { NoctaWordmark } from "../components/NoctaWordmark";
import { PendingDeletionScreen } from "../components/PendingDeletionScreen";

const SPACES = [
  { name: "VOU Club", zone: "Parque Rodó", src: "/images/venues/VOUClubImg.webp" },
  { name: "Negroni", zone: "Punta Carretas", src: "/images/venues/NegroniImg.webp" },
  { name: "Cain Dance", zone: "Cordón", src: "/images/venues/CainDanceImg.webp" },
  { name: "Baar Fun Fun", zone: "Ciudad Vieja", src: "/images/venues/BaarFunFunImg.webp" },
  { name: "La Colmena", zone: "Cordón", src: "/images/venues/LaColmenaImg.webp" },
  { name: "IL Tempo", zone: "Parque Rodó", src: "/images/venues/IlTempoImg.webp" },
  { name: "Baker's Bar", zone: "Parque Rodó", src: "/images/venues/BakersBarImg.webp" },
  { name: "Zoba Club", zone: "Parque Rodó", src: "/images/venues/ZobaClubImg.webp" },
  { name: "Alvarez Bar", zone: "Ciudad Vieja", src: "/images/venues/AlvarezBarImg.webp" },
  { name: "Plaza Mateo", zone: "Parque Rodó", src: "/images/venues/PlazaMateoImg.webp" },
] as const;

const PLANS = [
  {
    name: "2 A.M.",
    line: "La noche recién arranca",
    points: ["Likes ilimitados", "Retroceder el último swipe", "Modo Teleport", "Sin anuncios"],
  },
  {
    name: "4 A.M.",
    line: "Cuando la noche pide más",
    points: ["Ver quién te dio like", "Boost en Discover", "Heartshot", "Todo lo de 2 A.M."],
  },
  {
    name: "6 A.M.",
    line: "Hasta que salga el sol",
    points: ["Modo espía", "Clone en hasta 3 Espacios", "Todo lo de 4 A.M."],
  },
] as const;

function LandingMoon() {
  return (
    <div className="landing-moon" aria-hidden="true">
      <span className="landing-moon-ring" />
      <span className="landing-moon-ring" />
      <span className="landing-moon-ring" />
      <span className="landing-orbit">
        <span className="landing-orbit-dot" />
      </span>
      <span className="landing-orbit landing-orbit-slow">
        <span className="landing-orbit-dot landing-orbit-dot-soft" />
      </span>
      <img src="/images/nocta-logo-limaneon-nobg.png" alt="" />
    </div>
  );
}

function SpaceRail({ hidden }: { hidden?: boolean }) {
  return (
    <div className="landing-marquee-set" aria-hidden={hidden || undefined}>
      {SPACES.map((space) => (
        <figure key={`${space.src}-${hidden ? "b" : "a"}`} className="landing-space">
          <img src={space.src} alt="" />
          <figcaption>
            <strong>{space.name}</strong>
            <span>{space.zone}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="landing landing-loading">
        <NoctaLoading />
      </div>
    );
  }
  if (user?.deletionRequestedAt) return <PendingDeletionScreen />;
  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (user && !user.profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  if (user) return <Navigate to="/venues" replace />;

  return (
    <div className="landing">
      <header className="landing-bar">
        <Link to="/" className="landing-brand">
          <NoctaWordmark />
        </Link>
        <Link className="btn btn-primary landing-enter" to="/login">
          Ingresar
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker">Salí esta noche</p>
            <h1>Publicate donde vas.</h1>
            <p className="landing-lead">
              Nocta es para la salida, no para cualquier día. Elegís un Espacio,
              te publicás y ves quién más está ahí.
            </p>
            <div className="landing-hero-actions">
              <Link className="btn btn-primary btn-lg" to="/register">
                Crear cuenta
              </Link>
              <Link className="btn btn-outline-light btn-lg" to="/login">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
          <LandingMoon />
        </section>

        <section className="landing-spaces" aria-label="Espacios">
          <div className="landing-section-head">
            <p className="landing-kicker">Montevideo</p>
            <h2>La noche pasa en un Espacio</h2>
            <p className="landing-lead">
              Bares, boliches y la salida de hoy. El deck no mezcla a toda la
              ciudad: solo a quien está publicado en el mismo lugar.
            </p>
          </div>
          <div className="landing-marquee">
            <div className="landing-marquee-track">
              <SpaceRail />
              <SpaceRail hidden />
            </div>
          </div>
        </section>

        <section className="landing-scene" aria-label="Publicarte">
          <div className="landing-scene-copy">
            <p className="landing-kicker">Presencia</p>
            <h2>Tu perfil se enciende al publicarte</h2>
            <p>
              Mientras estás publicado, te ven las personas de ese Espacio.
              Cuando te vas, desaparecés. Una presencia activa; con Clone, el
              plan 6 A.M. permite hasta tres a la vez.
            </p>
          </div>
          <div className="landing-stage" aria-hidden="true">
            <article className="landing-presence">
              <img src="/images/venues/NegroniImg.webp" alt="" />
              <div className="landing-presence-shade" />
              <p className="landing-live">
                <span className="landing-live-dot" />
                Publicado
              </p>
              <div className="landing-presence-meta">
                <span className="landing-avatar" />
                <span>
                  <strong>En Negroni</strong>
                  <small>Punta Carretas</small>
                </span>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-scene landing-scene-flip" aria-label="Discover">
          <div className="landing-scene-copy">
            <p className="landing-kicker">Discover</p>
            <h2>El deck es de ese lugar</h2>
            <p>
              Pasás, das like o mandás un Heartshot. Cada foto muestra un dato
              del perfil: qué busca, la altura, el trabajo, dónde vive. Si los
              dos se eligen, hay match.
            </p>
          </div>
          <div className="landing-stage" aria-hidden="true">
            <div className="landing-deck">
              <article className="landing-swipe landing-swipe-back">
                <img src="/images/venues/CainDanceImg.webp" alt="" />
              </article>
              <article className="landing-swipe landing-swipe-front">
                <img src="/images/venues/VOUClubImg.webp" alt="" />
                <div className="landing-presence-shade" />
                <p className="landing-swipe-fact">Busca salir esta noche</p>
                <span className="landing-stamp">Like</span>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-scene" aria-label="Match y chat">
          <div className="landing-scene-copy">
            <p className="landing-kicker">Match</p>
            <h2>El chat es para encontrarse</h2>
            <p>
              Coordinan la barra, la mesa o la puerta. Nocta no es una bandeja
              para hablar toda la semana: sirve para cruzarse en la misma
              salida.
            </p>
          </div>
          <div className="landing-stage" aria-hidden="true">
            <div className="landing-match">
              <span className="landing-match-face" />
              <img
                className="landing-match-moon"
                src="/images/nocta-logo-limaneon-nobg.png"
                alt=""
              />
              <span className="landing-match-face landing-match-face-b" />
            </div>
            <div className="landing-chat">
              <p className="landing-bubble">¿Estás en la barra?</p>
              <p className="landing-bubble landing-bubble-me">Al fondo, del lado de la pista.</p>
            </div>
          </div>
        </section>

        <section className="landing-plans" aria-label="Planes">
          <div className="landing-section-head">
            <p className="landing-kicker">Planes</p>
            <h2>La noche tiene horarios</h2>
            <p className="landing-lead">
              Empezás gratis. Si la salida se alarga, hay tres planes.
            </p>
          </div>
          <div className="landing-plan-grid">
            {PLANS.map((plan) => (
              <article key={plan.name} className="landing-plan">
                <h3>{plan.name}</h3>
                <p>{plan.line}</p>
                <ul>
                  {plan.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-close">
          <LandingMoon />
          <h2>Salí. Publicate. Matcheá.</h2>
          <div className="landing-hero-actions">
            <Link className="btn btn-primary btn-lg" to="/register">
              Crear cuenta
            </Link>
            <Link className="btn btn-outline-light btn-lg" to="/login">
              Ingresar
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-foot">
        <p>Montevideo, por ahora.</p>
        <Link to="/terms">Términos</Link>
      </footer>
    </div>
  );
}
