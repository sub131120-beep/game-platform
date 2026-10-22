export function isHttpsLaunchUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export function hasLaunchEligibility(input: { emailVerified: boolean; accountActive: boolean }): boolean { return input.emailVerified && input.accountActive; }
