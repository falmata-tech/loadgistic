export type ServiceNotice = { title: string; body: string };
export interface LocationServicePort {
  available(): Promise<boolean>;
  registered(): Promise<boolean>;
  start(notice: ServiceNotice): Promise<void>;
  stop(): Promise<void>;
}

// Registration survives a process restart; confirmed service startup does not.
export function createLocationServiceLifecycle(port: LocationServicePort) {
  let initialized = false, generation = 0;
  let pending: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = pending.then(work, work);
    pending = next.catch(() => undefined);
    return next;
  };
  return {
    ensure(notice: ServiceNotice): Promise<void> {
      const version = generation;
      return serial(async () => {
        if (version !== generation) return;
        if (!await port.available()) throw Error('Background location is unavailable in this app build.');
        if (version !== generation) return;
        const registered = await port.registered();
        if (version !== generation) return;
        if (!initialized || !registered) {
          await port.start(notice);
        }
        if (version === generation) initialized = true;
      });
    },
    stop(): Promise<void> {
      generation++;
      initialized = false;
      return serial(async () => {
        try { if (await port.registered()) await port.stop(); }
        finally { initialized = false; }
      });
    },
  };
}
