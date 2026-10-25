# Glass Ask

A small, glass-style Windows assistant. Ask a question from anywhere, or capture the screen under your pointer and ask about it. Connect your own ChatGPT account through OpenAI's browser sign-in.

**Status: preview source release.** Core logic is tested on Linux. Windows installation, native acrylic, global shortcuts, screen capture, and real-account OAuth need Windows acceptance testing before a public binary release. No compiled installer is included in this source archive.

## Features

- Frameless, always-on-top glass popup, with an adjustable translucent fallback.
- Transparent rounded panel without a rectangular native backdrop.
- Continue with ChatGPT, saved account/workspace registrations, reconnect and sign-out.
- Account-specific model picker and streamed answers.
- Separate, customizable global shortcuts for text and screen questions, with conflict detection.
- Optional mouse gestures: left–right for screenshot questions, up–down for text. Default trackpad profile: three movements each way within 3.5 seconds.
- Automatic capture of the monitor under the pointer, before the popup appears.
- Remove a captured screenshot before sending. Nothing is uploaded just by opening the popup.
- Follow-up questions, copy answer, cancel, tray menu, and optional launch at login.

## Requirements

Windows 10/11 x64 and an eligible ChatGPT account with permission to use its plan in this app. Workspace policy, model availability, and usage limits apply. No API key, Codex installation, or developer-owned server is required.

The authentication integration follows the current [OpenAI open-source Sign in with ChatGPT flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in). This is a preview capability and is not guaranteed for every account. Glass Ask is independent and is not an OpenAI or Apple product. It cannot read your existing ChatGPT conversation history.

## Build on Windows

Install Node.js 22 or later and Git, then run in this folder:

```powershell
npm ci
npm run check
npm test
npm start
```

Create the installer:

```powershell
npm run dist:win
```

The output is `dist/Glass-Ask-0.1.2-Setup.exe`. It is unsigned unless you configure your own signing certificate. Sign and test public release binaries under your own publisher identity.

## Put it on GitHub

1. Create an empty GitHub repository named `glass-ask`.
2. Push **this folder only**, not your home directory or any local credentials:

```powershell
git init -b main
git add .
git commit -m "Initial Glass Ask preview"
git remote add origin https://github.com/YOUR_USERNAME/glass-ask.git
git push -u origin main
```

3. Open **Actions → Windows installer**. The workflow builds on a Windows runner and uploads a `Glass-Ask-Windows` artifact containing the installer.
4. Run the [Windows acceptance checks](docs/WINDOWS-TESTING.md). Create a GitHub Release and attach the tested installer when ready. The workflow deliberately does not publish releases automatically.

The included `package-lock.json` pins the resolved dependencies. Local and GitHub Actions builds use `npm ci` for repeatable installs. The workflow uploads the lockfile as an artifact as well.

## Use it

Drag the top header to move the panel; its position is remembered. Click **−** to minimize to the Windows taskbar. Restore from the taskbar or the global shortcut. The close button hides the panel in the tray.

Mouse gestures are enabled on new installations. Upgrades preserve your existing preference: if gestures are off, enable **Settings → Mouse shake gestures** and click **Save preferences**. Click outside the panel or press Escape to dismiss it before shaking the mouse. Sign-in hides the panel while you use the browser and restores it when sign-in finishes or fails.

1. Launch Glass Ask and choose **Continue with ChatGPT**. Approve the connection in the system browser.
2. Default text shortcut: **Ctrl + Alt + Space**.
3. Default screen shortcut: **Ctrl + Alt + S**.
4. Open **Settings**, click either shortcut field and press your preferred combination, then **Save preferences**.
5. Optionally enable mouse gestures and adjust the count and time window. Use one finger on a trackpad to move the pointer; two-finger scrolling does not move the pointer. Trackpad strokes must travel at least 12 logical pixels (mouse profile: 25). Use **Settings → Use trackpad settings** to enable gestures and save the trackpad preset, including on upgrades. Diagonal movement is ignored.
6. Press Enter to send, Shift+Enter for a new line, or Escape to hide and clear the current chat. The tray menu can always reopen Settings.

Your screen capture stays attached to the current in-memory chat for follow-ups. A fresh trigger starts a fresh chat. Screenshots are limited to 2560 pixels wide. DRM/protected windows may appear black. Mouse gestures are disabled while the panel is visible or the desktop is locked.

## Architecture

`src/main.mjs` owns windows, shortcuts, screen capture, and IPC. `src/oauth.mjs` implements loopback authorization with PKCE/state/nonce, JOSE ID-token validation, refresh and revocation. `src/storage.mjs` uses Electron `safeStorage` (Windows DPAPI) and atomic writes. The sandboxed renderer has no Node access, network access, or credential access.

The app calls the public Responses API directly with `store:false` and `stream:true`. It does not execute model-generated commands or tools. This app has no telemetry, cloud backend, or automatic update service. See [Privacy](docs/PRIVACY.md) and [Security](SECURITY.md).

## Verification

```powershell
npm run check
npm test
```

Tests cover shake direction/timing, shortcut conflicts, OAuth state/client checks, token scope handling, stream completion and failures, and protected-storage failure behavior. Mocked tests are not a substitute for the Windows and real-account checks.

On Windows, `npm run test:windows` launches an isolated test instance without installing the app or using your saved accounts. It checks panel sizing, transparent margins, dismissal, and browser handoff. `npm start` runs the app for manual testing before building an installer.

## License

MIT. OpenAI and ChatGPT trademarks belong to their respective owners. The app's code license does not override the provider's service terms or account restrictions.
