# macOS review app packaging

`native_host.swift` and `review_server.py` are the source files used to make
the double-clickable Desktop application. The Swift host creates a native
AppKit window and embeds the interface in `WKWebView`; it does not launch a web
browser.

The host also provides **File → Print Selected Publication…** (`Cmd+P`) and a
main-frame bridge for the in-page print button. Both fail closed unless the
current report DOM identifies a selected immutable publication. The print view
is explicitly sized to the active paper before WebKit pagination so current
macOS versions do not emit blank sheets from an uninitialised printing frame.

The packaged app serves the production `dist/` directory only on
`127.0.0.1:43127`, applies an SPA fallback for application routes, emits the
repository's restrictive content-security and defence-in-depth response
headers, rejects directory listings and resolved path traversal, persists
working data in the app's WebKit data store, and terminates the private server
with the native application process. Top-level WebKit navigation is limited to
that exact loopback origin plus the inert `about:` scheme.

From the repository root, package the current production build with:

```bash
packaging/macos-review/package-review-app.sh
```

The default output is `Project Controls Dashboard.app` on the current user's
Desktop. An alternative output path can be passed as the first argument.

Run the native-server regression tests from the repository root with:

```bash
pnpm test:native
```
