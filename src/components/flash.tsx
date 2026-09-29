import {Text} from './localization';
export function Flash({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error ? <div className="alert error" role="alert"><Text message={error}/></div> : null}
      {success ? <div className="alert success" role="status"><Text message={success}/></div> : null}
    </>
  );
}
