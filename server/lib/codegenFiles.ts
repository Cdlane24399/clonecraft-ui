import type { GeneratedFile } from "../db/schema";

/**
 * Parse ```lang file=path fenced blocks out of a model's codegen output into
 * `{ path, content }` files. Shared by the generate, build-fix, and fidelity-fix
 * paths so they all agree on the wire format the prompts ask for.
 */
export function parseGeneratedFiles(markdown: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const re = /```[a-zA-Z0-9]*\s+file=([^\s`]+)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    files.push({ path: m[1].trim(), content: m[2].replace(/\s+$/, "") + "\n" });
  }
  return files;
}
