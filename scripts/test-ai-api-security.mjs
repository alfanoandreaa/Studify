import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const configuredOrigin = process.env.APP_ORIGIN;
assert.ok(configuredOrigin, "APP_ORIGIN must be set for this test.");
const origin = new URL(configuredOrigin).origin;
const testProcess = {
  env: {
    ...process.env,
    APP_ORIGIN: configuredOrigin,
    GEMINI_API_KEY: "mock-gemini-key",
  },
};
const safeMath = Object.create(Math);
safeMath.random = () => 1;
const quietConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn() {},
};

function moduleAt(path, dependencies, extra = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Response,
    Request,
    URL,
    TextDecoder,
    Uint8Array,
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    console: quietConsole,
    process: testProcess,
    Math: safeMath,
    require(name) {
      if (!Object.prototype.hasOwnProperty.call(dependencies, name)) {
        throw Error("Unexpected dependency " + name);
      }
      return dependencies[name];
    },
    ...extra,
  });
  return exports;
}

let d1Failure = false;
let blockedPrefix = "";
let d1SelectedKeys = [];

const fakeDb = {
  prepare(sql) {
    return {
      sql,
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async run() {
        return { success: true };
      },
    };
  },
  async batch(statements) {
    if (d1Failure) throw Error("D1_INTERNAL_SHOULD_NOT_LEAK");
    return statements.map((statement) => {
      if (/SELECT count FROM rate_limits/.test(statement.sql)) {
        const key = String(statement.args[0]);
        d1SelectedKeys.push(key);
        const blocked = blockedPrefix && key.startsWith(blockedPrefix);
        return { results: [{ count: blocked ? 999 : 1 }] };
      }
      return { results: [] };
    });
  },
};

const rateLimit = moduleAt("app/lib/rate-limit.ts", {
  "cloudflare:workers": {
    env: { DB: fakeDb },
    waitUntil() {},
  },
});
const sameOrigin = moduleAt("app/lib/same-origin.ts", {});

let authFailure = false;
let authTokens = [];
const usersByToken = new Map([
  ["valid-token", "user-123"],
  ["second-token", "user-456"],
]);
const admin = {
  auth: {
    async getUser(token) {
      authTokens.push(token);
      if (authFailure) throw Error("SUPABASE_INTERNAL_SHOULD_NOT_LEAK");
      const id = usersByToken.get(token);
      return id
        ? { data: { user: { id } }, error: null }
        : { data: { user: null }, error: { code: "invalid_token" } };
    },
  },
};

let aiFailure = false;
let aiCalls = 0;
const modelOutput = JSON.stringify({
  title: "Test",
  subject: "Test",
  noteSections: [{ title: "Sezione", blocks: [{ kind: "point", content: "Contenuto" }] }],
  summary: "Riassunto",
  keyConcepts: [],
  flashcards: [],
  recommendedQuizCount: "5",
});

async function mockFetch() {
  aiCalls += 1;
  if (aiFailure) throw Error("fetch UPSTREAM_INTERNAL_SHOULD_NOT_LEAK");
  return Response.json({
    candidates: [{ content: { parts: [{ text: modelOutput }] } }],
  });
}

const route = moduleAt(
  "app/api/gemini/route.ts",
  {
    "next/server": {
      NextResponse: {
        json(body, init) {
          return Response.json(body, init);
        },
      },
    },
    "@/app/lib/auth-admin": { authAdmin: () => admin },
    "@/app/lib/rate-limit": rateLimit,
    "@/app/lib/same-origin": sameOrigin,
  },
  { fetch: mockFetch },
);

function request(body, {
  token = "valid-token",
  requestOrigin = origin,
  extraHeaders = {},
} = {}) {
  const headers = {
    origin: requestOrigin,
    "content-type": "application/json",
    ...extraHeaders,
  };
  if (token !== null) headers.authorization = "Bearer " + token;

  return new Request(origin + "/api/gemini", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function reset() {
  authFailure = false;
  authTokens = [];
  d1Failure = false;
  blockedPrefix = "";
  d1SelectedKeys = [];
  aiFailure = false;
  aiCalls = 0;
}

async function expectError(response, status, markerToHide = "") {
  assert.equal(response.status, status);
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ["error"]);
  assert.equal(typeof payload.error, "string");
  if (markerToHide) assert.doesNotMatch(payload.error, new RegExp(markerToHide));
  return payload.error;
}

const validInput = { mode: "analyze", text: "Appunti sulle leggi di Ohm." };

reset();
await expectError(
  await route.POST(request(validInput, { requestOrigin: "https://evil.invalid" })),
  403,
);
assert.deepEqual(authTokens, []);
assert.deepEqual(d1SelectedKeys, []);
assert.equal(aiCalls, 0);

reset();
await expectError(await route.POST(request(validInput, { token: null })), 401);
assert.deepEqual(authTokens, []);
assert.deepEqual(d1SelectedKeys, []);
assert.equal(aiCalls, 0);

reset();
await expectError(await route.POST(request(validInput, { token: "invalid-token" })), 401);
assert.deepEqual(authTokens, ["invalid-token"]);
assert.deepEqual(d1SelectedKeys, []);
assert.equal(aiCalls, 0);

reset();
authFailure = true;
await expectError(
  await route.POST(request(validInput)),
  503,
  "SUPABASE_INTERNAL_SHOULD_NOT_LEAK",
);
assert.equal(aiCalls, 0);

reset();
d1Failure = true;
await expectError(
  await route.POST(request(validInput)),
  503,
  "D1_INTERNAL_SHOULD_NOT_LEAK",
);
assert.equal(aiCalls, 0);

reset();
blockedPrefix = "gemini-minute:";
const limited = await route.POST(request(validInput));
await expectError(limited, 429);
assert.match(limited.headers.get("retry-after") || "", /^\d+$/);
assert.deepEqual(d1SelectedKeys, [
  "gemini-minute:user-123",
  "gemini-day:user-123",
]);
assert.equal(aiCalls, 0);

reset();
await expectError(
  await route.POST(request({ mode: "analyze", text: "x", unexpected: true }, { token: "second-token" })),
  400,
);
assert.deepEqual(d1SelectedKeys, [
  "gemini-minute:user-456",
  "gemini-day:user-456",
]);
assert.equal(aiCalls, 0);

reset();
await expectError(
  await route.POST(request({ mode: "analyze", file: { mimeType: "application/zip", data: "AAAA" } })),
  400,
);
assert.equal(aiCalls, 0);

reset();
await expectError(
  await route.POST(request({ mode: "analyze", file: { mimeType: "application/pdf", data: "not-base64" } })),
  400,
);
assert.equal(aiCalls, 0);

reset();
const oversizedFileData = "AAAA".repeat(Math.floor((8 * 1024 * 1024) / 3) + 1);
await expectError(
  await route.POST(request({ mode: "analyze", file: { mimeType: "application/pdf", data: oversizedFileData } })),
  413,
);
assert.equal(aiCalls, 0);

reset();
await expectError(
  await route.POST(request(validInput, {
    extraHeaders: { "content-length": String(12 * 1024 * 1024 + 1) },
  })),
  413,
);
assert.equal(aiCalls, 0);

reset();
await expectError(
  await route.POST(request({ mode: "quiz", context: "abc", quizCount: 7 })),
  400,
);
assert.equal(aiCalls, 0);

reset();
aiFailure = true;
await expectError(
  await route.POST(request(validInput)),
  503,
  "UPSTREAM_INTERNAL_SHOULD_NOT_LEAK",
);
assert.equal(aiCalls, 3);

reset();
const success = await route.POST(request(validInput));
assert.equal(success.status, 200);
const successPayload = await success.json();
assert.equal(successPayload.title, "Test");
assert.match(successPayload.correctedNotes, /Contenuto/);
assert.equal(aiCalls, 1);
assert.deepEqual(d1SelectedKeys, [
  "gemini-minute:user-123",
  "gemini-day:user-123",
]);

console.log(
  "AI API security checks passed: APP_ORIGIN, Bearer auth, per-user D1 rate limits, body/file validation, size limits, generic errors, and mocked AI network only.",
);
