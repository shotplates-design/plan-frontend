import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan — NFL odds",
  description: "Play-money NFL betting with historical prop hit rates.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `(function(){try{var p=new URLSearchParams(location.search);var q=p.get("theme")||p.get("skin");var t=q||localStorage.getItem("plan-skin");if(t==="fanduel"||t==="draftkings"){document.documentElement.setAttribute("data-theme",t);if(q)localStorage.setItem("plan-skin",t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
