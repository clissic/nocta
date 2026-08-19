import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import type { Interest, LookingFor, WorkStatus } from "@nocta/shared";
import { config } from "./config.js";
import { User } from "./models/User.js";
import { Venue } from "./models/Venue.js";
import { Promotion } from "./models/Promotion.js";
import { PromoPurchase } from "./models/PromoPurchase.js";
import { Presence } from "./models/Presence.js";
import { VenueNews } from "./models/VenueNews.js";
import { VenueReview } from "./models/VenueReview.js";
import { Swipe } from "./models/Swipe.js";
import { Match } from "./models/Match.js";
import { Message } from "./models/Message.js";
import { followTarget } from "./utils/follows.js";
import { recomputeVenueRatings } from "./utils/venueRatings.js";
import { recordActivity } from "./utils/activity.js";
import { Follow } from "./models/Follow.js";
import { UserPost } from "./models/UserPost.js";
import { ActivityEvent } from "./models/ActivityEvent.js";
import { VenueRequest } from "./models/VenueRequest.js";
import {
  PILOT_CITY,
  PILOT_DEMO_VENUE_NAME,
  PILOT_VENUES,
  venuePhotoUrl,
} from "./pilotVenues.js";

const DEMO_PHOTOS = [
  "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=600",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600",
  "https://images.unsplash.com/photo-1524504388940-b1c17226555e?w=600",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600",
];

/** Emails de cuentas demo usadas en Discover / seed. */
export const DEMO_USER_EMAILS = [
  "sofia@nocta.app",
  "mateo@nocta.app",
  "valentina@nocta.app",
] as const;

export function isDemoUserEmail(email?: string | null) {
  if (!email) return false;
  return (DEMO_USER_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

type DemoUser = {
  email: string;
  password: string;
  name: string;
  birthDate: string;
  gender: string;
  interestedIn: string[];
  lookingFor: LookingFor;
  interests: Interest[];
  workStatus: Extract<
    WorkStatus,
    "estudiante" | "empleado" | "freelance" | "emprendedor"
  >;
  bio: string;
  heightCm: number;
  photoOffset: number;
  premium?: boolean;
  livesIn: { country: string; city: string };
  sexualOrientation: "heterosexual" | "bisexual" | "gay";
  languages: ("espanol" | "ingles" | "portugues")[];
  zodiac: "aries" | "leo" | "escorpion";
  educationLevel: "universitario" | "terciario" | "secundaria";
  pets: "perro" | "gato" | "no_tengo";
  drinking: "social" | "ocasiones" | "no_tomo";
  fitness: "activo" | "a_veces" | "gym_regular";
  socials?: { instagram?: string };
  jobTitle?: string;
  company?: string;
  studiedAt?: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: "sofia@nocta.app",
    password: "Demo1234!",
    name: "Sofía",
    birthDate: "1998-04-12",
    gender: "mujer",
    interestedIn: ["hombre", "mujer"],
    lookingFor: "citas",
    interests: ["cara_a_cara", "musica_electronica", "techno", "baile", "cocktails", "deep_talks"],
    workStatus: "empleado",
    bio: "Palermo nights. Techno y vermú.",
    heightCm: 168,
    photoOffset: 1,
    premium: true,
    livesIn: {
      country: "Argentina",
      city: "Buenos Aires",
    },
    sexualOrientation: "bisexual",
    languages: ["espanol", "ingles"],
    zodiac: "aries",
    educationLevel: "universitario",
    pets: "gato",
    drinking: "social",
    fitness: "a_veces",
    socials: { instagram: "sofia.nocta" },
    jobTitle: "Productora",
    company: "Night Lab",
    studiedAt: "UBA",
  },
  {
    email: "mateo@nocta.app",
    password: "Demo1234!",
    name: "Mateo",
    birthDate: "1996-09-03",
    gender: "hombre",
    interestedIn: ["mujer"],
    lookingFor: "relacion",
    interests: ["por_mensaje", "chat_nocturno", "house", "cocktails", "viajes", "fitness"],
    workStatus: "freelance",
    bio: "Diseñador. Busco buena conversación antes del after.",
    heightCm: 182,
    photoOffset: 0,
    livesIn: {
      country: "Uruguay",
      city: "Montevideo",
    },
    sexualOrientation: "heterosexual",
    languages: ["espanol", "ingles", "portugues"],
    zodiac: "leo",
    educationLevel: "terciario",
    pets: "perro",
    drinking: "ocasiones",
    fitness: "gym_regular",
    socials: { instagram: "mateo.design" },
    jobTitle: "Diseñador",
    company: "Freelance",
    studiedAt: "ORT",
  },
  {
    email: "valentina@nocta.app",
    password: "Demo1234!",
    name: "Valentina",
    birthDate: "1999-11-21",
    gender: "mujer",
    interestedIn: ["hombre"],
    lookingFor: "amigos",
    interests: ["por_llamada", "memes_y_reacciones", "reggaeton", "baile", "viajes", "energy_match"],
    workStatus: "estudiante",
    bio: "Si hay reggaetón, estoy.",
    heightCm: 165,
    photoOffset: 5,
    livesIn: {
      country: "Uruguay",
      city: "Montevideo",
    },
    sexualOrientation: "heterosexual",
    languages: ["espanol"],
    zodiac: "escorpion",
    educationLevel: "secundaria",
    pets: "no_tengo",
    drinking: "social",
    fitness: "activo",
    studiedAt: "UTU",
  },
];

async function deleteVenueDependents(venueIds: Types.ObjectId[]) {
  if (venueIds.length === 0) return;
  await Promise.all([
    Presence.deleteMany({ venueId: { $in: venueIds } }),
    VenueReview.deleteMany({ venueId: { $in: venueIds } }),
    VenueNews.deleteMany({ venueId: { $in: venueIds } }),
    Promotion.deleteMany({ venueId: { $in: venueIds } }),
    PromoPurchase.deleteMany({ venueId: { $in: venueIds } }),
    Swipe.deleteMany({ venueId: { $in: venueIds } }),
    Follow.deleteMany({ targetType: "venue", targetId: { $in: venueIds } }),
    UserPost.deleteMany({ venueId: { $in: venueIds } }),
    ActivityEvent.deleteMany({ venueId: { $in: venueIds } }),
    VenueRequest.updateMany(
      { venueId: { $in: venueIds } },
      { $unset: { venueId: 1 } }
    ),
  ]);
  const matches = await Match.find({ venueId: { $in: venueIds } }).select("_id");
  const matchIds = matches.map((m) => m._id);
  if (matchIds.length > 0) {
    await Message.deleteMany({ matchId: { $in: matchIds } });
    await Match.deleteMany({ _id: { $in: matchIds } });
  }
  await Venue.deleteMany({ _id: { $in: venueIds } });
}

/** Reemplaza el catálogo BA por los Espacios de Montevideo. No pisa ownerId. */
export async function syncPilotVenues() {
  const keptNames = new Set(PILOT_VENUES.map((item) => item.name));
  const stale = await Venue.find({ name: { $nin: [...keptNames] } }).select(
    "_id name"
  );
  if (stale.length > 0) {
    await deleteVenueDependents(stale.map((v) => v._id));
    console.log(
      `Catálogo piloto: ${stale.length} Espacios anteriores eliminados`
    );
  }

  const venues = [];
  for (const item of PILOT_VENUES) {
    const existing = await Venue.findOne({ name: item.name });
    const payload = {
      name: item.name,
      type: item.type,
      address: item.address,
      city: PILOT_CITY,
      photos: [venuePhotoUrl(item.name)],
      location: item.location,
      active: true,
    };
    const venue = existing
      ? await Venue.findByIdAndUpdate(
          existing._id,
          { $set: payload },
          { new: true }
        )
      : await Venue.create(payload);
    if (venue) venues.push(venue);
  }
  console.log(
    `Catálogo piloto: ${venues.length} Espacios en ${PILOT_CITY}`
  );
  return venues;
}

export async function seedDemoData() {
  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await User.findOneAndUpdate(
    { email: config.adminEmail },
    {
      email: config.adminEmail,
      passwordHash,
      role: "admin",
      profileComplete: true,
      emailVerified: true,
      profile: {
        name: "Admin Nocta",
        birthDate: new Date("1990-01-01"),
        lookingFor: ["networking"],
        photos: DEMO_PHOTOS.slice(0, 4),
        interests: ["musica_electronica", "cocktails"],
      },
    },
    { upsert: true, new: true }
  );

  const venues = await syncPilotVenues();
  const jackson = venues.find((v) => v.name === PILOT_DEMO_VENUE_NAME)!;

  await Promotion.findOneAndUpdate(
    { venueId: jackson._id, title: "Promo Nocta" },
    {
      venueId: jackson._id,
      title: "Promo Nocta",
      description: `Entrada con descuento para usuarios Nocta en ${jackson.name}.`,
      priceUyu: 350,
      active: true,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    { upsert: true }
  );

  for (const demo of DEMO_USERS) {
    const hash = await bcrypt.hash(demo.password, 10);
    const photos = [
      DEMO_PHOTOS[demo.photoOffset % DEMO_PHOTOS.length],
      DEMO_PHOTOS[(demo.photoOffset + 1) % DEMO_PHOTOS.length],
      DEMO_PHOTOS[(demo.photoOffset + 2) % DEMO_PHOTOS.length],
      DEMO_PHOTOS[(demo.photoOffset + 3) % DEMO_PHOTOS.length],
    ];

    const user = await User.findOneAndUpdate(
      { email: demo.email },
      {
        email: demo.email,
        passwordHash: hash,
        role: "user",
        profileComplete: true,
        emailVerified: true,
        premium: Boolean(demo.premium),
        profile: {
          name: demo.name,
          birthDate: new Date(demo.birthDate),
          heightCm: demo.heightCm,
          lookingFor: [demo.lookingFor],
          photos,
          bio: demo.bio,
          interests: demo.interests,
          workStatus: demo.workStatus,
          gender: demo.gender,
          interestedIn: demo.interestedIn,
          livesIn: demo.livesIn,
          sexualOrientation: demo.sexualOrientation,
          languages: demo.languages,
          zodiac: demo.zodiac,
          educationLevel: demo.educationLevel,
          pets: demo.pets,
          drinking: demo.drinking,
          fitness: demo.fitness,
          socials: demo.socials,
          jobTitle: demo.jobTitle,
          company: demo.company,
          studiedAt: demo.studiedAt,
        },
      },
      { upsert: true, new: true }
    );

    await Presence.updateMany(
      { userId: user._id, status: "active" },
      { $set: { status: "revoked" } }
    );

    await Presence.create({
      userId: user._id,
      venueId: jackson._id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: "active",
    });
  }

  const mateo = await User.findOne({ email: "mateo@nocta.app" });
  const sofia = await User.findOne({ email: "sofia@nocta.app" });
  const valentina = await User.findOne({ email: "valentina@nocta.app" });
  const malafama = venues.find((v) => v.name === "Malafama");
  const volveMiNegra = venues.find((v) => v.name === "Volvé Mi Negra");

  const jacksonPromo = await Promotion.findOne({
    venueId: jackson._id,
    title: "Promo Nocta",
  });
  if (mateo && jacksonPromo) {
    const existing = await PromoPurchase.findOne({
      userId: mateo._id,
      promotionId: jacksonPromo._id,
    });
    if (!existing) {
      await PromoPurchase.create({
        userId: mateo._id,
        venueId: jackson._id,
        promotionId: jacksonPromo._id,
        code: randomBytes(16).toString("hex"),
        title: jacksonPromo.title,
        priceUyu: jacksonPromo.priceUyu ?? 350,
        status: "valid",
        purchasedAt: new Date(),
        validUntil:
          jacksonPromo.validUntil ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
  }

  // Follows user↔user + venues (para Muro: news/promos + actividad)
  if (sofia && mateo && valentina) {
    const followPairs: Array<{
      followerId: string;
      targetType: "user" | "venue";
      targetId: string;
    }> = [
      {
        followerId: sofia._id.toString(),
        targetType: "user",
        targetId: mateo._id.toString(),
      },
      {
        followerId: sofia._id.toString(),
        targetType: "user",
        targetId: valentina._id.toString(),
      },
      {
        followerId: mateo._id.toString(),
        targetType: "user",
        targetId: sofia._id.toString(),
      },
      {
        followerId: sofia._id.toString(),
        targetType: "venue",
        targetId: jackson._id.toString(),
      },
      {
        followerId: mateo._id.toString(),
        targetType: "venue",
        targetId: jackson._id.toString(),
      },
      {
        followerId: valentina._id.toString(),
        targetType: "venue",
        targetId: jackson._id.toString(),
      },
    ];
    if (malafama) {
      followPairs.push({
        followerId: mateo._id.toString(),
        targetType: "venue",
        targetId: malafama._id.toString(),
      });
    }
    if (volveMiNegra) {
      followPairs.push({
        followerId: valentina._id.toString(),
        targetType: "venue",
        targetId: volveMiNegra._id.toString(),
      });
    }

    for (const pair of followPairs) {
      const result = await followTarget(pair);
      if (
        "ok" in result &&
        result.created &&
        pair.targetType === "venue"
      ) {
        const venueName =
          venues.find((v) => v._id.toString() === pair.targetId)?.name ??
          "Espacio";
        await recordActivity({
          actorId: pair.followerId,
          type: "venue_followed",
          venueId: pair.targetId,
          payload: { venueName },
        });
      }
    }
  }

  await VenueNews.findOneAndUpdate(
    { venueId: jackson._id, title: "Noche electrónica este sábado" },
    {
      venueId: jackson._id,
      title: "Noche electrónica este sábado",
      body: "Lineup confirmado desde las 00:00. Traé tu vibe Nocta.",
      photos: [
        "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=800",
      ],
      publishedAt: new Date(),
      active: true,
    },
    { upsert: true }
  );
  if (malafama) {
    await VenueNews.findOneAndUpdate(
      { venueId: malafama._id, title: "Happy hour de cócteles" },
      {
        venueId: malafama._id,
        title: "Happy hour de cócteles",
        body: "De 19 a 21 hs: 2x1 en clásicos. Ideal para arrancar la noche.",
        photos: [
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
        ],
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        active: true,
      },
      { upsert: true }
    );
  }

  // Reseñas demo (1 por user×espacio) + actividad
  const reviewSeeds: Array<{
    user: typeof sofia;
    venue: (typeof venues)[0];
    rating: number;
    body: string;
  }> = [];
  if (mateo) {
    reviewSeeds.push({
      user: mateo,
      venue: jackson,
      rating: 5,
      body: "La pista no para. Ideal para descubrir gente nueva en Nocta.",
    });
  }
  if (valentina && malafama) {
    reviewSeeds.push({
      user: valentina,
      venue: malafama,
      rating: 4,
      body: "Cócteles impecables y ambiente íntimo. Volvería.",
    });
  }
  if (sofia && volveMiNegra) {
    reviewSeeds.push({
      user: sofia,
      venue: volveMiNegra,
      rating: 4,
      body: "Energía alta y buena vibra. Un clásico.",
    });
  }

  for (const seed of reviewSeeds) {
    if (!seed.user) continue;
    const existing = await VenueReview.findOne({
      venueId: seed.venue._id,
      userId: seed.user._id,
    });
    let review = existing;
    const isNew = !existing;
    if (existing) {
      existing.rating = seed.rating;
      existing.body = seed.body;
      existing.photos = [];
      existing.active = true;
      review = await existing.save();
    } else {
      review = await VenueReview.create({
        venueId: seed.venue._id,
        userId: seed.user._id,
        rating: seed.rating,
        body: seed.body,
        photos: [],
        active: true,
      });
    }
    await recomputeVenueRatings(seed.venue._id.toString());
    if (isNew && review) {
      await recordActivity({
        actorId: seed.user._id.toString(),
        type: "venue_review_created",
        venueId: seed.venue._id.toString(),
        reviewId: review._id.toString(),
        payload: {
          rating: review.rating,
          body: review.body,
          photos: [],
          venueName: seed.venue.name,
        },
      });
    }
  }

  console.log(
    "Usuarios demo (password Demo1234!): sofia@nocta.app, mateo@nocta.app, valentina@nocta.app — publicados en Jackson Bar (follows, reseñas y noticias para Muro)"
  );
}

/**
 * En Atlas el seed completo se omite si ya hay users: esto resincroniza las
 * cuentas demo/admin (verificación + password), refresca presencia en Jackson Bar
 * y limpia swipes/matches que involucren demos para que vuelvan al Discover.
 */
export async function ensureDemoAccounts() {
  const targets = [
    {
      email: config.adminEmail.toLowerCase(),
      password: config.adminPassword,
      premium: false,
    },
    ...DEMO_USERS.map((d) => ({
      email: d.email.toLowerCase(),
      password: d.password,
      premium: Boolean(d.premium),
    })),
  ];

  let updated = 0;
  const demoIds: Types.ObjectId[] = [];

  for (const target of targets) {
    const user = await User.findOne({ email: target.email });
    if (!user) continue;

    if (isDemoUserEmail(user.email)) {
      demoIds.push(user._id);
    }

    const passwordOk = user.passwordHash
      ? await bcrypt.compare(target.password, user.passwordHash)
      : false;

    if (!passwordOk) {
      user.passwordHash = await bcrypt.hash(target.password, 10);
    }
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.premium = target.premium;

    if (user.isModified()) {
      await user.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Cuentas demo/admin resincronizadas: ${updated}`);
  }

  if (demoIds.length === 0) return;

  const jacksonBar = await Venue.findOne({ name: PILOT_DEMO_VENUE_NAME });
  if (jacksonBar) {
    const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    for (const userId of demoIds) {
      await Presence.updateMany(
        { userId, status: "active" },
        { $set: { status: "revoked" } }
      );
      await Presence.create({
        userId,
        venueId: jacksonBar._id,
        startsAt: new Date(),
        endsAt,
        status: "active",
      });
    }
    console.log(
      `Presencia demo renovada en ${PILOT_DEMO_VENUE_NAME} (${demoIds.length} users, 48h)`
    );
  }

  const swipeResult = await Swipe.deleteMany({
    $or: [{ fromUserId: { $in: demoIds } }, { toUserId: { $in: demoIds } }],
  });
  const demoMatches = await Match.find({ users: { $in: demoIds } }).select(
    "_id"
  );
  const matchIds = demoMatches.map((m) => m._id);
  if (matchIds.length > 0) {
    await Message.deleteMany({ matchId: { $in: matchIds } });
    await Match.deleteMany({ _id: { $in: matchIds } });
  }
  if ((swipeResult.deletedCount ?? 0) > 0 || matchIds.length > 0) {
    console.log(
      `Discover demo limpio: ${swipeResult.deletedCount ?? 0} swipes, ${matchIds.length} matches`
    );
  }
}

/** Deja una sola opción en `profile.lookingFor` (la de índice 0). */
export async function normalizeLookingForSingleChoice() {
  const result = await User.updateMany(
    { "profile.lookingFor.1": { $exists: true } },
    [{ $set: { "profile.lookingFor": { $slice: ["$profile.lookingFor", 1] } } }]
  );
  const n = result.modifiedCount ?? 0;
  if (n > 0) {
    console.log(`lookingFor normalizado a 1 opción: ${n} usuarios`);
  }
}
