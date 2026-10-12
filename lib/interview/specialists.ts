/**
 * Specialist metadata shared by server and client components.
 * Plain data — no JSX, no "use client", safe to import anywhere.
 */

export const SPECIALIST_ORDER = [
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
] as const;

export type SpecialistKey = (typeof SPECIALIST_ORDER)[number];

export const SPECIALIST_META: Record<
  SpecialistKey,
  { name: string; title: string; image: string }
> = {
  technical: {
    name: "Aris Bahri",
    title: "Technical Agent",
    image: "/agents/technical.png",
  },
  finance: {
    name: "Amara Okafor",
    title: "Finance Agent",
    image: "/agents/finance.png",
  },
  marketing: {
    name: "Rohan Mehta",
    title: "Marketing Agent",
    image: "/agents/marketing.png",
  },
  legal: {
    name: "Mei Tanaka",
    title: "Legal Agent",
    image: "/agents/legal.png",
  },
  founder: {
    name: "Karim Haddad",
    title: "Founder Agent",
    image: "/agents/founder.png",
  },
};