export function AdminAuditPage() {
  const futureCategories = [
    {
      title: "Accesos",
      description: "Ingresos administrativos, sesiones y cambios de permisos.",
      icon: "bi-key",
    },
    {
      title: "Cambios administrativos",
      description: "Ediciones realizadas sobre usuarios, Espacios y solicitudes.",
      icon: "bi-pencil-square",
    },
    {
      title: "Moderación",
      description: "Resoluciones y acciones tomadas sobre denuncias.",
      icon: "bi-flag",
    },
    {
      title: "Operaciones sensibles",
      description: "Canjes, reembolsos y cambios que requieren trazabilidad.",
      icon: "bi-exclamation-diamond",
    },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-page-eyebrow">Control</p>
          <h1 className="app-title h3 mb-1">Auditoría</h1>
          <p className="text-secondary small mb-0">
            Espacio preparado para la futura trazabilidad administrativa.
          </p>
        </div>
      </header>

      <div className="admin-panel mb-3">
        <strong className="d-block mb-1">Aún no se registran eventos de auditoría</strong>
        <p className="text-secondary small mb-0">
          Esta pantalla no muestra datos simulados. Los eventos aparecerán
          cuando el backend incorpore un registro de auditoría inmutable.
        </p>
      </div>

      <div className="row row-cols-1 row-cols-md-2 g-3">
        {futureCategories.map((category) => (
          <div className="col" key={category.title}>
            <article className="admin-panel h-100 d-flex gap-3">
              <i className={`bi ${category.icon} text-primary fs-4`} aria-hidden="true" />
              <div>
                <h2 className="h6 mb-1">{category.title}</h2>
                <p className="text-secondary small mb-0">{category.description}</p>
              </div>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}
