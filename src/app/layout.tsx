import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virgil",
  description: "A study workspace for FINKI students.",
  icons: { icon: "/assets/virgil-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
