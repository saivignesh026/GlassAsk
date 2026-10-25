# Windows acceptance checks

Run on a real Windows 11 x64 desktop and, for the fallback, Windows 10. These checks were not completed on the Fedora authoring machine.

- [ ] Install/uninstall the NSIS package without admin rights; verify shortcuts and tray icon.
- [ ] Check acrylic/transparency, high contrast, reduced motion, 100%/150%/200% DPI, and multiple monitor layouts.
- [ ] Connect an eligible real ChatGPT account using system-browser sign-in. Confirm the app name and scopes in consent.
- [ ] Decline/cancel sign-in; try a signed-out registration, reconnect, account switching and workspace registrations with the same email.
- [ ] Verify real ID-token signature validation, catalog loading, request completion, limit errors and token renewal.
- [ ] Sign out while offline and online; confirm local clearing and the remote revocation notice.
- [ ] Verify both default shortcuts from another app. Record custom shortcuts; a reserved shortcut must show an error and leave old shortcuts working.
- [ ] Enable gestures. Nine strokes must not trigger; ten alternating strokes within two seconds must trigger the correct mode. Slow/diagonal movement must not trigger.
- [ ] Screenshot mode captures only the intended monitor before the panel opens. Remove image before sending; confirm text mode never captures.
- [ ] Ask a screenshot question and a follow-up. Verify screenshot is not written to disk and is cleared on close.
- [ ] Cancel during a stream; disconnect the network mid-stream; no partial answer may be labeled completed.
- [ ] Lock and unlock Windows; no captures or new panels while locked.
- [ ] Check launch at login, second-instance behavior, tray Settings access, and Quit.
- [ ] Inspect packaged files for credentials; check DPAPI credential encryption and restrictive renderer IPC.

Release only after these pass. If account eligibility prevents testing the direct ChatGPT plan preview, document that limitation rather than presenting sign-in as verified.
