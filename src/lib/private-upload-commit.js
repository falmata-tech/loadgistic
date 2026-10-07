// Only an explicit PostgreSQL rejection proves that this transaction rolled back.
// Network errors, proxy failures and lost responses leave the commit uncertain.
const REJECTED_SQL_STATES = new Set(['P0001', '22023', '23502', '23503', '23505', '23514', '42501']);

export function uploadCommitWasRejected(error) {
  const databaseError = error?.cause || error;
  return REJECTED_SQL_STATES.has(databaseError?.code);
}

export async function commitPrivateUpload(upload, commit, remove) {
  try {
    return await commit();
  } catch (error) {
    if (upload?.path && uploadCommitWasRejected(error)) {
      await remove(upload.path).catch(() => undefined);
    }
    // Keep the private object on an uncertain outcome. Reconciliation must check
    // persisted references before removing it; never retry the write here.
    throw error;
  }
}
