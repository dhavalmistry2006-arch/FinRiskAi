# Service contracts

The browser calls `/api/v1` through the Vite (development) or nginx (container) same-origin proxy. Express is the authorization and persistence boundary. Python inference is internal and receives financial model inputs only, without applicant names or authentication credentials.

Credit scores are optional Indian-style demonstration scores in the **300–900** range. Money defaults to INR. Monthly fields and annual nominal interest percentages are explicit. A model estimate and a human review decision are separate records.

The running backend publishes its OpenAPI document through `/api/v1/docs`; ML publishes `/openapi.json`. Financial inputs use camelCase: `monthlyIncome`, `monthlyExpenses`, `existingDebt`, `existingEmi`, `creditScore`, `loanAmount`, `tenureMonths`, `interestRate`, `employmentMonths`, `employmentType`, `loanPurpose`.

Research bands: Low < 0.15, Moderate < 0.35, Elevated < 0.60, High otherwise. These demonstration thresholds are not regulatory standards. All application predictions originate in FastAPI; unavailable inference must return an error.
