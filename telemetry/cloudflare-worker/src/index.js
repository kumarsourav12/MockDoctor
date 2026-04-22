export const BLOB_FIELDS = [
  "tool",
  "source",
  "event",
  "repository",
  "ref",
  "runnerOs",
  "contractType",
  "actionRepository",
  "version",
  "driftDetected",
  "errorMessage"
];

export const DOUBLE_FIELDS = [
  "issuesCount",
  "servicesChecked",
  "operationsChecked",
  "responsesChecked",
  "timestampMs"
];

const MAX_ERROR_LENGTH = 256;

export async function handleTelemetryRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json(
      {
        ok: true,
        service: "mockdoctor-telemetry"
      },
      { status: 200 }
    );
  }

  if (request.method !== "POST" || url.pathname !== "/ingest") {
    return json(
      {
        error: "Not found"
      },
      { status: 404 }
    );
  }

  if (!isAuthorized(request, env)) {
    return json(
      {
        error: "Unauthorized"
      },
      { status: 401 }
    );
  }

  if (!env.MOCKDOCTOR_USAGE || typeof env.MOCKDOCTOR_USAGE.writeDataPoint !== "function") {
    return json(
      {
        error: "Missing MOCKDOCTOR_USAGE Analytics Engine binding"
      },
      { status: 500 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(
      {
        error: "Request body must be valid JSON"
      },
      { status: 400 }
    );
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return json(
      {
        error: validationError
      },
      { status: 400 }
    );
  }

  env.MOCKDOCTOR_USAGE.writeDataPoint(buildDataPoint(payload));

  return json(
    {
      ok: true
    },
    { status: 202 }
  );
}

export default {
  fetch: handleTelemetryRequest
};

function validatePayload(payload) {
  if (!isRecord(payload)) {
    return "Telemetry payload must be a JSON object";
  }

  if (payload.tool !== "mockdoctor") {
    return "Telemetry payload must include tool=mockdoctor";
  }

  if (payload.source !== "github-action") {
    return "Telemetry payload must include source=github-action";
  }

  if (typeof payload.event !== "string" || payload.event.length === 0) {
    return "Telemetry payload must include a non-empty event name";
  }

  if (typeof payload.timestamp !== "string" || Number.isNaN(Date.parse(payload.timestamp))) {
    return "Telemetry payload must include an ISO-8601 timestamp";
  }

  return undefined;
}

function buildDataPoint(payload) {
  const issueCount = toNumber(payload.issuesCount);
  const servicesChecked = toNumber(payload.servicesChecked);
  const operationsChecked = toNumber(payload.operationsChecked);
  const responsesChecked = toNumber(payload.responsesChecked);
  const timestampMs = Date.parse(payload.timestamp);

  return {
    blobs: [
      asString(payload.tool),
      asString(payload.source),
      asString(payload.event),
      asString(payload.repository),
      asString(payload.ref),
      asString(payload.runnerOs),
      asString(payload.contractType),
      asString(payload.actionRepository),
      asString(payload.version),
      booleanToString(payload.driftDetected),
      truncate(asString(payload.errorMessage), MAX_ERROR_LENGTH)
    ],
    doubles: [issueCount, servicesChecked, operationsChecked, responsesChecked, timestampMs],
    indexes: [buildIndex(payload)]
  };
}

function buildIndex(payload) {
  const repository = asString(payload.repository) || "unknown-repository";
  const runId = asString(payload.runId);
  return runId ? `${repository}#${runId}` : repository;
}

function isAuthorized(request, env) {
  const expectedToken = env.MOCKDOCTOR_INGEST_TOKEN;
  if (!expectedToken) {
    return true;
  }

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice("Bearer ".length);
  return token === expectedToken;
}

function asString(value) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanToString(value) {
  return value === true ? "true" : value === false ? "false" : "";
}

function truncate(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(body, init) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}
