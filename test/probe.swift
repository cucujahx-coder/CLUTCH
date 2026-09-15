import Foundation
import WebKit
let js = CommandLine.arguments[1]
let url = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "http://localhost:5173/index.html"
class D: NSObject, WKNavigationDelegate {
  var done = false
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      w.callAsyncJavaScript("try { return JSON.stringify(await (async()=>{" + js + "})()); } catch(e){ return 'ERR '+e; }", arguments: [:], in: nil, in: .page) { r in
        switch r { case .success(let v): print(v); case .failure(let e): print("FAIL", e) }
        self.done = true
      }
    }
  }
}
let cfg = WKWebViewConfiguration()
let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: cfg)
let d = D(); wv.navigationDelegate = d
wv.load(URLRequest(url: URL(string: url)!))
while !d.done { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05)) }
