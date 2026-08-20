import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const instrumentSansHeading = Instrument_Sans({ subsets: ['latin'], variable: '--font-heading' });

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Slate',
  description:
    'Dump everything on your mind, sort it in seconds, then work on the single task that matters right now.',
  applicationName: 'Slate',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfc' },
    { media: '(prefers-color-scheme: dark)', color: '#101114' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased font-sans", fontSans.variable, geistMono.variable, instrumentSansHeading.variable)}
    >
      <body className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
