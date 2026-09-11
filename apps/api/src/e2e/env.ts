/**
 * Debe importarse ANTES que config/createApp (dotenv no pisa vars ya set).
 */
process.env.NOCTA_E2E = "1";
process.env.MONGODB_URI = "memory";
process.env.STORAGE_DRIVER = "memory";
process.env.STORAGE_PUBLIC_BASE_URL = "https://cdn.e2e.test";
process.env.JWT_SECRET = "nocta-e2e-secret";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.API_PUBLIC_URL = "http://127.0.0.1:0";
process.env.SEED_ON_EMPTY = "false";
process.env.MAIL_DEV_LOG = "false";
process.env.MAIL_TRANSPORT = "smtp";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.RESEND_API_KEY = "";
/** Dimensiones acotadas para probar rechazo E2E sin generar 8k×8k. */
process.env.IMAGE_MAX_WIDTH_PX = "2000";
process.env.IMAGE_MAX_HEIGHT_PX = "2000";
