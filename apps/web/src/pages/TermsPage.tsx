import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NoctaWordmark } from "../components/NoctaWordmark";
import {
  TERMS_SECTIONS,
  TERMS_UPDATED_AT,
  TERMS_UPDATED_LABEL,
  TERMS_VERSION,
  type TermsBlock,
} from "../legal/termsContent";

function TermsBlockView({ block }: { block: TermsBlock }) {
  if (block.type === "ul") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "ol") {
    return (
      <ol>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }
  if ("html" in block && block.html) {
    return <p dangerouslySetInnerHTML={{ __html: block.text }} />;
  }
  return <p>{block.text}</p>;
}

function tocLabel(title: string) {
  return title.replace(/^\d+\.\s*/, "");
}

function canGoBackInApp() {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number") return idx > 0;
  return window.history.length > 1;
}

export function TermsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tocOpen, setTocOpen] = useState(false);

  function goBack() {
    if (canGoBackInApp()) {
      navigate(-1);
      return;
    }
    navigate(user ? "/profile" : "/login", { replace: true });
  }

  return (
    <div className="legal-page">
      <header className="legal-page-top">
        <Link
          className="legal-page-brand"
          to={user ? "/profile" : "/login"}
          aria-label="Nocta"
        >
          <NoctaWordmark />
        </Link>
        <div className="legal-page-top-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm legal-page-back"
            onClick={goBack}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            Volver
          </button>
        </div>
      </header>

      <main className="legal-page-main">
        <article className="legal-doc">
          <header className="legal-doc-head">
            <p className="legal-doc-eyebrow">Documento legal</p>
            <h1>Términos y Condiciones de uso de Nocta</h1>
            <div className="legal-doc-meta">
              <span>
                Última actualización:{" "}
                <time dateTime={TERMS_UPDATED_AT}>{TERMS_UPDATED_LABEL}</time>
              </span>
              <span className="legal-doc-version">Versión {TERMS_VERSION}</span>
            </div>
          </header>

          <div className="legal-toc accordion">
            <button
              type="button"
              className={`legal-toc-toggle${tocOpen ? " is-open" : ""}`}
              aria-expanded={tocOpen}
              aria-controls="legal-toc-panel"
              id="legal-toc-toggle"
              onClick={() => setTocOpen((open) => !open)}
            >
              <span>Índice</span>
              <i
                className={`bi ${tocOpen ? "bi-chevron-up" : "bi-chevron-down"}`}
                aria-hidden="true"
              />
            </button>
            <nav
              id="legal-toc-panel"
              className={`legal-toc-panel${tocOpen ? " is-open" : ""}`}
              aria-labelledby="legal-toc-toggle"
              hidden={!tocOpen}
            >
              <ul className="legal-toc-list">
                {TERMS_SECTIONS.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={() => setTocOpen(false)}
                    >
                      <span className="legal-toc-num">{index + 1}.</span>
                      <span>{tocLabel(section.title)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {TERMS_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="legal-doc-section"
            >
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <TermsBlockView
                  key={`${section.id}-${index}`}
                  block={block}
                />
              ))}
            </section>
          ))}
        </article>
      </main>

      <footer className="legal-page-foot">
        <NoctaWordmark className="legal-page-foot-wordmark" />
        <p className="mb-0">© {new Date().getFullYear()} Nocta</p>
      </footer>
    </div>
  );
}
