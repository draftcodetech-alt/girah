/**
 * Shared zod-issue → field-errors mapper for admin server actions.
 * Single home for the loop previously copy-pasted across the admin
 * product/variation/category modules.
 */
export function fieldErrorsFrom(issues: { path: readonly PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] = issue.message;
  return fieldErrors;
}
