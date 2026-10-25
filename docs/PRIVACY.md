# Privacy

Glass Ask stores preferences and a randomly generated installation identifier in its application-data directory. Account registrations and OAuth credentials are stored encrypted using Electron safeStorage (DPAPI on Windows). No credentials are sent to the renderer or logged. Glass Ask never asks for your ChatGPT password.

Opening screen mode captures the monitor under your pointer into memory. Pressing Send transmits the screenshot, question, and current conversation context to OpenAI. Opening the popup alone sends no screenshot. Follow-up requests resend the relevant in-memory history. Escape/close, a fresh trigger, account switching, or application exit clears that context. No chat or screenshot files are saved by Glass Ask. Operating-system paging and provider-side handling are outside this application's storage controls.

Mouse gestures poll pointer coordinates every 40 milliseconds while enabled. Coordinates are not stored or uploaded. Keyboard shortcuts use the operating system's shortcut registration; the application does not record general typing.

Requests use your eligible ChatGPT plan. See ChatGPT settings to manage access, limits, and provider privacy controls. `store:false` is a Responses API setting, not a claim of zero provider retention.

Sign-out attempts to revoke the renewable session and clears local tokens. If remote revocation fails, the app says so and directs you to ChatGPT settings. The registration/client mapping is retained for later reconnects.
