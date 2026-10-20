# Security and privacy

Use synthetic identities and financial records. This application is an educational research demonstrator, not a certified lending system. Do not upload real customer information to a public demonstration deployment.

- `.env` and nested environment files are ignored; templates contain placeholders only. The original historical `.env` contained a localhost URL, with no credential detected. Historical commits are not erased by the index cleanup. Rotate any actual exposed credential found during future review.
- Passwords are hashed on the server. Authentication cookies are HTTP-only. Role checks apply at the API, not only navigation. Use a long random JWT signing key and a private demo password. Never use CI-only credentials outside tests.
- Development is intentionally HTTP on loopback. Production must terminate TLS, set secure cookies, configure an exact allowed origin, and isolate Express/ML/Mongo behind the frontend or gateway. `COOKIE_SECURE=false` is only for local HTTP demonstration.
- MongoDB is not published by Compose. The compose-internal unauthenticated Mongo instance is for an isolated local demonstration network. Production requires database authentication, access control, encrypted transport, backups and restore tests.
- Uploads are size-limited, validated and parsed on the server. CSV export must protect spreadsheet formula cells. XLSX uses ExcelJS rather than the unmaintained npm `xlsx` package. Do not treat spreadsheet parsing as a safe path for arbitrary untrusted bulk data on an Internet-exposed service.
- Exports may include demonstration identifiers and financial details; restrict them through API roles and avoid public sharing.
- Structured logs should include request IDs and status, not passwords, JWTs or raw request bodies. Do not enable shell tracing around environment configuration.
- Demo records persist until explicitly removed or the Mongo volume is deleted. Deleting an application may retain audit evidence and previously exported files; inspect the API policy before using any real data. Browser downloads remain outside server retention control. No automatic regulatory retention claim is made.
- This implementation does not provide MFA, enterprise SSO, immutable compliance storage, multi-tenancy guarantees, key rotation automation or independently validated fairness/credit models. Perform an external security review before public deployment.

Report vulnerabilities privately to the repository maintainer. Do not include secrets or real borrower records in issues. Run the documented dependency audit; a runnable build is not proof of vulnerability absence.
