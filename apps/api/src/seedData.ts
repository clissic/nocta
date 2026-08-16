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

  const venuesData = [
    {
      name: "Niceto Club",
      type: "boliche" as const,
      address: "Niceto Vega 5510, Palermo",
      city: "Buenos Aires",
      description: "Club icónico de Palermo con electrónica y shows en vivo.",
      photos: [
        "https://images.unsplash.com/photo-1571266028247-e6734c9d1d0c?w=800",
      ],
    },
    {
      name: "Frank's Bar",
      type: "bar" as const,
      address: "Arévalo 1443, Palermo",
      city: "Buenos Aires",
      description: "Speakeasy de cócteles clásicos.",
      photos: [
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
      ],
    },
    {
      name: "The Temple Bar",
      type: "pub" as const,
      address: "Av. Corrientes 1234",
      city: "Buenos Aires",
      description: "Pub irlandés con birra y fútbol.",
      photos: [
        "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800",
      ],
    },
    {
      name: "Patagonia Brew",
      type: "cerveceria" as const,
      address: "Honduras 5678, Palermo",
      city: "Buenos Aires",
      description: "Cerveza artesanal y tablas.",
      photos: [
        "https://images.unsplash.com/photo-1436076863939-06870fe779c2?w=800",
      ],
    },
    {
      name: "Rooftop Privado Recoleta",
      type: "fiesta_privada" as const,
      address: "Recoleta (ubicación al confirmar)",
      city: "Buenos Aires",
      description: "Fiesta privada en rooftop. Cupos limitados.",
      photos: [
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
      ],
    },
    {
      name: "Luna Park — Noche Live",
      type: "concierto" as const,
      address: "Av. Eduardo Madero 470",
      city: "Buenos Aires",
      description: "Concierto en arena. Doors 20:00.",
      photos: [
        "https://images.unsplash.com/photo-1459749411175-04bf529277ea?w=800",
      ],
    },
    {
      name: "BA Electronic Festival",
      type: "festival" as const,
      address: "Costanera Sur",
      city: "Buenos Aires",
      description: "Festival al aire libre con stages múltiples.",
      photos: [
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
      ],
    },
    {
      name: "Crobar",
      type: "boliche" as const,
      address: "Paseo de la Infanta Isabel 555",
      city: "Buenos Aires",
      description: "Megadiscoteca frente al Río.",
      photos: [
        "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
      ],
    },
    {
      name: "Bahrein",
      type: "boliche" as const,
      address: "Lavalle 345",
      city: "Buenos Aires",
      description: "House y techno en Microcentro.",
      photos: [
        "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800",
      ],
    },
    {
      name: "Harrison Speakeasy",
      type: "bar" as const,
      address: "Malabia 1764, Palermo",
      city: "Buenos Aires",
      description: "Cócteles ocultos detrás de una librería.",
      photos: [
        "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800",
      ],
    },
    {
      name: "The Shamrock",
      type: "pub" as const,
      address: "Rodríguez Peña 1379",
      city: "Buenos Aires",
      description: "Pub irlandés con happy hour y dardos.",
      photos: [
        "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800",
      ],
    },
    {
      name: "Antares Palermo",
      type: "cerveceria" as const,
      address: "Arieta 1449",
      city: "Buenos Aires",
      description: "Cerveza de fábrica y burgers.",
      photos: [
        "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=800",
      ],
    },
    {
      name: "After Privado Belgrano",
      type: "fiesta_privada" as const,
      address: "Belgrano (por invitación)",
      city: "Buenos Aires",
      description: "After íntimo hasta el amanecer.",
      photos: [
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",
      ],
    },
    {
      name: "Movistar Arena — Live",
      type: "concierto" as const,
      address: "Humboldt 450",
      city: "Buenos Aires",
      description: "Shows internacionales en arena.",
      photos: [
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800",
      ],
    },
    {
      name: "Dock Sud Open Air",
      type: "festival" as const,
      address: "Dock Sud",
      city: "Buenos Aires",
      description: "Festival industrial con lineup local.",
      photos: [
        "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800",
      ],
    },
  ];

  const venueCoords: Record<string, { lat: number; lng: number }> = {
    "Niceto Club": { lat: -34.58755, lng: -58.43085 },
    "Frank's Bar": { lat: -34.5852, lng: -58.4336 },
    "The Temple Bar": { lat: -34.6037, lng: -58.3915 },
    "Patagonia Brew": { lat: -34.5889, lng: -58.4262 },
    "Rooftop Privado Recoleta": { lat: -34.5875, lng: -58.3925 },
    "Luna Park — Noche Live": { lat: -34.6033, lng: -58.3683 },
    "BA Electronic Festival": { lat: -34.6167, lng: -58.3583 },
    Crobar: { lat: -34.5717, lng: -58.4033 },
    Bahrein: { lat: -34.6031, lng: -58.3782 },
    "Harrison Speakeasy": { lat: -34.5881, lng: -58.4301 },
    "The Shamrock": { lat: -34.5992, lng: -58.3931 },
    "Antares Palermo": { lat: -34.5868, lng: -58.4322 },
    "After Privado Belgrano": { lat: -34.5627, lng: -58.4584 },
    "Movistar Arena — Live": { lat: -34.575, lng: -58.439 },
    "Dock Sud Open Air": { lat: -34.655, lng: -58.345 },
  };

  const venues = [];
  for (const data of venuesData) {
    const location = venueCoords[data.name];
    const venue = await Venue.findOneAndUpdate(
      { name: data.name },
      { ...data, location, active: true },
      { upsert: true, new: true }
    );
    venues.push(venue);

    await Promotion.findOneAndUpdate(
      { venueId: venue._id, title: "Promo Nocta" },
      {
        venueId: venue._id,
        title: "Promo Nocta",
        description: `Entrada con descuento para usuarios Nocta en ${venue.name}.`,
        priceUyu: 350,
        active: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );
  }

  const niceto = venues.find((v) => v.name === "Niceto Club")!;

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
      venueId: niceto._id,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      status: "active",
    });
  }

  const mateo = await User.findOne({ email: "mateo@nocta.app" });
  const sofia = await User.findOne({ email: "sofia@nocta.app" });
  const valentina = await User.findOne({ email: "valentina@nocta.app" });
  const franks = venues.find((v) => v.name === "Frank's Bar");
  const crobar = venues.find((v) => v.name === "Crobar");

  const nicetoPromo = await Promotion.findOne({
    venueId: niceto._id,
    title: "Promo Nocta",
  });
  if (mateo && nicetoPromo) {
    const existing = await PromoPurchase.findOne({
      userId: mateo._id,
      promotionId: nicetoPromo._id,
    });
    if (!existing) {
      await PromoPurchase.create({
        userId: mateo._id,
        venueId: niceto._id,
        promotionId: nicetoPromo._id,
        code: randomBytes(16).toString("hex"),
        title: nicetoPromo.title,
        priceUyu: nicetoPromo.priceUyu ?? 350,
        status: "valid",
        purchasedAt: new Date(),
        validUntil:
          nicetoPromo.validUntil ??
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
        targetId: niceto._id.toString(),
      },
      {
        followerId: mateo._id.toString(),
        targetType: "venue",
        targetId: niceto._id.toString(),
      },
      {
        followerId: valentina._id.toString(),
        targetType: "venue",
        targetId: niceto._id.toString(),
      },
    ];
    if (franks) {
      followPairs.push({
        followerId: mateo._id.toString(),
        targetType: "venue",
        targetId: franks._id.toString(),
      });
    }
    if (crobar) {
      followPairs.push({
        followerId: valentina._id.toString(),
        targetType: "venue",
        targetId: crobar._id.toString(),
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
    { venueId: niceto._id, title: "Noche electrónica este sábado" },
    {
      venueId: niceto._id,
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
  if (franks) {
    await VenueNews.findOneAndUpdate(
      { venueId: franks._id, title: "Happy hour de cócteles" },
      {
        venueId: franks._id,
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
      venue: niceto,
      rating: 5,
      body: "La pista no para. Ideal para descubrir gente nueva en Nocta.",
    });
  }
  if (valentina && franks) {
    reviewSeeds.push({
      user: valentina,
      venue: franks,
      rating: 4,
      body: "Cócteles impecables y ambiente íntimo. Volvería.",
    });
  }
  if (sofia && crobar) {
    reviewSeeds.push({
      user: sofia,
      venue: crobar,
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
    "Usuarios demo (password Demo1234!): sofia@nocta.app, mateo@nocta.app, valentina@nocta.app — publicados en Niceto Club (follows, reseñas y noticias para Muro)"
  );
}

/**
 * En Atlas el seed completo se omite si ya hay users: esto resincroniza las
 * cuentas demo/admin (verificación + password), refresca presencia en Niceto
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

  const niceto = await Venue.findOne({ name: "Niceto Club" });
  if (niceto) {
    const endsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    for (const userId of demoIds) {
      await Presence.updateMany(
        { userId, status: "active" },
        { $set: { status: "revoked" } }
      );
      await Presence.create({
        userId,
        venueId: niceto._id,
        startsAt: new Date(),
        endsAt,
        status: "active",
      });
    }
    console.log(
      `Presencia demo renovada en Niceto Club (${demoIds.length} users, 48h)`
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
