import { User, type UserDocument } from "../models/User.js";
import type { OAuthProfile } from "./providers.js";

/**
 * Busca o crea usuario a partir del perfil OAuth.
 * Persiste en Mongo (Atlas / local / memory). Si la DB falla, propaga el error.
 */
export async function upsertOAuthUser(
  profile: OAuthProfile
): Promise<UserDocument> {
  const email = profile.email.toLowerCase();

  let user = await User.findOne({
    oauthAccounts: {
      $elemMatch: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
  });

  if (!user) {
    user = await User.findOne({ email });
  }

  if (user) {
    const hasLink = user.oauthAccounts?.some(
      (a) =>
        a.provider === profile.provider &&
        a.providerUserId === profile.providerUserId
    );
    if (!hasLink) {
      user.oauthAccounts.push({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      });
    }
    user.authProvider = profile.provider;
    user.emailVerified = true;
    await user.save();
    return user;
  }

  return User.create({
    email,
    role: "user",
    profileComplete: false,
    profile: null,
    emailVerified: true,
    authProvider: profile.provider,
    oauthAccounts: [
      {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    ],
  });
}
