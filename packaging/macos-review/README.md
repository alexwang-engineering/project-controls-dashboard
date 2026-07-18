# macOS review app packaging

`launcher.applescript` and `review_server.py` are the source files used to make
the double-clickable Desktop review application.

The packaged app serves the production `dist/` directory only on
`127.0.0.1:43127`, applies an SPA fallback for browser routes, writes no project
data outside normal browser storage, and stops after 30 minutes without a page
request.

From the repository root, package the current production build with:

```bash
packaging/macos-review/package-review-app.sh
```

The default output is `Project Controls Dashboard.app` on the current user's
Desktop. An alternative output path can be passed as the first argument.
