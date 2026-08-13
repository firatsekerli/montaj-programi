// The guide's sections, in the same order as the sidebar menu. `navKey` reuses
// the nav translation for the title; `live` links to the actual feature page.
export interface GuideSection {
  slug: string;
  navKey: string;
  live: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  { slug: "dashboard", navKey: "dashboard", live: "/" },
  { slug: "planning", navKey: "planning", live: "/planning" },
  { slug: "notifications", navKey: "notifications", live: "/notifications" },
  { slug: "orders", navKey: "orders", live: "/orders" },
  { slug: "work-item-types", navKey: "workItemTypes", live: "/work-item-types" },
  { slug: "rules", navKey: "rules", live: "/rules" },
  { slug: "teams", navKey: "teams", live: "/teams" },
  { slug: "people", navKey: "people", live: "/people" },
  { slug: "assets", navKey: "assets", live: "/assets" },
  { slug: "audit", navKey: "audit", live: "/audit" },
];
