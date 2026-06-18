import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "./components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maestro.ai — AI Agent Platform",
  description: "Turn your startup idea into a complete startup package — powered by 6 AI agents",
  icons: { icon: "/maestro-favicon.svg" },
};

const clerkAppearance = {
  variables: {
    colorBackground:       "#12102a",
    colorInputBackground:  "#1c1836",
    colorText:             "#f2eeff",
    colorTextSecondary:    "rgba(242,238,255,0.85)",
    colorPrimary:          "#a78bfa",
    colorInputText:        "#f2eeff",
    borderRadius:          "10px",
  },
  elements: {
    card:               "backdrop-blur-xl",
    socialButtonsBlockButton: {
      background:   "rgba(255,255,255,0.10)",
      border:       "1px solid rgba(255,255,255,0.18)",
      color:        "#f2eeff",
    },
    socialButtonsBlockButtonText: {
      color: "#f2eeff",
    },
    dividerLine:        { background: "rgba(255,255,255,0.12)" },
    dividerText:        { color: "rgba(242,238,255,0.40)" },
    formButtonPrimary:  { background: "#7c3aed" },
    footerActionLink:   { color: "#a78bfa" },
    userButtonPopoverActionButton: {
      color: "#f2eeff",
    },
    userButtonPopoverActionButtonText: {
      color: "#f2eeff",
      opacity: 1,
    },
    userButtonPopoverActionButtonIcon: {
      color: "#a78bfa",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" data-theme="dark">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
            rel="stylesheet"
          />
          {/* Flash-prevention: set theme before React hydrates */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`,
            }}
          />
        </head>
        <body>
          <AppShell>
            {children}
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
