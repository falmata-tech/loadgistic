export function Flash({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {success ? <div className="alert success" role="status">{success}</div> : null}
    </>
  );
}
