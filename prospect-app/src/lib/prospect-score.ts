export type RankingInput = {
  distanceMiles: number | null;
  closureStatus: 'filed' | 'approved' | 'withdrawn' | 'completed' | 'unverified' | null;
  relationshipConfidence: 'confirmed' | 'likely' | 'possible' | 'unverified' | null;
  currentSignals: number;
  contactVerified: boolean;
  suppressed: boolean;
};

export type RankingResult = { score: number; reasons: string[]; blocked: boolean };

export function rankProspect(input: RankingInput): RankingResult {
  if (input.suppressed) return { score: 0, reasons: ['Suppressed from outreach'], blocked: true };
  let score = 0;
  const reasons: string[] = [];
  if (input.distanceMiles !== null) {
    const proximity = input.distanceMiles <= 1 ? 25 : input.distanceMiles <= 2 ? 18 : input.distanceMiles <= 5 ? 8 : 0;
    score += proximity;
    if (proximity) reasons.push(`${input.distanceMiles.toFixed(1)} miles from a closing branch`);
  }
  const closurePoints = { approved: 20, completed: 18, filed: 12, unverified: 0, withdrawn: 0 }[input.closureStatus || 'unverified'];
  score += closurePoints;
  if (closurePoints) reasons.push(`Closure status: ${input.closureStatus}`);
  const relationshipPoints = { confirmed: 30, likely: 20, possible: 10, unverified: 0 }[input.relationshipConfidence || 'unverified'];
  score += relationshipPoints;
  if (relationshipPoints) reasons.push(`${input.relationshipConfidence} bank-relationship evidence`);
  const signalPoints = Math.min(15, input.currentSignals * 3);
  score += signalPoints;
  if (signalPoints) reasons.push(`${input.currentSignals} current business signal${input.currentSignals === 1 ? '' : 's'}`);
  if (input.contactVerified) {
    score += 10;
    reasons.push('Public contact method verified');
  }
  return { score: Math.min(100, score), reasons, blocked: false };
}
