import {
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  type SocialNetwork,
  type UserProfile,
} from "@nocta/shared";

const SOCIAL_ICONS: Record<SocialNetwork, string> = {
  instagram: "bi-instagram",
  tiktok: "bi-tiktok",
  x: "bi-twitter-x",
  facebook: "bi-facebook",
  linkedin: "bi-linkedin",
};

function socialUrl(network: SocialNetwork, handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  switch (network) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://www.tiktok.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${clean}`;
    default:
      return null;
  }
}

type ProfileSocialIconsProps = {
  profile: UserProfile;
};

export function ProfileSocialIcons({ profile }: ProfileSocialIconsProps) {
  return (
    <div
      className="profile-social-icons"
      role="list"
      aria-label="Redes sociales"
    >
      {SOCIAL_NETWORKS.map((network) => {
        const handle = profile.socials?.[network]?.trim();
        const active = Boolean(handle);
        const href = active ? socialUrl(network, handle!) : null;
        const label = SOCIAL_NETWORK_LABELS[network];

        if (href) {
          return (
            <a
              key={network}
              role="listitem"
              className="profile-social-icon is-active"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label}: @${handle!.replace(/^@/, "")}`}
              title={`@${handle!.replace(/^@/, "")}`}
            >
              <i className={`bi ${SOCIAL_ICONS[network]}`} aria-hidden="true" />
            </a>
          );
        }

        return (
          <span
            key={network}
            role="listitem"
            className="profile-social-icon is-disabled"
            aria-disabled="true"
            aria-label={`${label} no cargada`}
            title={`${label} no cargada`}
          >
            <i className={`bi ${SOCIAL_ICONS[network]}`} aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}
