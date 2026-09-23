import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function InstagramIcon(props: P) {
  return (
    <svg {...common} {...props} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function YoutubeIcon(props: P) {
  return (
    <svg {...common} {...props} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10 9 5 3-5 3V9Z" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon(props: P) {
  return (
    <svg {...common} {...props} aria-hidden>
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15V3Z" />
    </svg>
  );
}

export function WhatsappIcon(props: P) {
  return (
    <svg {...common} {...props} aria-hidden>
      <path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" />
      <path d="M8.5 8.5c.3 2.9 2.6 5.3 5.5 5.9l1.2-1.2 1.8.9-.4 1.6c-3.9.3-8.1-3.6-8.1-7.6l1.6-.4.9 1.8-1.2 1.2" strokeWidth="1.6" />
    </svg>
  );
}

export const SOCIAL_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  Instagram: InstagramIcon,
  YouTube: YoutubeIcon,
  Facebook: FacebookIcon,
  WhatsApp: WhatsappIcon,
};
