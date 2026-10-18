export type HumanCheckRequest =
  | {
      kind: "login";
      email: string;
      password: string;
      next: string | null;
    }
  | {
      kind: "register";
      email: string;
      password: string;
      name: string;
      marketingEmailsOptIn: boolean;
    }
  | {
      kind: "forgot";
      email: string;
    };

export function isHumanCheckRequest(value: unknown): value is HumanCheckRequest {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "forgot") {
    return typeof (value as { email?: unknown }).email === "string";
  }
  if (kind === "login") {
    const row = value as { email?: unknown; password?: unknown };
    return typeof row.email === "string" && typeof row.password === "string";
  }
  if (kind === "register") {
    const row = value as {
      email?: unknown;
      password?: unknown;
      name?: unknown;
    };
    return (
      typeof row.email === "string" &&
      typeof row.password === "string" &&
      typeof row.name === "string"
    );
  }
  return false;
}
