export function createLogger(service) {
    return {
        info(message, meta) {
            console.log(JSON.stringify({ level: "info", service, message, meta }));
        },
        error(message, error) {
            const serializedError = error instanceof Error
                ? { name: error.name, message: error.message, stack: error.stack }
                : error;
            console.error(JSON.stringify({
                level: "error",
                service,
                message,
                error: serializedError,
            }));
        },
    };
}
