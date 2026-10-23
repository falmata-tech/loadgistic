import {FeedbackText} from './localization';
export function Flash({ error, success }: { error?: string; success?: string }) {
  return (
    <>
      {error ? <div className="alert error" role="alert"><FeedbackText message={error} fallback="Could not complete this request. Please try again."/></div> : null}
      {success ? <div className="alert success" role="status"><FeedbackText message={success} fallback="Your request was completed."/></div> : null}
    </>
  );
}
