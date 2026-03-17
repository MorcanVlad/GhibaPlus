import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// AICI ESTE SECRETUL PENTRU GOOGLE SEARCH
export const metadata: Metadata = {
  title: "GhibaPlus | Colegiul Național Elena Ghiba Birta",
  description: "Platforma elevilor de la Colegiul Național 'Elena Ghiba Birta'. Fii la curent cu ultimele știri, evenimente și activități din liceu.",
  keywords: "ghiba birta, ghiba plus, arad, colegiul national elena ghiba birta, elevi arad, liceu arad",
  authors: [{ name: "Consiliul Elevilor" }],
  openGraph: {
    title: "GhibaPlus",
    description: "Platforma elevilor de la Colegiul Național 'Elena Ghiba Birta'",
    url: "https://www.ghibaplus.vercel.app", // Schimbă cu domeniul tău real
    siteName: "GhibaPlus",
    images: [{ url: "/favicon.ico" }], // Pune un logo al liceului in folderul public/
    locale: "ro_RO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className={inter.className}>{children}</body>
    </html>
  );
}