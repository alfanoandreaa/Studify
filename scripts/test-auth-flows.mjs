import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Real page handlers and API routes with in-memory Auth; no production accounts.
const origin = 'https://studify.pmxno9868721081uuj91.chatgpt.site';
const users = new Map();
let session = null, redirect = '', signupCalls = 0, fakeDuplicate = false;
const password = 'Studify-Test-2026!';
const email = 'auth-test@example.invalid';
const auth = {
  getSession: async () => ({ data: { session } }),
  signInWithPassword: async ({ email, password }) => users.get(email)?.password === password
    ? { data: { session: session = { user: users.get(email) } } }
    : { error: Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' }) },
  signOut: async () => { session = null; return {}; },
};
const admin = { auth: {
  getUser: async () => ({ data: { user: session?.user ?? null } }),
  admin: {
    listUsers: async () => ({ data: { users: [...users.values()] } }),
    createUser: async ({ email, password, email_confirm }) => {
      assert.equal(email_confirm, true);
      if (users.has(email) || fakeDuplicate) return { error: { code: 'email_exists', message: 'already registered' } };
      const user = { id: `user-${++signupCalls}`, email, password };
      users.set(email, user); return { data: { user }, error: null };
    },
    signOut: async () => ({}),
    deleteUser: async (id, soft) => { assert.equal(soft, false); for (const [email, user] of users) if (user.id === id) users.delete(email); return {}; },
  },
} };
function moduleAt(path, dependencies, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, Response, Request, Date, URLSearchParams, console, ...extra });
  return exports;
}
const policy = moduleAt('app/lib/password-policy.ts', {});
const statusRoute = moduleAt('app/api/auth/account-status/route.ts', {
  '@/app/lib/auth-admin': { authAdmin: () => admin, sameOrigin: r => r.headers.get('origin') === origin },
});
const registration = moduleAt('app/api/auth/register/route.ts', {
  '@/app/lib/auth-admin': { authAdmin: () => admin, sameOrigin: r => r.headers.get('origin') === origin },
  '@/app/lib/password-policy': policy,
});
const deletion = moduleAt('app/api/account/route.ts', {
  '@supabase/supabase-js': { createClient: () => admin },
}, { process: { env: { SUPABASE_SECRET_KEY: 'mock' } } });
function page(path, search = '') {
  const slots = []; let cursor = 0, tree, effects = [], initial = true;
  const react = {
    useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = value; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect: effect => { if (initial) effects.push(effect); },
  };
  const component = moduleAt(path, {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
    'lucide-react': {}, 'next/navigation': { useRouter: () => ({ replace: value => { redirect = value; } }) },
    '@/app/lib/supabase': { supabase: { auth } }, '@/app/lib/password-policy': policy,
    '@/app/components/theme-toggle': { ThemeToggle: () => null },
  }, {
    window: { location: { origin, search, replace: value => { redirect = value; } }, setTimeout: () => 0, clearTimeout: () => {} },
    fetch: async (path, init) => {
      const request = new Request(origin + path, { ...init, headers: { ...init.headers, origin } });
      if (path === '/api/auth/account-status') return statusRoute.POST(request);
      if (path === '/api/auth/register') return registration.POST(request);
      throw Error(`Unexpected request ${path}`);
    },
  }).default;
  function render() { cursor = 0; tree = component(); initial = false; return tree; }
  function nodes(node = tree) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n ?? null)); return [node, ...nodes(node.props?.children ?? null)]; }
  function text(node) { if (node == null || node === false) return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(text).join(''); return text(node.props?.children); }
  render();
  return {
    render, text: () => text(tree), effects: async () => { for (const effect of effects) effect(); await settle(); render(); },
    input: (index, value) => { nodes().filter(n => n.type === 'input')[index].props.onChange({ target: { value } }); render(); },
    button: label => { const found = nodes().find(n => n.type === 'button' && text(n) === label); assert.ok(found, `Missing ${label}`); return found; },
    submit: async () => { await nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await settle(); render(); },
  };
}
async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
const login = page('app/login/page.tsx');
assert.doesNotMatch(login.text(), /Google|Continua con|Password dimenticata|Reinvia email/);
login.input(0, email); login.input(1, password); await login.submit();
assert.match(login.text(), /Account non trovato/);
login.button('Registrati').props.onClick(); login.render();
login.input(2, password); assert.equal(login.button('Registrati').props.disabled, false); await login.submit();
assert.equal(users.get(email).password, password); assert.equal(redirect, '/');
console.log('PASS nonexistent login, preserved credentials, registration without email');
const duplicate = page('app/login/page.tsx'); duplicate.button('Registrati').props.onClick(); duplicate.render();
duplicate.input(0, email); duplicate.input(1, password); duplicate.input(2, password); await duplicate.submit();
assert.match(duplicate.text(), /Questa email è già registrata/); assert.equal(signupCalls, 1);
duplicate.input(0, 'race@example.invalid'); fakeDuplicate = true; await duplicate.submit(); fakeDuplicate = false;
assert.match(duplicate.text(), /Questa email è già registrata/);
console.log('PASS existing email and duplicate race');
duplicate.button('Accedi').props.onClick(); duplicate.render();
duplicate.input(0, email); duplicate.input(1, 'wrong-password'); await duplicate.submit();
assert.match(duplicate.text(), /Password non corretta/);
console.log('PASS email-only UI and wrong password');
const unsafe = await registration.POST(new Request(origin + '/api/auth/register', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'unsafe@example.invalid', password }) }));
assert.equal(unsafe.status, 403); assert.equal(users.has('unsafe@example.invalid'), false);
const weak = await registration.POST(new Request(origin + '/api/auth/register', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'weak@example.invalid', password: '1234' }) }));
assert.equal(weak.status, 400); assert.equal(users.has('weak@example.invalid'), false);
console.log('PASS registration origin and password checks');
session = { user: users.get(email) };
const response = await deletion.DELETE(new Request(origin + '/api/account', { method: 'DELETE', headers: { origin, authorization: 'Bearer mock', 'content-type': 'application/json' }, body: JSON.stringify({ confirmation: 'ELIMINA' }) }));
assert.equal(response.status, 200); assert.equal(users.has(email), false); assert.deepEqual(await response.json(), { deleted: true });
session = null;
const again = page('app/login/page.tsx'); again.button('Registrati').props.onClick(); again.render();
again.input(0, email); again.input(1, password); again.input(2, password); assert.equal(again.button('Registrati').props.disabled, false); await again.submit();
assert.equal(users.has(email), true); assert.equal(redirect, '/');
console.log('PASS deletion and re-registration with same email, no farewell');
console.log('No email-sending functions are called in the tested flows.');
