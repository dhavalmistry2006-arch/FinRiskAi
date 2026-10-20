const secured = { security: [{ session: [] }] };
const response = (description = "Success") => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});
const operation = (summary: string, body?: object) => ({
  ...secured,
  summary,
  ...(body
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: body } },
        },
      }
    : {}),
  responses: {
    200: response(),
    401: response("Authentication required"),
    403: response("Role denied"),
    422: response("Validation failed"),
    503: response("Dependency unavailable"),
  },
});
const object = { type: "object", additionalProperties: true };
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "FinRisk AI 2.0 API",
    version: "2.0.0",
    description:
      "Educational credit-risk decision support. Synthetic inputs and outputs are not validated real lending probabilities.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "finrisk_session" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              requestId: { type: "string" },
            },
          },
        },
      },
      Application: {
        type: "object",
        properties: {
          id: { type: "string" },
          applicantId: { type: "string" },
          applicantName: { type: "string" },
          monthlyIncome: { type: "number", exclusiveMinimum: 0 },
          monthlyExpenses: { type: "number", minimum: 0 },
          existingDebt: { type: "number", minimum: 0 },
          existingEmi: { type: "number", minimum: 0 },
          creditScore: { type: "integer", minimum: 300, maximum: 900 },
          loanAmount: { type: "number", exclusiveMinimum: 0 },
          tenureMonths: { type: "integer", minimum: 1, maximum: 480 },
          interestRate: { type: "number", minimum: 0, maximum: 60 },
          employmentMonths: { type: "integer", minimum: 0 },
          employmentType: { type: "string" },
          loanPurpose: { type: "string" },
          currency: { type: "string", enum: ["INR"] },
          status: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/auth/login": {
      post: {
        ...operation("Create session", {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
        }),
        security: [],
      },
    },
    "/auth/logout": { post: operation("Invalidate session") },
    "/auth/me": { get: operation("Current user") },
    "/applications": {
      get: operation("Paginated filtered applications"),
      post: operation("Create draft", {
        $ref: "#/components/schemas/Application",
      }),
    },
    "/applications/{id}": {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get: operation("Application and historical assessments"),
      patch: operation(
        "Update draft or reset assessed application to draft",
        object,
      ),
      delete: operation("Delete draft"),
    },
    "/applications/{id}/submit": {
      post: operation("Validate and submit application"),
    },
    "/applications/{id}/assess": {
      post: operation("Run real model inference and persist assessment"),
    },
    "/applications/{id}/decision": {
      post: operation("Record human reviewer decision", object),
    },
    "/applications/{id}/withdraw": { post: operation("Withdraw application") },
    "/analytics": {
      get: operation("Compute actual stored portfolio aggregates"),
    },
    "/model": { get: operation("Model metadata, evaluation and limitations") },
    "/predictions": {
      post: operation("Preview model assessment", {
        $ref: "#/components/schemas/Application",
      }),
    },
    "/explanations": {
      post: operation("Explain model output", {
        $ref: "#/components/schemas/Application",
      }),
    },
    "/scenarios": {
      get: operation("List persisted scenarios"),
      post: operation("Assess and save hypothetical scenario", object),
    },
    "/batches": {
      get: operation("List jobs"),
      post: {
        ...operation("Upload CSV/XLSX, maximum 500 rows / 5 MB"),
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                  mapping: {
                    type: "string",
                    description:
                      "JSON destination-field to source-column mapping",
                  },
                },
              },
            },
          },
        },
      },
    },
    "/batches/{id}": { get: operation("Poll persisted job progress") },
    "/alerts": { get: operation("List rules-based alerts") },
    "/alerts/{id}/acknowledge": { post: operation("Acknowledge alert") },
    "/alerts/{id}/resolve": { post: operation("Resolve alert") },
    "/reports/{type}": {
      get: operation("Export real data as PDF, CSV or XLSX"),
    },
    "/audit": { get: operation("Paginated append-only API audit events") },
    "/users": {
      get: operation("Administrator: list users"),
      post: operation("Administrator: create user", object),
    },
    "/users/{id}": {
      patch: operation("Administrator: update role or active status", object),
    },
    "/settings": {
      get: operation("Current versioned demonstration risk policy"),
      patch: operation(
        "Administrator: update thresholds, LGD and alert policy",
        object,
      ),
    },
    "/copilot": {
      post: operation(
        "Deterministic grounded summary; no external LLM",
        object,
      ),
    },
  },
};

for (const [path, item] of Object.entries(openapi.paths)) {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  if (parameters.length) (item as any).parameters = parameters;
}

(openapi.paths as any)["/monitoring"] = {
  get: operation(
    "Descriptive input and prediction PSI against synthetic training reference",
  ),
};

const paths = openapi.paths as Record<string, any>;
paths["/auth/password"] = {
  post: operation("Change password and revoke sessions", {
    type: "object",
    required: ["currentPassword", "password"],
    properties: {
      currentPassword: { type: "string", format: "password" },
      password: {
        type: "string",
        minLength: 12,
        maxLength: 128,
        format: "password",
      },
    },
  }),
};
paths["/assessments"] = {
  get: operation("List stored historical assessments"),
};
paths["/portfolios"] = {
  get: operation("Currency-separated stored portfolio analytics"),
};
paths["/scenarios/{id}"] = {
  parameters: [
    { name: "id", in: "path", required: true, schema: { type: "string" } },
  ],
  delete: operation("Delete a saved hypothetical scenario"),
};
paths["/batches/preview"] = {
  post: {
    ...operation(
      "Safely parse CSV/XLSX and preview headers, first five rows and validation errors",
    ),
    requestBody: paths["/batches"].post.requestBody,
  },
};
paths["/batches/{id}/download"] = {
  parameters: [
    { name: "id", in: "path", required: true, schema: { type: "string" } },
  ],
  get: operation("Download successful batch assessments as CSV"),
};
for (const path of [
  "/applications",
  "/scenarios",
  "/users",
  "/applications/{id}/assess",
]) {
  const post = paths[path]?.post;
  if (post) {
    post.responses["201"] = response("Created");
    delete post.responses["200"];
  }
}
paths["/batches"].post.responses["202"] = response(
  "Queued; poll the job identifier",
);
delete paths["/batches"].post.responses["200"];
paths["/reports/{type}"].get.parameters = [
  {
    name: "format",
    in: "query",
    schema: { type: "string", enum: ["pdf", "csv", "xlsx"], default: "pdf" },
  },
  {
    name: "id",
    in: "query",
    schema: { type: "string" },
    description:
      "Application, scenario or batch identifier for individual reports",
  },
];
paths["/reports/{type}"].get.responses["200"] = {
  description: "Data-backed report download",
  content: {
    "application/pdf": { schema: { type: "string", format: "binary" } },
    "text/csv": { schema: { type: "string" } },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      schema: { type: "string", format: "binary" },
    },
  },
};
