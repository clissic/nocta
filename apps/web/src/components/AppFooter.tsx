import { Link } from "react-router-dom";
import { NoctaWordmark } from "./NoctaWordmark";

type AppFooterProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AppFooter({ className = "", onNavigate }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={["app-footer", className].filter(Boolean).join(" ")}>
      <NoctaWordmark className="app-footer-wordmark" />
      <p className="app-footer-copy mb-0">
        © {year} Nocta
        <span aria-hidden="true"> · </span>
        <Link to="/terms" onClick={onNavigate}>
          Términos y Condiciones
        </Link>
      </p>
    </footer>
  );
}
