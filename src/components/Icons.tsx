import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconLibrary = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="4" width="4" height="16" rx="1" />
    <rect x="9.5" y="4" width="4" height="16" rx="1" />
    <path d="m16 5.2 3.6-.9 2.9 15.3-3.6.9z" />
  </Base>
);
export const IconBackups = (p: P) => (
  <Base {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4v4.5H8" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);
export const IconSync = (p: P) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.6L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.6L20 15.5" />
    <path d="M20 20v-4.5h-4.5" />
  </Base>
);
export const IconSettings = (p: P) => (
  <Base {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Base>
);
export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Base>
);
export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IconChevron = (p: P) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);
export const IconCopy = (p: P) => (
  <Base {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Base>
);
export const IconDownload = (p: P) => (
  <Base {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
  </Base>
);
export const IconEdit = (p: P) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Base>
);
export const IconTrash = (p: P) => (
  <Base {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7" />
  </Base>
);
export const IconRestore = (p: P) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M4 4.5V9h4.5" />
  </Base>
);
export const IconFolder = (p: P) => (
  <Base {...p}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  </Base>
);
export const IconUpload = (p: P) => (
  <Base {...p}>
    <path d="M12 16V5M7 9.5l5-5 5 5M5 19.5h14" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);
export const IconAlert = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5M12 16.4v.1" />
  </Base>
);
export const IconBack = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);
export const IconExternal = (p: P) => (
  <Base {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 6 7h4.5" />
  </Base>
);
export const IconRail = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9 4.5v15M14.5 10l-2 2 2 2" />
  </Base>
);
export const IconExport = (p: P) => (
  <Base {...p}>
    <path d="M12 14V3.5M8 7.5l4-4 4 4" />
    <path d="M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12" />
  </Base>
);
export const IconImport = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5V14M8 10l4 4 4-4" />
    <path d="M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12" />
  </Base>
);
