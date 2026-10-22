/**
 * Which OAuth sign-in methods are actually configured. A provider without its client ID and
 * secret can't work, so its button is hidden and it isn't registered with Auth.js.
 * Edge-safe (env reads only), so middleware can use it too.
 */
export const oauthProviders = {
  github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
};

export type OAuthProviderId = keyof typeof oauthProviders;

export const enabledOAuthProviders = () =>
  (Object.keys(oauthProviders) as OAuthProviderId[]).filter((p) => oauthProviders[p]);
