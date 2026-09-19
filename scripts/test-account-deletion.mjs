import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Purely mocked tests: no requests or account changes are made to Supabase.
const source = fs.readFileSync(new URL('../app/api/account/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let calls, config;
const exports = {};
vm.runInNewContext(compiled, {
  exports, Response, Date, process: { env: { SUPABASE_SECRET_KEY: 'mock-secret' } },
  require: () => ({ sendAccountMail: async () => 'not_configured', createClient: () => ({ auth: {
    getUser: async () => { calls.push('verify'); return config.user || { data: { user: { id: 'signed-in-user', last_sign_in_at: new Date().toISOString() } }, error: null }; },
    admin: {
      signOut: async () => { calls.push('revoke'); return { error: config.logoutError || null }; },
      deleteUser: async (id) => { calls.push(`delete:${id}`); return { error: config.deleteError || null }; },
    },
  } }) }),
});
function request({ origin = 'https://studify.pmxno9868721081uuj91.chatgpt.site', token = 'mock-token', confirmation = 'ELIMINA' } = {}) {
  return new Request('https://studify.pmxno9868721081uuj91.chatgpt.site/api/account', { method: 'DELETE',
    headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ confirmation, userId: 'someone-else' }) });
}
async function test(options, setup, status, expected) {
  calls = []; config = setup;
  const response = await exports.DELETE(request(options));
  assert.equal(response.status, status);
  assert.deepEqual(calls, expected);
}
await test({ origin: 'https://untrusted.example' }, {}, 403, []);
await test({ token: '' }, {}, 401, []);
await test({ confirmation: 'yes' }, {}, 400, []);
await test({}, { user: { data: { user: null }, error: {} } }, 401, ['verify']);
await test({}, { user: { data: { user: { id: 'signed-in-user', last_sign_in_at: '2020-01-01T00:00:00Z' } } } }, 200, ['verify', 'revoke', 'delete:signed-in-user']);
await test({}, { logoutError: {} }, 502, ['verify', 'revoke']);
await test({}, { deleteError: {} }, 502, ['verify', 'revoke', 'delete:signed-in-user']);
await test({}, {}, 200, ['verify', 'revoke', 'delete:signed-in-user']);
console.log('8 account deletion checks passed (mocked; no real accounts deleted).');
