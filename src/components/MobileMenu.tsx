"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, CloseIcon, MenuIcon } from "./icons";
import { useT } from "./LangProvider";
import { SITE_NAME } from "@/lib/site";

/** Hamburger button + slide-in drawer for phones; the desktop nav bar replaces it from md up. */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the drawer.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  // Portalled to <body>: the header's backdrop-blur would otherwise trap position:fixed inside it.
  const drawer = (
    <div className="md:hidden">
      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.label")}
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center gap-3 bg-navy-950 px-4 py-3 text-white">
          <button ref={closeBtn} type="button" onClick={close} aria-label={t("nav.close")} className="-ml-1 rounded p-1 hover:bg-white/10">
            <CloseIcon className="h-5 w-5" />
          </button>
          <Link href="/" onClick={close} className="min-w-0">
            <span className="block truncate text-base font-bold leading-tight">{SITE_NAME}</span>
            <span className="block truncate text-[11px] text-white/70">{t("header.tagline")}</span>
          </Link>
        </div>
        <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-line text-sm">
            {items.map((n) => {
              const active = n.href.split("?")[0] === pathname && !n.href.includes("?");
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between px-4 py-3.5 font-semibold hover:bg-slate-50 ${active ? "text-brand" : "text-ink"}`}
                  >
                    {n.label}
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={t("nav.menu")}
        className="btn-secondary shrink-0 px-2.5 py-1.5 md:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
