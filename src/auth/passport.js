import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

class UserInfoStrategy extends OAuth2Strategy {
  async userProfile(accessToken, done) {
    const url = process.env.OAUTH_USERINFO_URL;
    if (!url) return done(null, {});
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return done(new Error(`userinfo ${res.status}`));
      done(null, await res.json());
    } catch (err) {
      done(err);
    }
  }
}

export function configurePassport() {
  const required = [
    'OAUTH_AUTH_URL',
    'OAUTH_TOKEN_URL',
    'OAUTH_CLIENT_ID',
    'OAUTH_CLIENT_SECRET',
    'OAUTH_CALLBACK_URL',
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing OAuth2 env var: ${key}`);
    }
  }

  passport.use(
    'oauth2',
    new UserInfoStrategy(
      {
        authorizationURL: process.env.OAUTH_AUTH_URL,
        tokenURL: process.env.OAUTH_TOKEN_URL,
        clientID: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        callbackURL: process.env.OAUTH_CALLBACK_URL,
        scope: (process.env.OAUTH_SCOPE || 'openid profile email').split(' '),
        state: true,
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile)
    )
  );
}
