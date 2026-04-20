import { analyzeGaps } from '../gapAnalysis';

describe('analyzeGaps', () => {
  it('returns empty array when all scores are at or above 70', () => {
    expect(analyzeGaps([{ regulation: 'GDPR', score: 70 }])).toEqual([]);
  });

  it('returns a gap entry when score is below 70', () => {
    const result = analyzeGaps([{ regulation: 'GDPR', score: 60 }]);
    expect(result).toHaveLength(1);
    expect(result[0].regulation).toBe('GDPR');
    expect(result[0].score).toBe(60);
  });

  it('maps GDPR to [All roles]', () => {
    const result = analyzeGaps([{ regulation: 'GDPR', score: 40 }]);
    expect(result[0].roles).toEqual(['All roles']);
  });

  it('maps AML to correct roles', () => {
    const result = analyzeGaps([{ regulation: 'AML', score: 50 }]);
    expect(result[0].roles).toEqual(['Compliance Officer', 'Front Office', 'Onboarding']);
  });

  it('maps KYC to correct roles', () => {
    const result = analyzeGaps([{ regulation: 'KYC', score: 50 }]);
    expect(result[0].roles).toEqual(['Compliance Officer', 'Customer Service', 'Onboarding']);
  });

  it('maps DORA to correct roles', () => {
    const result = analyzeGaps([{ regulation: 'DORA', score: 50 }]);
    expect(result[0].roles).toEqual(['IT Team', 'Risk Officer', 'Senior Management']);
  });

  it('maps MiFID II to correct roles', () => {
    const result = analyzeGaps([{ regulation: 'MiFID II', score: 50 }]);
    expect(result[0].roles).toEqual(['Front Office', 'Risk Officer', 'Compliance Officer']);
  });

  it('defaults to [All roles] for an unknown regulation', () => {
    const result = analyzeGaps([{ regulation: 'UNKNOWN', score: 50 }]);
    expect(result[0].roles).toEqual(['All roles']);
  });

  it('returns multiple gaps when multiple scores are below 70', () => {
    const result = analyzeGaps([
      { regulation: 'GDPR', score: 40 },
      { regulation: 'AML', score: 80 },
      { regulation: 'KYC', score: 55 },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.regulation)).toEqual(['GDPR', 'KYC']);
  });
});
