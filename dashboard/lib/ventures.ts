export const VENTURES = [
  { id: "online_first", label: "Online First", phase: "Phase 1", color: "bg-blue-100 text-blue-700" },
  { id: "blazed_outfitters", label: "Blazed Outfitters", phase: "Phase 2", color: "bg-orange-100 text-orange-700" },
  { id: "droplane", label: "Droplane", phase: "Phase 2", color: "bg-purple-100 text-purple-700" },
  { id: "brandary", label: "Brandary", phase: "Phase 3", color: "bg-green-100 text-green-700" },
  { id: "worknest", label: "Worknest", phase: "Phase 3", color: "bg-teal-100 text-teal-700" },
] as const;

export type VentureId = (typeof VENTURES)[number]["id"];

export function getVenture(id: string) {
  return VENTURES.find((v) => v.id === id);
}
