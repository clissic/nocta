import { Ionicons } from "@expo/vector-icons";
import {
  DRINKING_LABELS,
  EDUCATION_LEVEL_LABELS,
  FITNESS_LABELS,
  INTEREST_LABELS,
  LANGUAGE_LABELS,
  LOOKING_FOR_LABELS,
  PETS_LABELS,
  SEXUAL_ORIENTATION_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_LABELS,
  WORK_STATUS_LABELS,
  ZODIAC_INSIGHTS,
  ZODIAC_LABELS,
  type DiscoverCard,
  type Drinking,
  type EducationLevel,
  type Fitness,
  type Interest,
  type Language,
  type LookingFor,
  type Pets,
  type SexualOrientation,
  type WorkStatus,
  type ZodiacSign,
} from "@nocta/shared";

type IonName = keyof typeof Ionicons.glyphMap;

export type PhotoExtra = {
  icon: IonName;
  title: string;
  body: string;
};

/** Dato que acompaña cada foto del deck. Misma tabla que la web (`photoExtra`). */
export function photoExtra(
  card: DiscoverCard,
  photoIndex: number
): PhotoExtra | null {
  const profile = card.profile;
  switch (photoIndex) {
    case 0: {
      const looking = (profile.lookingFor ?? [])
        .map((l) => LOOKING_FOR_LABELS[l as LookingFor] ?? l)
        .filter(Boolean);
      if (!looking.length) return null;
      return { icon: "search", title: "Busca", body: looking.join(" · ") };
    }
    case 1: {
      const bio = profile.bio?.trim();
      if (!bio) return null;
      return { icon: "chatbubble-ellipses-outline", title: "Sobre mí", body: bio };
    }
    case 2: {
      const interests = (profile.interests ?? [])
        .slice(0, 10)
        .map((i) => INTEREST_LABELS[i as Interest] ?? i)
        .filter(Boolean);
      if (!interests.length) return null;
      return { icon: "sparkles", title: "Gustos", body: interests.join(" · ") };
    }
    case 3:
      if (!profile.heightCm) return null;
      return {
        icon: "resize-outline",
        title: "Altura",
        body: `${profile.heightCm} cm`,
      };
    case 4: {
      const work = [
        profile.workStatus
          ? (WORK_STATUS_LABELS[profile.workStatus as WorkStatus] ??
            profile.workStatus)
          : null,
        profile.jobTitle,
        profile.company,
        profile.studiedAt ? `Estudió en ${profile.studiedAt}` : null,
        profile.educationLevel
          ? (EDUCATION_LEVEL_LABELS[profile.educationLevel as EducationLevel] ??
            profile.educationLevel)
          : null,
      ].filter(Boolean);
      if (!work.length) return null;
      return {
        icon: "briefcase-outline",
        title: "Trabajo",
        body: work.join(" · "),
      };
    }
    case 5: {
      const country = profile.livesIn?.country?.trim();
      const city = profile.livesIn?.city?.trim();
      if (!country || !city) return null;
      return {
        icon: "location-outline",
        title: "Vive en",
        body: `${country}, ${city}`,
      };
    }
    case 6: {
      const identity = [
        profile.sexualOrientation
          ? (SEXUAL_ORIENTATION_LABELS[
              profile.sexualOrientation as SexualOrientation
            ] ?? profile.sexualOrientation)
          : null,
        ...(profile.languages ?? []).map(
          (language) => LANGUAGE_LABELS[language as Language] ?? language
        ),
      ].filter(Boolean);
      if (!identity.length) return null;
      return {
        icon: "language-outline",
        title: "Orientación e idiomas",
        body: identity.join(" · "),
      };
    }
    case 7: {
      if (!profile.zodiac) return null;
      const zodiac = profile.zodiac as ZodiacSign;
      const insight = ZODIAC_INSIGHTS[zodiac];
      const compatible = insight.compatibleWith
        .map((sign) => ZODIAC_LABELS[sign])
        .join(" y ");
      return {
        icon: "moon-outline",
        title: "Zodíaco",
        body: `${ZODIAC_LABELS[zodiac]}\n${insight.traits}\nEspecialmente compatible con ${compatible}`,
      };
    }
    case 8: {
      const lifestyle = [
        profile.pets
          ? `Mascotas: ${PETS_LABELS[profile.pets as Pets] ?? profile.pets}`
          : null,
        profile.drinking
          ? `Bebidas: ${DRINKING_LABELS[profile.drinking as Drinking] ?? profile.drinking}`
          : null,
        profile.fitness
          ? `Fitness: ${FITNESS_LABELS[profile.fitness as Fitness] ?? profile.fitness}`
          : null,
      ].filter(Boolean);
      if (!lifestyle.length) return null;
      return {
        icon: "pulse-outline",
        title: "Estilo de vida",
        body: lifestyle.join(" · "),
      };
    }
    case 9: {
      const networks = SOCIAL_NETWORKS.map((network) => {
        const handle = profile.socials?.[network]?.trim();
        return handle
          ? `${SOCIAL_NETWORK_LABELS[network]}: @${handle.replace(/^@/, "")}`
          : null;
      }).filter(Boolean);
      if (!networks.length) return null;
      return {
        icon: "at",
        title: "Redes sociales",
        body: networks.join(" · "),
      };
    }
    default:
      return null;
  }
}
