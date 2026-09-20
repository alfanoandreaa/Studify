import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const origin = process.env.APP_ORIGIN || "https://studify.test";
const source = fs.readFileSync(new URL("../app/api/account/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

let calls;
let config;
const exports = {};

const admin = {
  auth: {
    getUser: async () => {
      calls.push("verify");
      return config.user || {
        data: { user: { id: "signed-in-user", last_sign_in_at: new Date().toISOString() } },
        error: null,
      };
    },
    admin: {
      signOut: async () => {
        calls.push("revoke");
        return { error: config.logoutError || null };
      },
      deleteUser: async (id) => {
        calls.push(`delete:${id}`);
        return { error: config.deleteError || null };
      },
    },
  },
};

vm.runInNewContext(compiled, {
  exports,
  Response,
  Request,
  console,
  require: (name) => {
    if (name === "@/app/lib/auth-admin") return { authAdmin: () => admin };
    if (name === "@/app/lib/same-origin") {
      return { sameOrigin: (request) => request.headers.get("origin") === origin };
    }
    throw Error(`Unexpected dependency ${name}`);
  },
});

function request({ requestOrigin = origin, token = "mock-token", confirmation = "ELIMINA" } = {}) {
  return new Request(`${origin}/api/account`, {
    method: "DELETE",
    headers: {
      origin: requestOrigin,
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ confirmation, userId: "someone-else" }),
  });
}

async function test(options, setup, status, expected) {
  calls = [];
  config = setup;
  const response = await exports.DELETE(request(options));
  assert.equal(response.status, status);
  assert.deepEqual(calls, expected);
}

await test({ requestOrigin: "https://untrusted.example" }, {}, 403, []);
await test({ token: "" }, {}, 401, []);
await test({ confirmation: "yes" }, {}, 400, []);
await test({}, { user: { data: { user: null }, error: {} } }, 401, ["verify"]);
await test({}, { logoutError: {} }, 502, ["verify", "revoke"]);
await test({}, { deleteError: {} }, 502, ["verify", "revoke", "delete:signed-in-user"]);
await test({}, {}, 200, ["verify", "revoke", "delete:signed-in-user"]);

console.log("Account deletion checks passed (mocked; no real accounts deleted).");
