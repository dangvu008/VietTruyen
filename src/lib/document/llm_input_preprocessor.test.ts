import { describe, expect, it } from 'vitest';
import { preprocessTextForLlmInput } from './llm_input_preprocessor';

describe('llm_input_preprocessor', () => {
  it('cleans noisy html into compact text with lower token estimate', () => {
    const raw = `
      <html>
        <head>
          <style>.hero{display:flex}</style>
          <script>console.log('tracking')</script>
        </head>
        <body>
          <header>Home</header>
          <main>
            <h1>Amazing Product</h1>
            <p>Built for builders who need speed.</p>
            <p>Built for builders who need speed.</p>
            <ul>
              <li>Fast onboarding</li>
              <li>Clear pricing</li>
            </ul>
          </main>
          <footer>Privacy Policy</footer>
        </body>
      </html>
    `;

    const result = preprocessTextForLlmInput(raw);

    expect(result.cleanText).toContain('Amazing Product');
    expect(result.cleanText).toContain('Built for builders who need speed.');
    expect(result.cleanText).toContain('Fast onboarding');
    expect(result.cleanText).not.toContain('<script>');
    expect(result.cleanText).not.toContain('Privacy Policy');
    expect(result.stats.cleanTokens).toBeLessThan(result.stats.rawTokens);
  });

  it('keeps plain text stable and trims obvious noise', () => {
    const raw = `
      Chapter 1: New Beginning
      The city was quiet before dawn.

      The city was quiet before dawn.
      Terms of Service
    `;

    const result = preprocessTextForLlmInput(raw);

    expect(result.cleanText).toContain('Chapter 1: New Beginning');
    expect(result.cleanText).toContain('The city was quiet before dawn.');
    expect(result.cleanText).not.toContain('Terms of Service');
    expect(result.stats.cleanChars).toBeGreaterThan(0);
  });
});

