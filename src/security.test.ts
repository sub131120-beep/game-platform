import { describe, expect, it } from 'vitest';
import { hasLaunchEligibility, isHttpsLaunchUrl } from './security';
describe('game launch safeguards', () => {
  it('only accepts HTTPS URLs without embedded credentials', () => {
    expect(isHttpsLaunchUrl('https://games.example/game/')).toBe(true);
    expect(isHttpsLaunchUrl('http://games.example/game/')).toBe(false);
    expect(isHttpsLaunchUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsLaunchUrl('https://user:pass@games.example/')).toBe(false);
    expect(isHttpsLaunchUrl('not a URL')).toBe(false);
  });
  it('requires a verified email and an active account', () => {
    expect(hasLaunchEligibility({ emailVerified: true, accountActive: true })).toBe(true);
    expect(hasLaunchEligibility({ emailVerified: false, accountActive: true })).toBe(false);
    expect(hasLaunchEligibility({ emailVerified: true, accountActive: false })).toBe(false);
  });
});
