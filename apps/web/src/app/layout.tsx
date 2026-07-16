import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/i18n/request";
import "./globals.css";

export const metadata = {
  title: "Montaj Programı",
  description: "Evrensel saha montaj planlama sistemi",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
