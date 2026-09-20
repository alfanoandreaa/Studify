import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Mock the Auth provider and AI service. No real credentials or API calls.
const origin = 'https://studify.pmxno9868721081uuj91.chatgpt.site';
let aiCalls = 0;
const exports = {};
const code = ts.transpileModule(fs.readFileSync('app/api/gemini/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, {
  exports, Response, Request, TextDecoder, AbortSignal, Date, Map, Number, JSON, Object, atob, console,
  process: { env: { GEMINI_API_KEY: 'mock-key' } },
  require(name) {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'test-user' } : null }, error: null }) } }) };
    if (name === '@/app/lib/site-config') return { SUPABASE_URL: 'https://example.invalid', sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin };
    throw Error(`Unexpected import ${name}`);
  },
  fetch: async () => { aiCalls++; throw Error('AI must not be contacted'); },
});
function request(body, { token = 'valid', requestOrigin = origin } = {}) {
  return new Request(origin + '/api/gemini', { method: 'POST', headers: { origin: requestOrigin, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const validInput = { mode: 'analyze', text: 'Appunti sulle leggi di Ohm.' };
assert.equal((await exports.POST(request(validInput, { token: 'wrong' }))).status, 401);
assert.equal((await exports.POST(request(validInput, { requestOrigin: 'https://evil.invalid' }))).status, 400);
assert.equal((await exports.POST(request({ ...validInput, file: { mimeType: 'application/pdf', data: btoa('not a pdf') } }))).status, 400);
assert.equal((await exports.POST(request({ ...validInput, text: 'x'.repeat(150001) }))).status, 400);
assert.equal((await exports.POST(request('x'.repeat(12 * 1024 * 1024 + 1)))).status, 413);
assert.equal(aiCalls, 0);
console.log('AI API rejects unauthenticated, cross-origin, malformed, oversized and unsupported input.');
