import AppKit
import Foundation
import WebKit

private let applicationName = "Project Controls Dashboard"
private let localPort = 43_127

final class ApplicationDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var serverProcess: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureMenu()
        createWindow()
        startLocalServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopLocalServer()
    }

    private func configureMenu() {
        let mainMenu = NSMenu()

        let applicationMenuItem = NSMenuItem()
        let applicationMenu = NSMenu(title: applicationName)
        applicationMenu.addItem(
            withTitle: "About \(applicationName)",
            action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
            keyEquivalent: ""
        )
        applicationMenu.addItem(NSMenuItem.separator())
        applicationMenu.addItem(
            withTitle: "Quit \(applicationName)",
            action: #selector(NSApplication.terminate(_:)),
            keyEquivalent: "q"
        )
        applicationMenuItem.submenu = applicationMenu
        mainMenu.addItem(applicationMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        let reloadItem = NSMenuItem(
            title: "Reload",
            action: #selector(reloadApplication(_:)),
            keyEquivalent: "r"
        )
        reloadItem.target = self
        viewMenu.addItem(reloadItem)
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        NSApplication.shared.mainMenu = mainMenu
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.isElementFullscreenEnabled = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = true

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = applicationName
        window.minSize = NSSize(width: 860, height: 620)
        window.contentView = webView
        window.delegate = self
        window.center()
        window.makeKeyAndOrderFront(nil)

        self.webView = webView
        self.window = window
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    private func startLocalServer() {
        guard let scriptURL = Bundle.main.url(forResource: "review_server", withExtension: "py") else {
            showLaunchFailure("The application bundle does not contain its local server.")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [
            scriptURL.path,
            "--port",
            String(localPort),
            "--parent-pid",
            String(ProcessInfo.processInfo.processIdentifier),
        ]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            serverProcess = process
        } catch {
            showLaunchFailure("The private local server could not start: \(error.localizedDescription)")
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self, weak process] in
            guard let self else { return }
            guard process?.isRunning == true else {
                self.showLaunchFailure(
                    "The private local server stopped during launch. Close any older copy of the app and reopen it."
                )
                return
            }
            self.loadApplicationRoute("/")
        }
    }

    private func stopLocalServer() {
        guard let process = serverProcess, process.isRunning else { return }
        process.terminate()
    }

    private func loadApplicationRoute(_ route: String) {
        guard let url = URL(string: "http://127.0.0.1:\(localPort)\(route)") else { return }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        webView?.load(request)
    }

    @objc private func reloadApplication(_ sender: Any?) {
        webView?.reload()
    }

    private func showLaunchFailure(_ message: String) {
        let escaped = message
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        webView?.loadHTMLString(
            """
            <!doctype html><html lang="en"><meta charset="utf-8">
            <title>\(applicationName) could not start</title>
            <style>body{font:16px -apple-system;margin:48px;max-width:680px;color:#162b3a}h1{font-size:28px}</style>
            <h1>\(applicationName) could not start</h1><p>\(escaped)</p>
            """,
            baseURL: nil
        )
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.host == "127.0.0.1" && url.port == localPort {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "about" || url.scheme == "data" {
            decisionHandler(.allow)
            return
        }
        if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url,
           ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
           url.host != "127.0.0.1" {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        showLaunchFailure(
            "The application interface could not connect to its private local server. Reopen the app and try again."
        )
    }
}

let application = NSApplication.shared
let delegate = ApplicationDelegate()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
