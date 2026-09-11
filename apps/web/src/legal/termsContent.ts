/** Contenido legal de Términos y Condiciones (v1.0). */
export const TERMS_VERSION = "1.0";
export const TERMS_UPDATED_AT = "2026-09-10";
export const TERMS_UPDATED_LABEL = "10 de septiembre de 2026";

export type TermsBlock =
  | { type: "p"; text: string }
  | { type: "p"; html: true; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type TermsSection = {
  id: string;
  title: string;
  blocks: TermsBlock[];
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "aceptacion",
    title: "1. Aceptación de los Términos",
    blocks: [
      {
        type: "p",
        text: "Los presentes Términos y Condiciones regulan el acceso y uso de Nocta, plataforma digital destinada a facilitar la interacción social entre personas y la exploración de Espacios, actividades, eventos y establecimientos vinculados a la vida nocturna y social.",
      },
      {
        type: "p",
        text: "Al registrarse, acceder o utilizar Nocta, el usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones, así como las políticas y documentos que se incorporen o vinculen expresamente a ellos.",
      },
      {
        type: "p",
        text: "Si el usuario no está de acuerdo con estos Términos y Condiciones, deberá abstenerse de utilizar Nocta.",
      },
    ],
  },
  {
    id: "titularidad",
    title: "2. Titularidad",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Nocta es desarrollada y operada por <strong>Joaquín Alejandro Pérez Coria</strong>, persona física, con domicilio en Montevideo, Uruguay.",
      },
      {
        type: "p",
        html: true,
        text: 'Correo electrónico de contacto: <a href="mailto:joaquin.perez.coria@gmail.com">joaquin.perez.coria@gmail.com</a>',
      },
      {
        type: "p",
        text: "El titular podrá modificar la estructura jurídica mediante la cual se explota Nocta, incluyendo la eventual constitución de una sociedad comercial o empresa, sin que ello afecte la vigencia de estos Términos y Condiciones.",
      },
    ],
  },
  {
    id: "definiciones",
    title: "3. Definiciones",
    blocks: [
      { type: "p", text: "A los efectos de estos Términos:" },
      {
        type: "ul",
        items: [
          "“Nocta” refiere a la plataforma, aplicación, sitio web y servicios asociados.",
          "“Usuario” refiere a toda persona que se registre o utilice Nocta.",
          "“Perfil” refiere al espacio personal del Usuario dentro de Nocta.",
          "“Espacio” refiere a un establecimiento, lugar, evento o ubicación registrada en Nocta, incluyendo, entre otros, boliches, bares, pubs, cervecerías, conciertos, festivales y fiestas privadas.",
          "“Administrador de Espacio” / “Organizador” refiere al Usuario al que Nocta haya autorizado para administrar un Espacio determinado.",
          "“Premium” refiere a las funcionalidades y servicios de pago ofrecidos por Nocta.",
          "“Seguidor Premium” refiere a un Usuario que siga a otro Usuario y que tenga activa una suscripción Premium.",
        ],
      },
    ],
  },
  {
    id: "requisitos",
    title: "4. Requisitos para utilizar Nocta",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Nocta está destinada exclusivamente a personas mayores de <strong>18 años</strong>.",
      },
      {
        type: "p",
        text: "Al registrarse, el Usuario declara que tiene al menos 18 años y que toda la información proporcionada es verdadera, actual y completa.",
      },
      {
        type: "p",
        text: "Nocta podrá solicitar información adicional o adoptar medidas cuando existan indicios razonables de que un Usuario no cumple con los requisitos de edad o identidad establecidos.",
      },
    ],
  },
  {
    id: "registro",
    title: "5. Registro",
    blocks: [
      {
        type: "p",
        text: "El registro podrá realizarse mediante correo electrónico y contraseña o mediante los sistemas de autenticación de terceros que Nocta habilite, incluyendo eventualmente Google, Apple o Microsoft.",
      },
      {
        type: "p",
        text: "Para crear una cuenta mediante registro directo, Nocta podrá solicitar:",
      },
      {
        type: "ul",
        items: [
          "Nombre.",
          "Correo electrónico.",
          "Contraseña.",
          "Confirmación de contraseña.",
          "Aceptación de estos Términos y Condiciones.",
        ],
      },
      {
        type: "p",
        text: "Los demás datos necesarios para completar el Perfil podrán ser solicitados durante el proceso de incorporación a Nocta.",
      },
    ],
  },
  {
    id: "seguridad-cuenta",
    title: "6. Seguridad de la cuenta",
    blocks: [
      {
        type: "p",
        text: "El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de toda actividad realizada desde su cuenta.",
      },
      {
        type: "p",
        text: "El Usuario no podrá transferir, vender, prestar o compartir su cuenta con terceros.",
      },
      {
        type: "p",
        text: "El Usuario deberá comunicar a Nocta cualquier acceso no autorizado del que tenga conocimiento.",
      },
    ],
  },
  {
    id: "perfiles",
    title: "7. Perfiles",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán crear un Perfil que podrá incluir:",
      },
      {
        type: "ul",
        items: ["Nombre.", "Edad.", "Fotografías.", "Biografía.", "Intereses.", "Altura."],
      },
      { type: "p", text: "La edad será visible públicamente." },
      {
        type: "p",
        text: "Determinada información, como país, ciudad, fecha de nacimiento y género, podrá mantenerse como información privada de acuerdo con la configuración y funcionamiento de Nocta.",
      },
      {
        type: "p",
        text: "El Usuario podrá modificar su nombre. Si cuenta con un Perfil verificado, modificar el nombre podrá implicar la pérdida de la verificación y requerir un nuevo proceso de verificación.",
      },
      {
        type: "p",
        text: "Nocta no utiliza nombres de usuario mediante el formato “@usuario”. La identificación dentro de la plataforma se realiza principalmente mediante el nombre mostrado en el Perfil.",
      },
    ],
  },
  {
    id: "fotografias",
    title: "8. Fotografías",
    blocks: [
      {
        type: "p",
        html: true,
        text: "El Usuario podrá publicar hasta <strong>10 fotografías</strong> en su Perfil.",
      },
      {
        type: "p",
        text: "Las fotografías deberán representar al propio Usuario y no podrán utilizarse fotografías de terceros para aparentar una identidad distinta.",
      },
      {
        type: "p",
        text: "El Usuario podrá modificar libremente el orden de sus fotografías. La primera fotografía será utilizada como fotografía principal del Perfil.",
      },
      {
        type: "p",
        text: "Las fotografías eliminadas por el Usuario serán eliminadas inmediatamente de su Perfil, sin perjuicio de copias técnicas temporales o de aquellas que deban conservarse por obligaciones legales.",
      },
      {
        type: "p",
        text: "No se permitirá utilizar fotografías manipuladas, generadas o alteradas de forma que puedan inducir a otros Usuarios a creer que representan la identidad real del Usuario cuando ello sea falso o engañoso.",
      },
    ],
  },
  {
    id: "verificacion",
    title: "9. Verificación de identidad",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá ofrecer un sistema voluntario de verificación de identidad.",
      },
      {
        type: "p",
        text: "La verificación podrá requerir documentación oficial y una fotografía o selfie destinada a comprobar la correspondencia entre la persona y la documentación presentada.",
      },
      {
        type: "p",
        text: "Los documentos y fotografías utilizados para la verificación serán conservados durante el tiempo necesario para realizar, mantener o comprobar la verificación, de acuerdo con la legislación aplicable.",
      },
      {
        type: "p",
        text: "El acceso a dicha información estará limitado al personal autorizado que necesite intervenir en los procesos de verificación.",
      },
      {
        type: "p",
        text: "Cuando el Usuario elimine su cuenta, la documentación y selfie asociadas a la verificación serán eliminadas, salvo que exista una obligación legal que requiera su conservación.",
      },
      {
        type: "p",
        html: true,
        text: "Los Usuarios verificados podrán mostrar una insignia pública de <strong>“Verificado”</strong>.",
      },
    ],
  },
  {
    id: "contacto-externo",
    title: "10. Información de contacto externa",
    blocks: [
      {
        type: "p",
        text: "El Usuario podrá incluir en su Perfil información de contacto externa, incluyendo Instagram, WhatsApp, teléfono, Telegram, correo electrónico u otros medios de contacto.",
      },
      {
        type: "p",
        text: "La publicación de dicha información será responsabilidad exclusiva del Usuario.",
      },
      {
        type: "p",
        text: "Nocta podrá eliminar o limitar información de contacto cuando considere que está siendo utilizada para actividades prohibidas, fraudulentas, ilegales, comerciales no autorizadas o contrarias a estos Términos.",
      },
    ],
  },
  {
    id: "contenido-usuarios",
    title: "11. Contenido generado por los Usuarios",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán generar y publicar determinados contenidos dentro de Nocta, incluyendo fotografías, biografías, reseñas, valoraciones y otros contenidos que la plataforma permita.",
      },
      {
        type: "p",
        text: "El Usuario conserva la titularidad de los derechos que legalmente le correspondan sobre sus contenidos.",
      },
      {
        type: "p",
        text: "Al publicar contenido, el Usuario concede a Nocta una licencia no exclusiva, gratuita, mundial y limitada a la duración necesaria para alojar, reproducir, adaptar técnicamente, mostrar y distribuir dicho contenido dentro de Nocta y para operar y promocionar sus servicios, respetando la legislación aplicable.",
      },
      {
        type: "p",
        text: "El Usuario declara que posee los derechos necesarios para publicar el contenido y que su publicación no vulnera derechos de terceros.",
      },
    ],
  },
  {
    id: "resenas",
    title: "12. Reseñas de Espacios",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán publicar reseñas sobre los Espacios disponibles en Nocta.",
      },
      {
        type: "p",
        html: true,
        text: "Las reseñas podrán incluir una valoración de entre <strong>1 y 5 estrellas</strong>, texto y hasta <strong>una fotografía</strong>.",
      },
      {
        type: "p",
        text: "Las reseñas deberán reflejar experiencias reales del Usuario y no podrán contener información deliberadamente falsa, manipulada, difamatoria, discriminatoria, amenazante o destinada a perjudicar ilegítimamente a un tercero o establecimiento.",
      },
      {
        type: "p",
        text: "Nocta podrá moderar, ocultar o eliminar reseñas que infrinjan estos Términos.",
      },
    ],
  },
  {
    id: "anonimizacion-resenas",
    title: "13. Eliminación y anonimización de reseñas",
    blocks: [
      {
        type: "p",
        text: "Cuando un Usuario elimine su cuenta, Nocta podrá eliminar la identificación personal asociada a sus reseñas.",
      },
      {
        type: "p",
        html: true,
        text: "Las reseñas podrán permanecer publicadas de forma anonimizada, por ejemplo bajo la denominación <strong>“Usuario eliminado”</strong>, cuando ello resulte necesario para preservar la utilidad y continuidad de la información comunitaria.",
      },
      {
        type: "p",
        text: "Las fotografías asociadas a una reseña podrán permanecer cuando sea necesario para preservar su contenido, sin perjuicio de los derechos que correspondan al Usuario o a terceros conforme a la legislación aplicable.",
      },
      {
        type: "p",
        text: "Nocta atenderá las solicitudes legítimas de eliminación que correspondan de acuerdo con la normativa vigente.",
      },
    ],
  },
  {
    id: "pausa-perfil",
    title: "14. Pausa del Perfil",
    blocks: [
      {
        type: "p",
        text: "El Usuario podrá pausar temporalmente su Perfil cuando Nocta habilite dicha funcionalidad.",
      },
      {
        type: "p",
        text: "Durante la pausa, el Perfil dejará de estar disponible para nuevas interacciones.",
      },
      {
        type: "p",
        text: "Los matches y conversaciones existentes podrán conservarse, pero permanecerán inaccesibles mientras el Perfil esté pausado.",
      },
      {
        type: "p",
        text: "El Usuario podrá reactivar su Perfil en cualquier momento y, una vez reactivado, volverá a estar visible de acuerdo con la configuración vigente.",
      },
    ],
  },
  {
    id: "eliminacion-cuenta",
    title: "15. Eliminación de la cuenta",
    blocks: [
      {
        type: "p",
        text: "El Usuario podrá solicitar la eliminación de su cuenta.",
      },
      {
        type: "p",
        html: true,
        text: "La eliminación contará con un período de recuperación de <strong>30 días</strong>.",
      },
      {
        type: "p",
        text: "Durante dicho período, el Perfil, likes, búsquedas, seguidores, matches e interacciones permanecerán completamente invisibles para otros Usuarios.",
      },
      {
        type: "p",
        text: "Si el Usuario no recupera la cuenta durante dicho período, Nocta procederá a eliminar la cuenta y la información personal correspondiente, salvo aquella información que deba conservarse por obligaciones legales, prevención de fraude, resolución de conflictos o ejercicio o defensa de derechos.",
      },
    ],
  },
  {
    id: "espacios",
    title: "16. Espacios",
    blocks: [
      {
        type: "p",
        text: "Nocta permite explorar Espacios relacionados con actividades sociales y nocturnas.",
      },
      {
        type: "p",
        text: "Los Espacios podrán corresponder, entre otros, a:",
      },
      {
        type: "ul",
        items: [
          "Boliches.",
          "Bares.",
          "Pubs.",
          "Cervecerías.",
          "Conciertos.",
          "Festivales.",
          "Fiestas privadas.",
        ],
      },
      {
        type: "p",
        text: "La existencia de un Espacio en Nocta no implica que Nocta sea propietaria, representante, organizadora, responsable o administradora del establecimiento o evento.",
      },
    ],
  },
  {
    id: "admin-espacios",
    title: "17. Creación y administración de Espacios",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán sugerir la incorporación de nuevos Espacios.",
      },
      {
        type: "p",
        text: "Las sugerencias no serán publicadas automáticamente. Nocta podrá revisar cada solicitud y aceptarla o rechazarla.",
      },
      {
        type: "p",
        text: "Un Usuario también podrá solicitar administrar un Espacio existente.",
      },
      {
        type: "p",
        text: "La administración de un Espacio requerirá autorización de Nocta.",
      },
      {
        type: "p",
        text: "El hecho de ser Organizador de un Espacio dentro de Nocta no implica, por sí mismo, que Nocta haya verificado que dicha persona sea propietaria, representante legal o responsable del establecimiento, salvo que Nocta indique expresamente lo contrario.",
      },
    ],
  },
  {
    id: "contenido-espacios",
    title: "18. Contenido de los Espacios",
    blocks: [
      {
        type: "p",
        text: "Un Espacio podrá incluir información como:",
      },
      {
        type: "ul",
        items: [
          "Nombre.",
          "Fotografía.",
          "Dirección.",
          "Ciudad.",
          "Barrio.",
          "Categoría.",
          "Correo electrónico.",
          "Teléfono.",
        ],
      },
      {
        type: "p",
        text: "Los Organizadores autorizados podrán publicar noticias y promociones en los Espacios que administren.",
      },
      {
        type: "p",
        html: true,
        text: "Las publicaciones de noticias podrán incluir texto y hasta <strong>una fotografía</strong>.",
      },
      {
        type: "p",
        text: "Las promociones podrán incluir texto, fotografía y precio de la promoción.",
      },
      {
        type: "p",
        text: "Los Organizadores serán responsables de la exactitud y legalidad del contenido que publiquen.",
      },
    ],
  },
  {
    id: "presencia",
    title: "19. Presencia en Espacios y notificaciones",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Nocta permite a los Usuarios indicar voluntariamente su presencia en un Espacio mediante una selección manual realizada desde el perfil del Espacio. Esta funcionalidad <strong>no utiliza GPS para determinar si el Usuario se encuentra físicamente en el lugar</strong>.",
      },
      {
        type: "p",
        html: true,
        text: "El Usuario podrá seleccionar una duración de <strong>24 horas, 48 horas, 1 semana o permanentemente</strong>. Las presencias de duración limitada finalizarán automáticamente al vencer el período seleccionado, mientras que las permanentes permanecerán activas hasta que el Usuario las retire.",
      },
      {
        type: "p",
        html: true,
        text: "Cada Usuario podrá mantener <strong>una única presencia activa</strong>. Si selecciona un nuevo Espacio, la presencia anterior finalizará automáticamente y se activará la nueva presencia.",
      },
      {
        type: "p",
        text: "Mientras la presencia se encuentre activa, podrá mostrarse en el Perfil del Usuario junto con el Espacio seleccionado y, cuando corresponda, el tiempo restante de la presencia.",
      },
      {
        type: "p",
        html: true,
        text: "La publicación de una presencia podrá generar una notificación a los <strong>seguidores Premium</strong> del Usuario, independientemente de que el Usuario que publica la presencia sea Premium o gratuito.",
      },
      {
        type: "p",
        text: "La notificación podrá identificar al Usuario y al Espacio correspondiente, por ejemplo:",
      },
      {
        type: "p",
        html: true,
        text: "<strong>“Joaquín está en VOU Club.”</strong>",
      },
      {
        type: "p",
        html: true,
        text: "Al retirar o finalizar una presencia, <strong>no se enviará una notificación de salida</strong>.",
      },
      {
        type: "p",
        text: "La selección de un Espacio tampoco generará por sí misma un historial público de ubicaciones anteriores.",
      },
      {
        type: "p",
        text: "El Usuario es responsable de la exactitud de la presencia que publique y de seleccionar correctamente el Espacio en el que desea indicar su presencia.",
      },
    ],
  },
  {
    id: "ubicacion",
    title: "20. Ubicación y ciudad",
    blocks: [
      {
        type: "p",
        text: "Para utilizar Nocta como Usuario gratuito, será necesario permitir el acceso a la ubicación del dispositivo cuando dicha funcionalidad sea requerida por la plataforma.",
      },
      {
        type: "p",
        text: "Si el Usuario rechaza el permiso de ubicación, podrá no tener acceso a determinadas funcionalidades de Nocta, incluyendo aquellas relacionadas con la determinación automática de la ciudad.",
      },
      {
        type: "p",
        text: "Los Usuarios gratuitos estarán limitados a la ciudad determinada por Nocta en función de la ubicación del dispositivo y su proximidad.",
      },
      {
        type: "p",
        text: "Nocta podrá utilizar la ubicación del dispositivo para determinar la ciudad correspondiente, conforme a su Política de Privacidad y a los permisos otorgados por el Usuario.",
      },
    ],
  },
  {
    id: "teleport",
    title: "21. Teleport",
    blocks: [
      {
        type: "p",
        html: true,
        text: "<strong>Teleport</strong> es una funcionalidad exclusiva de Premium que permite seleccionar una ciudad diferente a aquella en la que se encuentra físicamente el Usuario para explorar los Espacios disponibles en dicha ciudad.",
      },
      {
        type: "p",
        text: "Teleport modifica únicamente la ciudad que el Usuario desea explorar dentro de Nocta.",
      },
      {
        type: "p",
        html: true,
        text: "Teleport <strong>no modifica, falsifica ni representa como verdadera la ubicación física del Usuario</strong>.",
      },
      {
        type: "p",
        text: "La disponibilidad de esta funcionalidad podrá depender del plan contratado y de la implementación vigente de Nocta.",
      },
    ],
  },
  {
    id: "seguidores",
    title: "22. Seguidores",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán seguir a otros Usuarios.",
      },
      {
        type: "p",
        text: "Por defecto, las solicitudes para seguir a otro Usuario requerirán aprobación.",
      },
      {
        type: "p",
        text: "El Usuario podrá desactivar dicha aprobación cuando Nocta habilite esta opción, permitiendo que los nuevos seguidores sean aceptados automáticamente.",
      },
      {
        type: "p",
        text: "Las solicitudes pendientes podrán ser aceptadas o rechazadas por el Usuario receptor.",
      },
    ],
  },
  {
    id: "likes",
    title: "23. Likes",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán indicar que les gusta otro Perfil mediante la funcionalidad de Like.",
      },
      {
        type: "p",
        text: "Cuando un Usuario reciba un Like, podrá recibir una notificación, pero la identidad de la persona que realizó el Like no será revelada automáticamente.",
      },
      {
        type: "p",
        text: "En la sección correspondiente, el Perfil de quien realizó el Like podrá aparecer como una tarjeta desenfocada.",
      },
      {
        type: "p",
        text: "Los Usuarios gratuitos podrán visualizar únicamente determinada información limitada, incluyendo la edad, el Espacio en el que se produjo el Like y el momento en que se realizó.",
      },
      {
        type: "p",
        text: "Los Usuarios Premium podrán conocer la identidad de quienes les dieron Like y podrán responder directamente para generar un Match cuando corresponda.",
      },
    ],
  },
  {
    id: "matches",
    title: "24. Matches",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Cuando dos Usuarios se hayan dado Like mutuamente, se generará un <strong>Match</strong>.",
      },
      {
        type: "p",
        text: "El Match habilitará la posibilidad de iniciar una conversación privada entre ambos Usuarios.",
      },
      {
        type: "p",
        text: "Nocta no garantiza que un Match derive en una relación personal, encuentro físico o cualquier otro resultado.",
      },
    ],
  },
  {
    id: "mensajeria",
    title: "25. Mensajería",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios que tengan un Match podrán intercambiar mensajes privados.",
      },
      { type: "p", text: "La mensajería estará limitada a texto." },
      {
        type: "p",
        text: "Nocta no habilita actualmente el envío de fotografías, audios o videos dentro del chat.",
      },
      {
        type: "p",
        text: "Los Usuarios podrán recibir notificaciones push relacionadas con nuevos mensajes, según la configuración del dispositivo y de Nocta.",
      },
    ],
  },
  {
    id: "eliminacion-match",
    title: "26. Eliminación de Match",
    blocks: [
      {
        type: "p",
        text: "Cualquiera de los dos Usuarios podrá eliminar un Match.",
      },
      {
        type: "p",
        text: "Cuando se elimine un Match, ambos Usuarios dejarán de tener acceso a la conversación.",
      },
      {
        type: "p",
        text: "Los mensajes podrán permanecer almacenados internamente durante el período necesario para fines técnicos, de seguridad, prevención de abuso, cumplimiento legal o resolución de conflictos, aunque ya no sean visibles para los Usuarios.",
      },
    ],
  },
  {
    id: "bloqueos",
    title: "27. Bloqueos",
    blocks: [
      {
        type: "p",
        text: "Un Usuario podrá bloquear a otro Usuario.",
      },
      {
        type: "p",
        text: "Cuando se produzca un bloqueo, ambos Usuarios dejarán de verse mutuamente y no podrán interactuar mediante likes, follows, búsquedas, matches u otras funcionalidades destinadas a conectar ambos Perfiles.",
      },
      {
        type: "p",
        text: "El bloqueo no implica necesariamente la eliminación retroactiva de todos los registros internos relacionados con la relación entre ambos Usuarios.",
      },
    ],
  },
  {
    id: "conductas-prohibidas",
    title: "28. Conductas prohibidas",
    blocks: [
      {
        type: "p",
        text: "Está prohibido utilizar Nocta para:",
      },
      {
        type: "ul",
        items: [
          "Crear cuentas falsas.",
          "Suplantar o hacerse pasar por otra persona.",
          "Utilizar información de identidad falsa o engañosa.",
          "Compartir o transferir cuentas.",
          "Acosar, hostigar, perseguir, intimidar o amenazar a otros Usuarios.",
          "Realizar contacto reiterado no deseado.",
          "Publicar contenido sexual explícito o desnudos.",
          "Publicar violencia gráfica o amenazas.",
          "Promover, glorificar o facilitar actividades delictivas.",
          "Solicitar, ofrecer o coordinar servicios sexuales o prostitución a cambio de dinero, bienes u otros beneficios.",
          "Discriminar por sexo, género, orientación sexual, edad, nacionalidad, origen, religión, discapacidad, apariencia u otras características personales.",
          "Utilizar Nocta para actividades comerciales no autorizadas.",
          "Utilizar Nocta para publicidad, captación de clientes o promoción comercial sin autorización.",
          "Intentar acceder sin autorización a cuentas, sistemas o información de otros Usuarios.",
          "Utilizar mecanismos automatizados para acceder, extraer o manipular información de Nocta sin autorización.",
          "Realizar actividades fraudulentas o engañosas.",
          "Utilizar Nocta para cualquier finalidad ilegal.",
        ],
      },
    ],
  },
  {
    id: "moderacion",
    title: "29. Moderación",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá moderar el contenido y comportamiento dentro de la plataforma.",
      },
      {
        type: "p",
        text: "Cuando considere que un contenido, Perfil, interacción o actividad infringe estos Términos, la legislación aplicable o puede perjudicar la seguridad de la comunidad, Nocta podrá, sin necesidad de aviso previo:",
      },
      {
        type: "ul",
        items: [
          "Eliminar contenido.",
          "Ocultar contenido.",
          "Limitar su visibilidad.",
          "Suspender funcionalidades.",
          "Limitar interacciones.",
          "Bloquear determinadas acciones.",
          "Suspender temporalmente una cuenta.",
          "Eliminar una cuenta.",
        ],
      },
      {
        type: "p",
        text: "Nocta podrá actuar preventivamente cuando resulte razonablemente necesario para proteger a los Usuarios o la integridad de la plataforma.",
      },
    ],
  },
  {
    id: "reportes",
    title: "30. Reportes y seguridad",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán reportar Perfiles, contenidos o conductas que consideren contrarios a estos Términos.",
      },
      {
        type: "p",
        text: "Nocta podrá revisar los reportes y adoptar las medidas que considere apropiadas.",
      },
      {
        type: "p",
        text: "Nocta podrá colaborar con autoridades competentes cuando exista una obligación legal o cuando corresponda conforme a la legislación aplicable.",
      },
      {
        type: "p",
        text: "Los Usuarios deberán utilizar las herramientas de bloqueo y reporte cuando consideren que otro Usuario representa un riesgo o infringe las normas.",
      },
    ],
  },
  {
    id: "encuentros",
    title: "31. Seguridad en encuentros",
    blocks: [
      {
        type: "p",
        text: "Nocta facilita interacciones digitales entre personas y no controla los encuentros físicos que puedan producirse entre Usuarios.",
      },
      {
        type: "p",
        text: "Cada Usuario es responsable de adoptar las medidas necesarias para su propia seguridad cuando decida encontrarse personalmente con otra persona.",
      },
      {
        type: "p",
        text: "Nocta recomienda realizar los primeros encuentros en lugares públicos, informar a personas de confianza sobre los planes y evitar compartir información personal sensible con desconocidos.",
      },
      {
        type: "p",
        text: "Nocta no garantiza la identidad, intenciones, antecedentes, conducta o seguridad de ningún Usuario.",
      },
    ],
  },
  {
    id: "enlaces",
    title: "32. Enlaces externos",
    blocks: [
      {
        type: "p",
        text: "Los Usuarios podrán incluir enlaces externos en sus Perfiles cuando Nocta lo permita.",
      },
      {
        type: "p",
        text: "Nocta podrá eliminar o limitar enlaces que considere peligrosos, fraudulentos, ilegales, engañosos o contrarios a estos Términos.",
      },
      {
        type: "p",
        text: "Nocta no controla los sitios externos enlazados y no será responsable por sus contenidos, servicios, políticas o prácticas.",
      },
    ],
  },
  {
    id: "publicidad",
    title: "33. Publicidad",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá mostrar publicidad de terceros a los Usuarios. Mientras no exista inventario publicitario activo en el producto, esta sección describe el marco aplicable cuando se habilite.",
      },
      {
        type: "p",
        text: "La personalización de anuncios, cuando exista, podrá basarse exclusivamente en las preferencias e intereses declarados por el Usuario, de acuerdo con la configuración y política de privacidad aplicable.",
      },
      {
        type: "p",
        text: "Nocta no garantiza la disponibilidad permanente de un determinado anunciante, campaña o contenido publicitario. Los beneficios Premium vigentes se comunican en la app y pueden actualizarse.",
      },
    ],
  },
  {
    id: "premium-2am",
    title: "34. Premium 2 AM",
    blocks: [
      {
        type: "p",
        html: true,
        text: "El plan Premium <strong>2 AM</strong> podrá incluir, entre otros, los siguientes beneficios:",
      },
      {
        type: "ul",
        items: [
          "Likes ilimitados.",
          "Retroceder cuando quieras.",
          "Sin anuncios.",
          "Modo Teleport.",
          "Modo Pícaro.",
        ],
      },
      {
        type: "p",
        html: true,
        text: "El plan Premium <strong>4 AM</strong> incluye los beneficios de <strong>2 AM</strong> y, además, <strong>Ver quién te dio Like</strong>, cupos de <strong>Boost</strong> y <strong>Heartshot</strong> según el periodo contratado.",
      },
      {
        type: "p",
        html: true,
        text: "El plan Premium <strong>6 AM</strong> incluye los beneficios de <strong>4 AM</strong> con cupos mayores y, además, <strong>Modo espía</strong> y <strong>Clone</strong> (hasta tres presencias activas).",
      },
      {
        type: "p",
        text: "Algunas funcionalidades podrán encontrarse en desarrollo o indicarse como “próximamente”.",
      },
      {
        type: "p",
        text: "La descripción vigente dentro de Nocta será la referencia para determinar las funcionalidades efectivamente incluidas en cada plan.",
      },
    ],
  },
  {
    id: "suscripciones",
    title: "35. Suscripciones",
    blocks: [
      {
        type: "p",
        text: "Las suscripciones Premium podrán contratarse por períodos:",
      },
      {
        type: "ul",
        items: ["Mensual.", "Trimestral.", "Semestral.", "Anual."],
      },
      {
        type: "p",
        text: "Las suscripciones serán de renovación automática, salvo que el Usuario las cancele antes de la fecha de renovación.",
      },
      {
        type: "p",
        text: "La cancelación evitará la renovación del período siguiente, pero el Usuario conservará los beneficios Premium hasta la finalización del período ya abonado.",
      },
    ],
  },
  {
    id: "precios",
    title: "36. Precios y pagos",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Los precios de Premium serán mostrados dentro de Nocta en <strong>dólares estadounidenses (USD)</strong>.",
      },
      {
        type: "p",
        text: "El precio informado será el precio final aplicable, incluyendo los impuestos o cargos que correspondan según la modalidad de contratación.",
      },
      {
        type: "p",
        html: true,
        text: "Los pagos se procesarán mediante <strong>Mercado Pago</strong>.",
      },
      {
        type: "p",
        text: "Nocta no almacenará los datos completos de las tarjetas o medios de pago utilizados por el Usuario cuando estos sean procesados directamente por Mercado Pago.",
      },
      {
        type: "p",
        text: "Las condiciones específicas de los medios de pago podrán estar sujetas adicionalmente a los términos de Mercado Pago.",
      },
    ],
  },
  {
    id: "reembolsos",
    title: "37. Reembolsos",
    blocks: [
      {
        type: "p",
        text: "Las suscripciones Premium no serán reembolsables una vez efectuado el pago, salvo cuando el reembolso sea exigido por la legislación aplicable o corresponda conforme a derechos del consumidor que no puedan ser válidamente excluidos.",
      },
      {
        type: "p",
        text: "Nada de lo establecido en este artículo pretende limitar derechos irrenunciables reconocidos por la normativa aplicable.",
      },
    ],
  },
  {
    id: "propiedad-intelectual",
    title: "38. Propiedad intelectual de Nocta",
    blocks: [
      {
        type: "p",
        text: "Nocta y sus elementos originales, incluyendo su software, diseño, interfaces, identidad visual, logotipos, marcas, textos, funcionalidades y contenidos propios, pertenecen a su titular o a sus respectivos licenciantes.",
      },
      {
        type: "p",
        text: "El uso de Nocta no concede al Usuario ningún derecho de propiedad sobre dichos elementos.",
      },
      {
        type: "p",
        text: "Está prohibido copiar, modificar, distribuir, vender, realizar ingeniería inversa o explotar comercialmente elementos de Nocta sin autorización previa, salvo cuando la legislación aplicable permita expresamente dicha conducta.",
      },
    ],
  },
  {
    id: "ia",
    title: "39. Herramientas de inteligencia artificial y automatización",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá incorporar herramientas basadas en inteligencia artificial, automatización u otros sistemas tecnológicos.",
      },
      {
        type: "p",
        text: "Estas herramientas podrán utilizarse para funcionalidades tales como recomendaciones, clasificación, moderación, asistencia, generación de contenidos u otras funciones que Nocta incorpore.",
      },
      {
        type: "p",
        text: "Los resultados generados automáticamente pueden contener errores y no deberán considerarse necesariamente exactos, completos o definitivos.",
      },
      {
        type: "p",
        text: "Nocta podrá modificar, limitar o eliminar funcionalidades basadas en inteligencia artificial.",
      },
    ],
  },
  {
    id: "disponibilidad",
    title: "40. Disponibilidad del servicio",
    blocks: [
      {
        type: "p",
        text: "Nocta procurará mantener el servicio disponible, pero no garantiza que la plataforma funcione de manera permanente, ininterrumpida o libre de errores.",
      },
      {
        type: "p",
        text: "Podrán producirse interrupciones por mantenimiento, actualizaciones, fallas técnicas, problemas de infraestructura, servicios de terceros, conectividad, ataques informáticos, fuerza mayor u otras circunstancias.",
      },
      {
        type: "p",
        text: "Nocta podrá realizar tareas de mantenimiento o actualización sin previo aviso cuando resulte necesario.",
      },
    ],
  },
  {
    id: "terceros",
    title: "41. Servicios de terceros",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá utilizar servicios proporcionados por terceros para determinadas funciones, incluyendo autenticación, pagos, alojamiento, almacenamiento, comunicaciones, mapas, analítica u otros servicios tecnológicos.",
      },
      {
        type: "p",
        text: "La utilización de dichos servicios podrá estar sujeta a los términos y políticas de sus respectivos proveedores.",
      },
      {
        type: "p",
        text: "Nocta no será responsable por fallas exclusivamente atribuibles a servicios de terceros, sin perjuicio de las obligaciones que legalmente correspondan.",
      },
    ],
  },
  {
    id: "contenido-terceros",
    title: "42. Contenido de terceros",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá mostrar información proporcionada por terceros, incluyendo información de Espacios, establecimientos, eventos, promociones o enlaces externos.",
      },
      {
        type: "p",
        text: "Nocta no garantiza que toda información proporcionada por terceros sea exacta, completa, actualizada o disponible permanentemente.",
      },
      {
        type: "p",
        text: "Los Usuarios deberán verificar directamente con el establecimiento o proveedor cualquier información relevante antes de tomar decisiones basadas en ella.",
      },
    ],
  },
  {
    id: "limitacion",
    title: "43. Limitación de responsabilidad",
    blocks: [
      {
        type: "p",
        text: "Nocta actúa como una plataforma tecnológica que facilita determinadas interacciones y acceso a información.",
      },
      {
        type: "p",
        text: "En la máxima medida permitida por la legislación aplicable, Nocta no será responsable por:",
      },
      {
        type: "ul",
        items: [
          "La conducta de otros Usuarios.",
          "La identidad real o intenciones de otros Usuarios.",
          "Los encuentros físicos entre Usuarios.",
          "Los contenidos publicados por Usuarios o terceros.",
          "La calidad, seguridad, legalidad o funcionamiento de los Espacios.",
          "La prestación de servicios por establecimientos o eventos.",
          "Daños derivados de información falsa proporcionada por Usuarios o terceros.",
          "Fallas de servicios de terceros.",
          "Interrupciones o errores técnicos fuera de su control razonable.",
        ],
      },
      {
        type: "p",
        text: "Esta limitación no será aplicable cuando la responsabilidad no pueda ser legalmente excluida o limitada.",
      },
    ],
  },
  {
    id: "indemnidad",
    title: "44. Indemnidad",
    blocks: [
      {
        type: "p",
        text: "En la medida permitida por la legislación aplicable, el Usuario será responsable por los daños, reclamos, sanciones, costos o perjuicios que resulten de su incumplimiento de estos Términos, de la legislación aplicable o de derechos de terceros.",
      },
      {
        type: "p",
        text: "Esta obligación no limitará los derechos que correspondan al consumidor conforme a la normativa aplicable.",
      },
    ],
  },
  {
    id: "suspension",
    title: "45. Suspensión y terminación",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá suspender o terminar una cuenta cuando exista incumplimiento de estos Términos, actividad fraudulenta, ilegal, abusiva o que represente un riesgo para otros Usuarios o para la plataforma.",
      },
      {
        type: "p",
        text: "El Usuario podrá dejar de utilizar Nocta en cualquier momento y solicitar la eliminación de su cuenta conforme al artículo correspondiente.",
      },
      {
        type: "p",
        text: "La terminación de una cuenta no afectará las obligaciones que por su naturaleza deban continuar vigentes.",
      },
    ],
  },
  {
    id: "modificacion-terminos",
    title: "46. Modificación de los Términos",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá modificar estos Términos y Condiciones cuando resulte necesario por cambios en el servicio, legislación, funcionamiento de la plataforma, seguridad u otras razones legítimas.",
      },
      {
        type: "p",
        text: "La versión vigente estará disponible dentro de Nocta.",
      },
      {
        type: "p",
        text: "Cuando los cambios sean sustanciales, Nocta podrá informar al Usuario de manera razonable y, cuando corresponda, solicitar nuevamente su aceptación.",
      },
      {
        type: "p",
        text: "El uso continuado de Nocta después de la entrada en vigor de los cambios podrá implicar la aceptación de la nueva versión, sin perjuicio de los derechos que correspondan conforme a la legislación aplicable.",
      },
    ],
  },
  {
    id: "modificacion-funcionalidades",
    title: "47. Modificación de funcionalidades",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá crear, modificar, suspender o eliminar funcionalidades, servicios, características, planes, beneficios o contenidos de la plataforma.",
      },
      {
        type: "p",
        text: "Las funcionalidades Premium contratadas serán prestadas de acuerdo con las condiciones vigentes del plan adquirido y con los derechos que correspondan al Usuario conforme a la legislación aplicable.",
      },
      {
        type: "p",
        text: "Nocta procurará comunicar modificaciones relevantes de manera razonable.",
      },
    ],
  },
  {
    id: "datos-personales",
    title: "48. Protección de datos personales",
    blocks: [
      {
        type: "p",
        text: "Nocta tratará los datos personales de los Usuarios de acuerdo con la legislación aplicable en materia de protección de datos personales, incluyendo la normativa vigente en Uruguay.",
      },
      {
        type: "p",
        text: "El tratamiento de datos personales se realizará conforme a la Política de Privacidad de Nocta.",
      },
      {
        type: "p",
        text: "El Usuario podrá ejercer los derechos que le correspondan respecto de sus datos personales de acuerdo con la legislación aplicable.",
      },
    ],
  },
  {
    id: "datos-ubicacion",
    title: "49. Datos de ubicación",
    blocks: [
      {
        type: "p",
        text: "Cuando el Usuario otorgue permiso para acceder a la ubicación de su dispositivo, Nocta podrá utilizar dicha información para las finalidades expresamente informadas, incluyendo la determinación de la ciudad en la que se encuentra el Usuario para el funcionamiento de determinadas funcionalidades.",
      },
      {
        type: "p",
        text: "La ubicación física del Usuario y la presencia manual en un Espacio constituyen funcionalidades diferentes.",
      },
      {
        type: "p",
        html: true,
        text: "La funcionalidad de presencia descrita en el artículo 19 <strong>no utiliza GPS para confirmar la permanencia física del Usuario en el Espacio seleccionado</strong>.",
      },
      {
        type: "p",
        text: "El tratamiento de información relacionada con ubicación se realizará conforme a la Política de Privacidad y a la legislación aplicable.",
      },
    ],
  },
  {
    id: "comunicaciones",
    title: "50. Comunicaciones",
    blocks: [
      {
        type: "p",
        text: "Nocta podrá enviar comunicaciones relacionadas con el funcionamiento de la cuenta, seguridad, cambios en el servicio y otras cuestiones necesarias para prestar el servicio.",
      },
      {
        type: "p",
        html: true,
        text: "Las comunicaciones por correo electrónico relacionadas con el servicio (verificación de cuenta, recuperación de acceso, avisos operativos y similares) se enviarán desde la casilla <a href=\"mailto:noreply@jpc-dev.uy\">noreply@jpc-dev.uy</a>.",
      },
      {
        type: "p",
        text: "Cuando el Usuario lo permita, Nocta podrá enviar notificaciones push relacionadas con:",
      },
      {
        type: "ul",
        items: [
          "Mensajes.",
          "Likes.",
          "Matches.",
          "Nuevos seguidores.",
          "Solicitudes de seguimiento.",
          "Actividad en Espacios seguidos.",
          "Noticias de Espacios seguidos.",
          "Promociones de Espacios seguidos.",
          "Presencias en Espacios, de acuerdo con el artículo 19.",
        ],
      },
      {
        type: "p",
        text: "Las notificaciones podrán contener información detallada sobre la actividad correspondiente, de acuerdo con la funcionalidad disponible y la configuración del Usuario.",
      },
    ],
  },
  {
    id: "derechos-usuario",
    title: "51. Derechos del Usuario",
    blocks: [
      {
        type: "p",
        text: "El Usuario podrá ejercer los derechos reconocidos por la legislación aplicable, incluyendo aquellos relativos al acceso, rectificación, actualización, inclusión, supresión, oposición o demás derechos que correspondan respecto de sus datos personales.",
      },
      {
        type: "p",
        text: "Las solicitudes podrán realizarse utilizando los canales de contacto habilitados por Nocta.",
      },
      {
        type: "p",
        text: "Nocta podrá solicitar información razonable para verificar la identidad del solicitante cuando resulte necesario para proteger la información personal.",
      },
    ],
  },
  {
    id: "privacidad-terceros",
    title: "52. Privacidad de terceros",
    blocks: [
      {
        type: "p",
        text: "El Usuario deberá respetar la privacidad y los derechos de otras personas.",
      },
      {
        type: "p",
        text: "Está prohibido publicar, divulgar o utilizar información personal de terceros sin autorización cuando dicha conducta infrinja la legislación aplicable o estos Términos.",
      },
      {
        type: "p",
        text: "El Usuario no podrá utilizar Nocta para recopilar, almacenar o distribuir información personal de terceros con fines abusivos, fraudulentos o ilegales.",
      },
    ],
  },
  {
    id: "cuentas-inactivas",
    title: "53. Cuentas inactivas",
    blocks: [
      {
        type: "p",
        text: "Nocta no elimina automáticamente las cuentas únicamente por permanecer inactivas.",
      },
      {
        type: "p",
        text: "La cuenta podrá permanecer registrada hasta que el Usuario solicite su eliminación o hasta que Nocta adopte una medida de suspensión o terminación conforme a estos Términos.",
      },
    ],
  },
  {
    id: "menores",
    title: "54. Menores de edad",
    blocks: [
      {
        type: "p",
        text: "Nocta está destinada exclusivamente a personas mayores de 18 años.",
      },
      {
        type: "p",
        text: "No está permitido crear o utilizar cuentas pertenecientes a menores de edad.",
      },
      {
        type: "p",
        text: "Si Nocta detecta o recibe información razonable que indique que una cuenta pertenece a una persona menor de 18 años, podrá suspenderla o eliminarla.",
      },
    ],
  },
  {
    id: "legislacion",
    title: "55. Legislación aplicable",
    blocks: [
      {
        type: "p",
        html: true,
        text: "Estos Términos se regirán e interpretarán de acuerdo con las leyes de la <strong>República Oriental del Uruguay</strong>, sin perjuicio de las normas imperativas de protección al consumidor u otras disposiciones que resulten aplicables.",
      },
    ],
  },
  {
    id: "controversias",
    title: "56. Resolución de controversias",
    blocks: [
      {
        type: "p",
        text: "Las controversias relacionadas con estos Términos o con el uso de Nocta procurarán resolverse inicialmente mediante comunicación directa con Nocta.",
      },
      {
        type: "p",
        text: "Cuando no sea posible alcanzar una solución, serán aplicables los mecanismos y jurisdicciones que correspondan conforme a la legislación uruguaya.",
      },
      {
        type: "p",
        text: "Nada de lo establecido en este artículo limita los derechos que la legislación otorgue a los consumidores o usuarios.",
      },
    ],
  },
  {
    id: "nulidad",
    title: "57. Nulidad y separabilidad",
    blocks: [
      {
        type: "p",
        text: "Si alguna disposición de estos Términos fuese declarada inválida, ilegal o inaplicable, dicha disposición será interpretada o modificada en la medida necesaria para hacerla válida, cuando ello sea jurídicamente posible.",
      },
      {
        type: "p",
        text: "La invalidez de una disposición no afectará la validez de las restantes.",
      },
    ],
  },
  {
    id: "renuncia",
    title: "58. Ausencia de renuncia",
    blocks: [
      {
        type: "p",
        text: "El hecho de que Nocta no ejerza inmediatamente un derecho o facultad previsto en estos Términos no constituirá una renuncia a dicho derecho o facultad.",
      },
      {
        type: "p",
        text: "Cualquier renuncia deberá realizarse de manera expresa cuando corresponda.",
      },
    ],
  },
  {
    id: "cesion",
    title: "59. Cesión",
    blocks: [
      {
        type: "p",
        text: "El Usuario no podrá ceder, transferir o disponer de los derechos u obligaciones derivados de estos Términos sin autorización de Nocta.",
      },
      {
        type: "p",
        text: "Nocta podrá ceder o transferir sus derechos y obligaciones en relación con estos Términos cuando ello resulte necesario por reorganización, transferencia del servicio, constitución de una sociedad, adquisición, venta de activos u operación empresarial equivalente, respetando los derechos de los Usuarios y la legislación aplicable.",
      },
    ],
  },
  {
    id: "acuerdo-completo",
    title: "60. Acuerdo completo",
    blocks: [
      {
        type: "p",
        text: "Estos Términos, junto con la Política de Privacidad y cualquier otra política o condición expresamente incorporada, constituyen el acuerdo entre el Usuario y Nocta respecto del uso de la plataforma.",
      },
      {
        type: "p",
        text: "En caso de contradicción entre estos Términos y una condición específica aplicable a una funcionalidad determinada, prevalecerá la condición específica en aquello que regule expresamente dicha funcionalidad.",
      },
    ],
  },
  {
    id: "contacto",
    title: "61. Contacto",
    blocks: [
      {
        type: "p",
        text: "Para consultas, solicitudes relacionadas con la cuenta, ejercicio de derechos, reclamos o cualquier otra comunicación relacionada con Nocta, el Usuario podrá comunicarse a:",
      },
      {
        type: "p",
        html: true,
        text: "<strong>Joaquín Alejandro Pérez Coria</strong><br />Correo electrónico: <a href=\"mailto:joaquin.perez.coria@gmail.com\">joaquin.perez.coria@gmail.com</a><br /><a href=\"mailto:nocta.admin@gmail.com\">nocta.admin@gmail.com</a><br /><strong>Montevideo, Uruguay</strong>",
      },
    ],
  },
  {
    id: "aceptacion-final",
    title: "62. Aceptación",
    blocks: [
      {
        type: "p",
        text: "Al registrarse y utilizar Nocta, el Usuario declara que:",
      },
      {
        type: "ol",
        items: [
          "Tiene al menos 18 años.",
          "Ha leído estos Términos y Condiciones.",
          "Comprende su contenido.",
          "Acepta quedar obligado por ellos.",
          "Se compromete a utilizar Nocta de conformidad con estos Términos y con la legislación aplicable.",
        ],
      },
      {
        type: "p",
        text: "Si el Usuario no acepta estos Términos y Condiciones, deberá abstenerse de utilizar Nocta.",
      },
    ],
  },
];
