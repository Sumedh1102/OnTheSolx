export const SKILLS = [
  { key: "footwork", label: "Footwork" },
  { key: "smash", label: "Smash" },
  { key: "drop", label: "Drop" },
  { key: "serve", label: "Serve" },
  { key: "defense", label: "Defense" },
  { key: "agility", label: "Agility" },
  { key: "stamina", label: "Stamina" },
  { key: "matchPerformance", label: "Match play" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];
