import { resolveVariables, type ResolveContext } from './variableResolver.ts';
import type { ParsedRequest } from '../types.ts';

export interface ResolvedRequest {
  resolved: ParsedRequest;
  unresolved: string[];
}

export function resolveRequest(req: ParsedRequest, ctx: ResolveContext): ResolvedRequest {
  const all: string[] = [];
  const urlR = resolveVariables(req.url, ctx);
  const headersR: Array<[string, string]> = req.headers.map(([n, v]) => {
    const nr = resolveVariables(n, ctx);
    const vr = resolveVariables(v, ctx);
    all.push(...nr.unresolved, ...vr.unresolved);
    return [nr.text, vr.text];
  });
  const bodyR = req.body !== undefined ? resolveVariables(req.body, ctx) : undefined;

  all.push(...urlR.unresolved);
  if (bodyR) all.push(...bodyR.unresolved);

  return {
    resolved: {
      ...req,
      url: urlR.text,
      headers: headersR,
      body: bodyR?.text
    },
    unresolved: [...new Set(all)]
  };
}
