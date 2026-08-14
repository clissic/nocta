import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { User } from "./models/User.js";
import { Venue } from "./models/Venue.js";
import { Promotion } from "./models/Promotion.js";
import { Presence } from "./models/Presence.js";

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

type DemoUser = {
  email: string;
  password: string;
  name: string;
  birthDate: string;
  gender: string;
  interestedIn: string[];
  lookingFor: ("citas" | "relacion" | "encuentros_casuales" | "amigos" | "networking")[];
  interests: (
    | "musica_electronica"
    | "reggaeton"
    | "techno"
    | "house"
    | "cocktails"
    | "baile"
    | "viajes"
    | "fitness"
  )[];
  workStatus: "estudiante" | "empleado" | "freelance" | "emprendedor";
  bio: string;
  heightCm: number;
  photoOffset: number;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: "sofia@nocta.app",
    password: "Demo1234!",
    name: "Sofía",
    birthDate: "1998-04-12",
    gender: "mujer",
    interestedIn: ["hombre", "mujer"],
    lookingFor: ["citas", "encuentros_casuales"],
    interests: ["musica_electronica", "techno", "baile", "cocktails"],
    workStatus: "empleado",
    bio: "Palermo nights. Techno y vermú.",
    heightCm: 168,
    photoOffset: 1,
  },
  {
    email: "mateo@nocta.app",
    password: "Demo1234!",
    name: "Mateo",
    birthDate: "1996-09-03",
    gender: "hombre",
    interestedIn: ["mujer"],
    lookingFor: ["relacion", "citas"],
    interests: ["house", "cocktails", "viajes", "fitness"],
    workStatus: "freelance",
    bio: "Diseñador. Busco buena conversación antes del after.",
    heightCm: 182,
    photoOffset: 0,
  },
  {
    email: "valentina@nocta.app",
    password: "Demo1234!",
    name: "Valentina",
    birthDate: "1999-11-21",
    gender: "mujer",
    interestedIn: ["hombre"],
    lookingFor: ["amigos", "citas"],
    interests: ["reggaeton", "baile", "viajes"],
    workStatus: "estudiante",
    bio: "Si hay reggaetón, estoy.",
    heightCm: 165,
    photoOffset: 5,
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
        active: true,
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
        profile: {
          name: demo.name,
          birthDate: new Date(demo.birthDate),
          heightCm: demo.heightCm,
          lookingFor: demo.lookingFor,
          photos,
          bio: demo.bio,
          interests: demo.interests,
          workStatus: demo.workStatus,
          gender: demo.gender,
          interestedIn: demo.interestedIn,
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

  console.log(
    "Usuarios demo (password Demo1234!): sofia@nocta.app, mateo@nocta.app, valentina@nocta.app — publicados en Niceto Club"
  );
}

/**
 * En Atlas el seed completo se omite si ya hay users: esto resincroniza las
 * cuentas demo/admin (verificación + password actual) sin tocar el resto.
 */
export async function ensureDemoAccounts() {
  const targets = [
    { email: config.adminEmail.toLowerCase(), password: config.adminPassword },
    ...DEMO_USERS.map((d) => ({
      email: d.email.toLowerCase(),
      password: d.password,
    })),
  ];

  let updated = 0;
  for (const target of targets) {
    const user = await User.findOne({ email: target.email });
    if (!user) continue;

    const passwordOk = user.passwordHash
      ? await bcrypt.compare(target.password, user.passwordHash)
      : false;

    if (!passwordOk) {
      user.passwordHash = await bcrypt.hash(target.password, 10);
    }
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    if (user.isModified()) {
      await user.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Cuentas demo/admin resincronizadas: ${updated}`);
  }
}
