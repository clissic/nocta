import { NoctaWordmark } from "./NoctaWordmark";

type AppFooterProps = {
  className?: string;
};

export function AppFooter({ className = "" }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={["app-footer", className].filter(Boolean).join(" ")}>
      <NoctaWordmark className="app-footer-wordmark" />
      <p className="app-footer-copy mb-0">© {year} Nocta</p>
    </footer>
  );
}
