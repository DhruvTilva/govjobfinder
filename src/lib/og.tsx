import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "./site";

/** Shared 1200×630 social preview card (site default and per-notice). */
export const OG_SIZE = { width: 1200, height: 630 };

const LOGO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#ffffff"/><path d="M10 29h20M12 29V18M17 29V18M23 29V18M28 29V18M9 17l11-7 11 7H9Z" stroke="#00142f" stroke-width="2.2" stroke-linejoin="round" fill="none"/><circle cx="30" cy="11" r="4" fill="#fd651e"/></svg>`,
  ).toString("base64");

export function ogCard({ eyebrow, title, facts = [] }: { eyebrow: string; title: string; facts?: string[] }) {
  const host = new URL(siteUrl()).host;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#00142f", color: "#fff", padding: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} width={72} height={72} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 22, color: "#a9b8d0" }}>{SITE_TAGLINE}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#fd651e", textTransform: "uppercase", letterSpacing: 2 }}>{eyebrow}</div>
          <div style={{ display: "flex", fontSize: title.length > 80 ? 48 : 60, fontWeight: 700, lineHeight: 1.15 }}>
            {title.length > 140 ? title.slice(0, 137) + "…" : title}
          </div>
          {facts.length > 0 && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {facts.map((f) => (
                <div key={f} style={{ display: "flex", fontSize: 26, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 18px" }}>
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#a9b8d0" }}>{host}</div>
      </div>
    ),
    OG_SIZE,
  );
}
