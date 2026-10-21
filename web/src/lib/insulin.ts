/**
 * One-line insulin regimen summary. Lives outside the "use client" components so server pages
 * (archive, print views) can call it too.
 */
export function regimenSummary(d: { basalUnits: number; breakfastUnits: number; lunchUnits: number; dinnerUnits: number }) {
  return `Lantus (11 PM): ${d.basalUnits}U | Actrapid: B(9 AM) ${d.breakfastUnits}U • L(3 PM) ${d.lunchUnits}U • D(9 PM) ${d.dinnerUnits}U`;
}
