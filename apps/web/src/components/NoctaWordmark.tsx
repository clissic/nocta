type NoctaWordmarkProps = {
  className?: string;
};

export function NoctaWordmark({ className = "" }: NoctaWordmarkProps) {
  return (
    <span
      className={`nocta-wordmark${className ? ` ${className}` : ""}`}
      aria-label="Nocta"
    >
      <span aria-hidden="true">no</span>
      <img
        className="nocta-wordmark-moon"
        src="/images/nocta-logo-limaneon-nobg.png"
        alt=""
        aria-hidden="true"
      />
      <span aria-hidden="true">ta</span>
    </span>
  );
}
