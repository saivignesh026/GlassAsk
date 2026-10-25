# Windows acceptance checks

Run on a real Windows 11 x64 desktop and, for the fallback, Windows 10. These checks were not completed on the Fedora authoring machine.

- [ ] Install/uninstall the NSIS package without admin rights; verify shortcuts and tray icon.
- [ ] Check transparent margins, compact sizing after reopening and returning from Settings, high contrast, reduced motion, 100%/150%/200% DPI, and multiple monitor layouts. Run `npm run test:windows` for automated layout/handoff checks first.
- [ ] Connect an eligible real ChatGPT account using system-browser sign-in. Confirm the app name and scopes in consent.
- [ ] During browser sign-in, the assistant hides and stays out of Chrome's way. It returns on completion, cancellation, or browser failure.
- [ ] Decline/cancel sign-in; try a signed-out registration, reconnect, account switching and workspace registrations with the same email.
- [ ] Verify real ID-token signature validation, catalog loading, request completion, limit errors and token renewal.
- [ ] Sign out while offline and online; confirm local clearing and the remote revocation notice.
- [ ] Verify both default shortcuts from another app. Record custom shortcuts; a reserved shortcut must show an error and leave old shortcuts working.
- [ ] Select Use trackpad settings; confirm gestures are enabled with three strokes each way in 3.5 seconds. Use one finger to move the pointer (12 pixels minimum per stroke). Test horizontal screenshot and vertical text gestures, then test the mouse profile (25 pixels). Tiny jitter, incomplete shakes, and slow/diagonal movement must not trigger.
- [ ] Drag the header; confirm buttons still click, position survives reopening/relaunch, and the panel stays reachable after unplugging a monitor. Minimize to taskbar and restore from taskbar, tray, and shortcut.
- [ ] Screenshot mode captures only the intended monitor before the panel opens. Remove image before sending; confirm text mode never captures.
- [ ] Ask a screenshot question and a follow-up. Verify screenshot is not written to disk and is cleared on close.
- [ ] Cancel during a stream; disconnect the network mid-stream; no partial answer may be labeled completed.
- [ ] Lock and unlock Windows; no captures or new panels while locked.
- [ ] Check launch at login, second-instance behavior, tray Settings access, and Quit.
- [ ] Inspect packaged files for credentials; check DPAPI credential encryption and restrictive renderer IPC.

Release only after these pass. If account eligibility prevents testing the direct ChatGPT plan preview, document that limitation rather than presenting sign-in as verified.
