export function evalClarity(output: string): { score: number; reason: string } {
  const len = output.length;
  const pass = len > 20 && len < 500;
  return {
    score: pass ? 1 : 0,
    reason: pass
      ? 'Response length is within the target range.'
      : `Response length (${len}) is outside the target range (20-500).`,
  };
}
