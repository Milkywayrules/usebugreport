# Security Checklist

- **Injection**: user input reaching SQL/shell/eval/HTML without parameterization or escaping (XSS, SQLi, command injection)
- **Secrets**: hardcoded API keys, tokens, passwords; secrets logged or sent to client bundles (especially `NEXT_PUBLIC_` / `VITE_` prefixes)
- **AuthZ**: new endpoint/route missing the auth middleware its siblings have; object-level checks (can user A fetch user B's resource by ID?)
- **Path traversal**: user input in file paths without normalization
- **SSRF**: user-supplied URLs fetched server-side without allowlist
- **Unsafe deserialization**: parsing untrusted input into executable structures
- **CORS/CSRF**: wildcards origins with credentials; state-changing GET endpoints
- **Dependency**: new dependency added — obviously suspicious name/typosquat?
- **Sensitive data exposure**: PII/credentials in error messages, logs, or API responses that previously excluded them
