import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "library"
  | "market"
  | "pack"
  | "compass"
  | "create"
  | "wallet"
  | "settings"
  | "arrow"
  | "external"
  | "refresh"
  | "search"
  | "copy"
  | "play"
  | "back"
  | "check"
  | "clock"
  | "shield"
  | "swap"
  | "guide"
  | "heart";
const paths: Record<IconName, ReactNode> = {
  library: (
    <>
      <path d="M4 5h6v15H4zM14 5h6v15h-6zM4 9h6M14 9h6M4 16h6M14 16h6" />
    </>
  ),
  market: (
    <>
      <path d="M5 3v18M3 8h4v7H3zM12 3v18M10 5h4v6h-4zM19 3v18M17 12h4v6h-4z" />
    </>
  ),
  pack: (
    <>
      <path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 8-2.5 5.5L8 16l2.5-5.5z" />
    </>
  ),
  create: (
    <>
      <path d="m15 4 5 5M4 20l1-6L16 3a2.8 2.8 0 0 1 4 4L9 18zM4 20l5-2" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7V5a2 2 0 0 1 2-2h12v4M4 7h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1zM21 11h-6v6h6M17 14h.01" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3-.7 2.1-2 .9-2.1-.5-2 3.5 1.5 1.6v2.8L3.2 15l2 3.5 2.1-.5 2 .9.7 2.1h4l.7-2.1 2-.9 2.1.5 2-3.5-1.5-1.6v-2.8L20.8 9l-2-3.5-2.1.5-2-.9L14 3z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  external: (
    <path d="M14 3h7v7M21 3l-9 9M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5" />
  ),
  refresh: (
    <>
      <path d="M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
    </>
  ),
  play: <path d="m7 4 14 8-14 8z" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6zM8 12l3 3 5-6" />
    </>
  ),
  swap: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
  guide: (
    <>
      <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zM12 5v15" />
    </>
  ),
  heart: (
    <path d="M20.5 5.5a5 5 0 0 0-7.1 0L12 7l-1.4-1.5a5 5 0 0 0-7.1 7.1L12 21l8.5-8.4a5 5 0 0 0 0-7.1z" />
  ),
};
export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
