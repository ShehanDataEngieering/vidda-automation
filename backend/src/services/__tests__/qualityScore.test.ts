import { scoreModule } from '../qualityScore';

describe('scoreModule', () => {
  it('scores 0 when content is empty', () => {
    expect(scoreModule('', 'GDPR')).toBe(0);
  });

  it('+20 when content contains the regulation name', () => {
    expect(scoreModule('GDPR compliance is required.', 'GDPR')).toBe(20);
  });

  it('+20 when content references an article number', () => {
    expect(scoreModule('See Article 5 for details.', 'GDPR')).toBe(20);
  });

  it('+20 when word count is between 200 and 500', () => {
    const words = Array(250).fill('word').join(' ');
    expect(scoreModule(words, 'GDPR')).toBe(20);
  });

  it('no word count bonus below 200 words', () => {
    const words = Array(100).fill('word').join(' ');
    expect(scoreModule(words, 'GDPR')).toBe(0);
  });

  it('+20 when content contains OBJECTIVES section', () => {
    expect(scoreModule('OBJECTIVES\n- learn things', 'GDPR')).toBe(20);
  });

  it('+20 when content contains ASSESSMENT section', () => {
    expect(scoreModule('ASSESSMENT\nQuestion here?', 'GDPR')).toBe(20);
  });

  it('scores 100 when all five conditions are met', () => {
    const body = Array(250).fill('compliance').join(' ');
    const content = [
      'GDPR Article 5 overview',
      'OBJECTIVES',
      '- understand data rights',
      body,
      'ASSESSMENT',
      'What does Article 5 require?',
    ].join('\n');
    expect(scoreModule(content, 'GDPR')).toBe(100);
  });
});
