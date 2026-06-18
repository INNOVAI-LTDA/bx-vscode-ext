export interface BxTextObservability {
  totalchars: number;
  estimatedTokens: number;
  tokenCountingMethod: 'totalchars/4';
}

export function calculateTextObservability(text: string): BxTextObservability {
  const totalchars = text.length;

  return {
    totalchars,
    estimatedTokens: Math.ceil(totalchars / 4),
    tokenCountingMethod: 'totalchars/4'
  };
}
