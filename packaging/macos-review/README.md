# macOS review app packaging

`native_host.swift` and `review_server.py` are the source files used to make
the double-clickable Desktop application. The Swift host creates a native
AppKit window and embeds the interface in `WKWebView`; it does not launch a web
browser.

The packaged app serves the production `dist/` directory only on
`127.0.0.1:43127`, applies an SPA fallback for application routes, persists
working data in the app's WebKit data store, and terminates the private server
with the native application process.

From the repository root, package the current production build with:

```bash
packaging/macos-review/package-review-app.sh
```

The default output is `Project Controls Dashboard.app` on the current user's
Desktop. An alternative output path can be passed as the first argument.
