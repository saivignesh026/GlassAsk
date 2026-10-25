# Security

Do not include tokens, account files, screenshots, or personal prompts in issue reports. Report vulnerabilities privately to the repository maintainer before public disclosure; configure GitHub private vulnerability reporting when publishing this repository.

Security properties:

- System-browser authorization; no embedded password form.
- Loopback callback bound to 127.0.0.1; random state, nonce and PKCE for each attempt.
- Issued client ID checked against returning registrations. ID token validated through JOSE against OpenAI JWKS with issuer, audience, expiry and nonce checks.
- Credentials encrypted by OS storage; no plaintext fallback. No credentials shipped in the repository.
- Context isolation, renderer sandbox, no Node integration, restrictive CSP, fixed IPC allowlist, trusted-frame checks, external navigation blocked.
- Responses shown as text, never untrusted HTML. Screenshot text is treated as context. No AI command execution.
- Model discovery and inference use public OpenAI endpoints. No private ChatGPT backend endpoints or token scraping.

Before distributing binaries: complete docs/WINDOWS-TESTING.md, commit a dependency lockfile, review dependencies, configure your publisher's code-signing identity, and enable private security reporting. The current preview has not received an independent security audit.
