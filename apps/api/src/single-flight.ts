export function createSingleFlight<T>() {
  const inFlight = new Map<string, Promise<T>>();

  return (key: string, factory: () => Promise<T>): Promise<T> => {
    const current = inFlight.get(key);
    if (current) return current;

    const promise = Promise.resolve().then(factory);
    inFlight.set(key, promise);
    const clear = () => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    };
    void promise.then(clear, clear);
    return promise;
  };
}
