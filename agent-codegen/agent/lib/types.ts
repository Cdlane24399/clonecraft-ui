// Local copies of the two plain shapes the codegen loop exchanges. Kept here
// (rather than imported from the main app) so this package stays a standalone
// service with its own dependency tree. They mirror the app's
// `server/db/schema.ts` GeneratedFile / BuildReport — keep them in sync.

export type GeneratedFile = {
  /** Project-relative path, e.g. "src/App.tsx". */
  path: string;
  content: string;
};

export type BuildReport = {
  /** Whether a build was attempted at all (false when E2B is unset). */
  ran: boolean;
  passed: boolean;
  /** esbuild output / error text, or a status line. */
  output: string;
};
