import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const instrumentSansHeading = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
})

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Slate",
  description:
    "Dump everything on your mind, sort it in seconds, then work on the single task that matters right now.",
  applicationName: "Slate",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#101114" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        fontSans.variable,
        geistMono.variable,
        instrumentSansHeading.variable
      )}
    >
      <body className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
        {/* Clerk's screens read from the same shadcn tokens as the rest of
            the app, so sign-in does not look bolted on. */}
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ThemeProvider>{children}</ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
