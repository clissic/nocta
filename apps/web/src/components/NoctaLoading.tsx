type NoctaLoadingProps = {
  className?: string;
  /** screen: pantalla completa · block: zona de contenido · inline: paneles y listas */
  variant?: "screen" | "block" | "inline";
};

export function NoctaLoading({
  className = "",
  variant = "screen",
}: NoctaLoadingProps) {
  const hostClass = [
    "nocta-loading",
    `nocta-loading-${variant}`,
    variant === "screen" ? "app-screen fade-in" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={hostClass} role="status" aria-label="Cargando">
      <span className="nocta-loading-word" aria-hidden="true">
        <span className="nocta-loading-c">
          <span className="nocta-loading-rings">
            <span className="nocta-loading-ring" />
            <span className="nocta-loading-ring" />
            <span className="nocta-loading-ring" />
          </span>
          <img
            className="nocta-loading-moon"
            src="/images/nocta-logo-limaneon-nobg.png"
            alt=""
          />
        </span>
        <span className="nocta-loading-rest">argando</span>
        <span className="nocta-loading-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}
