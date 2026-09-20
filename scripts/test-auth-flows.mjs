import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const origin = process.env.APP_ORIGIN || "https://studify.test";
const users = new Map();
let signupCalls = 0;
let clientIp = "test-ip";
const password = "Studify-Test-2026!";
const email = "auth-test@example.invalid";

function moduleAt(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    },
    Response,
    Request,
    URL,
    console,
    process,
  });
  return exports;
}

const policy = moduleAt("app/lib/password-policy.ts", {});
class RateLimitUnavailableError extends Error {}

const admin = {
  auth: {
    admin: {
      deleteUser: async (id) => {
        for (const [key, user] of users) if (user.id === id) users.delete(key);
        return { error: null };
      },
    },
  },
};

const publicClient = {
  auth: {
    signUp: async ({ email: nextEmail, password: nextPassword }) => {
      if (users.has(nextEmail)) {
        return {
          data: { user: { id: "obfuscated", identities: [] }, session: null },
          error: null,
        };
      }
      const user = {
        id: `user-${++signupCalls}`,
        email: nextEmail,
        password: nextPassword,
        identities: [{ id: `identity-${signupCalls}` }],
      };
      users.set(nextEmail, user);
      return { data: { user, session: null }, error: null };
    },
  },
};

const registration = moduleAt("app/api/auth/register/route.ts", {
  "@/app/lib/auth-admin": {
    authAdmin: () => admin,
    authPublic: () => publicClient,
  },
  "@/app/lib/password-policy": policy,
  "@/app/lib/rate-limit": {
    checkRateLimits: async () => ({ allowed: true }),
    clientIpKey: () => clientIp,
    RateLimitUnavailableError,
  },
  "@/app/lib/same-origin": {
    sameOrigin: (request) => request.headers.get("origin") === origin,
  },
});

function registerRequest(body, requestOrigin = origin) {
  return new Request(`${origin}/api/auth/register`, {
    method: "POST",
    headers: { origin: requestOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const unsafe = await registration.POST(registerRequest({ email, password }, "https://evil.example"));
assert.equal(unsafe.status, 403);

const weak = await registration.POST(registerRequest({ email, password: "1234" }));
assert.equal(weak.status, 400);

clientIp = null;
const missingIp = await registration.POST(registerRequest({ email, password }));
assert.equal(missingIp.status, 503);
assert.match((await missingIp.json()).error, /temporaneamente non disponibile/);
clientIp = "test-ip";

const created = await registration.POST(registerRequest({ email, password }));
assert.equal(created.status, 201);
assert.deepEqual(await created.json(), { created: true, confirmationRequired: true });
assert.equal(users.get(email)?.password, password);

const duplicate = await registration.POST(registerRequest({ email, password }));
assert.equal(duplicate.status, 409);
assert.match((await duplicate.json()).error, /già registrata/);

const loginSource = fs.readFileSync("app/login/page.tsx", "utf8");
assert.doesNotMatch(loginSource, /account-status|Account non trovato|Password non corretta/);
assert.match(loginSource, /Email o password errati/);
assert.match(loginSource, /Controlla la tua email e conferma/);

console.log("Auth flow checks passed: generic login errors, confirmation signup, duplicate 409, origin validation, missing client IP rejection.");
