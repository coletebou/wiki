// A small GitHub REST client for proposing edits, authenticated as the caller: GITHUB_TOKEN, GH_TOKEN or
// WIKI_GITHUB_TOKEN from the environment, else whatever `gh auth token` prints. The token is never logged or returned.
import { execFile } from 'node:child_process';

export class GitHubError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function ghAuthToken() {
  return new Promise((resolve) => {
    execFile('gh', ['auth', 'token'], { timeout: 10_000 }, (error, stdout) => resolve(error ? null : stdout.trim() || null));
  });
}

export async function resolveToken(env = process.env) {
  return env.GITHUB_TOKEN || env.GH_TOKEN || env.WIKI_GITHUB_TOKEN || (await ghAuthToken());
}

/** @param {{ token: string, fetchImpl?: typeof fetch, api?: string }} o */
export function createGitHub({ token, fetchImpl = fetch, api = 'https://api.github.com' }) {
  async function request(method, route, body) {
    const res = await fetchImpl(`${api}${route}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'coletebou-wiki-mcp',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { message: text.slice(0, 300) };
    }
    if (!res.ok) throw new GitHubError(res.status, `GitHub ${method} ${route.split('?')[0]}: ${res.status} ${json?.message ?? ''}`.trim(), json);
    return json;
  }
  return { request };
}
