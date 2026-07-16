import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SF Prep Tracker",
  description: "Special Forces Training Program Tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-gray-950 text-gray-100 antialiased font-sans min-h-screen selection:bg-emerald-500/30 selection:text-emerald-200">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Global error logger
                window.__errors = [];
                window.onerror = function(message, source, lineno, colno, error) {
                  var errInfo = {
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    stack: error ? error.stack : (new Error().stack)
                  };
                  window.__errors.push(errInfo);
                  console.error('Captured startup error:', errInfo);
                  
                  // Show diagnostic overlay
                  var overlay = document.getElementById('startup-error-overlay');
                  if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'startup-error-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.98)';
                    overlay.style.color = '#f87171';
                    overlay.style.padding = '24px';
                    overlay.style.fontFamily = 'monospace';
                    overlay.style.zIndex = '999999';
                    overlay.style.overflow = 'auto';
                    document.documentElement.appendChild(overlay);
                  }
                  overlay.innerHTML = '<h2>🚨 Critical Startup Error Detected</h2>' +
                    '<p style="color: #e2e8f0">The application failed to render due to an unhandled runtime exception:</p>' +
                    '<div style="background-color: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 16px;">' +
                    '<strong>Error:</strong> ' + message + '<br/><br/>' +
                    '<strong>File:</strong> ' + source + ' (Line ' + lineno + ', Col ' + colno + ')<br/><br/>' +
                    '<strong>Stack Trace:</strong><br/><pre style="white-space: pre-wrap; margin-top: 8px; color: #cbd5e1;">' + (errInfo.stack || 'No stack trace available') + '</pre>' +
                    '</div>' +
                    '<p style="color: #94a3b8">This diagnostic tool was injected to pinpoint the source of the issue.</p>';
                };
                window.addEventListener('unhandledrejection', function(event) {
                  window.onerror(event.reason ? event.reason.message || event.reason : 'Unhandled promise rejection', '', 0, 0, event.reason);
                });

                // Patch window.fetch with proper getter and setter
                try {
                  var currentFetch = window.fetch;
                  Object.defineProperty(window, 'fetch', {
                    get: function() { return currentFetch; },
                    set: function(val) { currentFetch = val; },
                    configurable: true,
                    enumerable: true
                  });
                } catch (e1) {
                  try {
                    var currentFetchProto = Window.prototype.fetch || window.fetch;
                    Object.defineProperty(Window.prototype, 'fetch', {
                      get: function() { return currentFetchProto; },
                      set: function(val) { currentFetchProto = val; },
                      configurable: true,
                      enumerable: true
                    });
                  } catch (e2) {}
                }
              })();
            `
          }}
        />
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </body>
    </html>
  );
}
