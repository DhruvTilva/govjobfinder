type P = { className?: string };
const base = (className = "h-4 w-4") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const SearchIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const MenuIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const CalendarIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);
export const ExternalIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </svg>
);
export const BuildingIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
  </svg>
);
export const PinIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const BookmarkIcon = ({ className, filled }: P & { filled?: boolean }) => (
  <svg {...base(className)} fill={filled ? "currentColor" : "none"}>
    <path d="M6 3h12v18l-6-4-6 4V3Z" />
  </svg>
);
export const ShieldIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const AlertIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);
export const ClockIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const DocIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const ChevronRight = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const RssIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" />
    <circle cx="6" cy="18" r="1" />
  </svg>
);
export const LogoMark = ({ className = "h-9 w-9" }: P) => (
  <svg className={className} viewBox="0 0 40 40" aria-hidden>
    <rect width="40" height="40" rx="9" fill="#00142f" />
    <path d="M10 29h20M12 29V18M17 29V18M23 29V18M28 29V18M9 17l11-7 11 7H9Z" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
    <circle cx="30" cy="11" r="4" fill="#fd651e" />
  </svg>
);
