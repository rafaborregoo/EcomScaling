export function createLogger(service: string) {
  return {
    info(message: string, meta?: unknown) {
      console.log(JSON.stringify({ level: "info", service, message, meta }));
    },
    error(message: string, error?: unknown) {
      const serializedError =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error;

      console.error(
        JSON.stringify({
          level: "error",
          service,
          message,
          error: serializedError,
        }),
      );
    },
  };
}
