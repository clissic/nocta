export class StorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "StorageError";
    this.code = code;
  }
}

export class StorageNotConfiguredError extends StorageError {
  constructor(message = "Object storage no configurado") {
    super("STORAGE_NOT_CONFIGURED", message);
    this.name = "StorageNotConfiguredError";
  }
}

export class StorageObjectNotFoundError extends StorageError {
  constructor(key: string) {
    super("STORAGE_OBJECT_NOT_FOUND", `Objeto no encontrado: ${key}`);
    this.name = "StorageObjectNotFoundError";
  }
}
