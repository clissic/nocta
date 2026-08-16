type AuthAtmosphereProps = {
  variant: "login" | "register" | "verify";
};

const CONTENT = {
  login: {
    eyebrow: "Esta noche",
    title: "Tu próxima conexión está más cerca.",
    venue: "Mona Club",
    status: "32 personas ahora",
    leftInitial: "L",
    rightInitial: "M",
    link: "Mismo Espacio",
  },
  register: {
    eyebrow: "Tu perfil, tus reglas",
    title: "Mostrate solo cuando salís.",
    venue: "Perfil privado",
    status: "Oculto hasta publicar",
    leftInitial: "V",
    rightInitial: "S",
    link: "Conexiones reales",
  },
  verify: {
    eyebrow: "Un paso más",
    title: "Confirmá que sos vos.",
    venue: "Código enviado",
    status: "Seguro · 15 minutos",
    leftInitial: "N",
    rightInitial: "✓",
    link: "Cuenta protegida",
  },
} as const;

export function AuthAtmosphere({ variant }: AuthAtmosphereProps) {
  const content = CONTENT[variant];

  return (
    <>
      {/* Capa de luz a pantalla completa: el panel se apoya encima con z-index mayor */}
      <div className="auth-ambient" aria-hidden="true">
        <span className="auth-glow auth-glow-one" />
        <span className="auth-glow auth-glow-two" />
        <span className="auth-light-trail auth-light-trail-one" />
        <span className="auth-light-trail auth-light-trail-two" />
      </div>

      <section className={`auth-atmosphere is-${variant}`} aria-hidden="true">
        <div className="auth-scene-copy">
          <p>{content.eyebrow}</p>
          <strong>{content.title}</strong>
        </div>

        <div className="auth-scene-network">
          <span className="auth-scene-ring is-one" />
          <span className="auth-scene-ring is-two" />
          <span className="auth-scene-link" />
          <span className="auth-scene-avatar is-left">{content.leftInitial}</span>
          <span className="auth-scene-core">
            {variant === "login" ? (
              <img
                className="auth-scene-core-logo"
                src="/images/nocta-logo-negro-nobg.png"
                alt=""
              />
            ) : (
              "N"
            )}
          </span>
          <span className="auth-scene-avatar is-right">
            {content.rightInitial}
          </span>
          <span className="auth-scene-connection">{content.link}</span>
        </div>

        <div className="auth-venue-signal">
          <span className="auth-venue-pulse" />
          <div>
            <strong>{content.venue}</strong>
            <small>{content.status}</small>
          </div>
        </div>
      </section>
    </>
  );
}
