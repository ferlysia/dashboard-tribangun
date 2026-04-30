import type { Metadata, Viewport } from "next"; 
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ActiveThemeProvider } from "@/components/ui/active-theme";
import { CurrentUserProvider } from "@/components/providers/current-user-provider";
import { YearFilterProvider } from "@/components/providers/year-filter-provider";
import { InvoicesProvider } from "@/components/providers/invoices-provider";
import { cn } from "@/lib/utils"; 
import { cookies } from "next/headers"; 

const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
}

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TUP Dashboard — PT Tri Bangun Usaha Persada",
  description: "Internal Business Dashboard PT Tri Bangun Usaha Persada",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get("active_theme")?.value;
  const isScaled = activeThemeValue?.endsWith("-scaled");

  return (
    <html lang="en" suppressHydrationWarning> 
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background overscroll-none font-sans antialiased",
          activeThemeValue ? `theme-${activeThemeValue}` : "",
          isScaled ? "theme-scaled" : "",
          geistSans.variable,
          geistMono.variable
        )}      
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <ActiveThemeProvider initialTheme={activeThemeValue}>
            <CurrentUserProvider>
              <InvoicesProvider>
                <YearFilterProvider>{children}</YearFilterProvider>
              </InvoicesProvider>
            </CurrentUserProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
