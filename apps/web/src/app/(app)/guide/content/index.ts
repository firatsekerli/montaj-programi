import type { ComponentType } from "react";
import { AuditGuide } from "./audit";
import { AssetsGuide } from "./assets";
import { PeopleGuide } from "./people";
import { TeamsGuide } from "./teams";
import { RulesGuide } from "./rules";

// Slug → content component. A section appears as "hazır" in the index (and is
// reachable at /guide/<slug>) exactly when it has an entry here. Sections are
// filled in over time; the rest show "yakında".
export const GUIDE_CONTENT: Record<string, ComponentType> = {
  audit: AuditGuide,
  assets: AssetsGuide,
  people: PeopleGuide,
  teams: TeamsGuide,
  rules: RulesGuide,
};
