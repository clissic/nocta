import "./env.js";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DAILY_LIKE_LIMIT } from "@nocta/shared";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import {
  api,
  createTestUser,
  createTestVenue,
  startE2E,
  stopE2E,
} from "./harness.js";

const PASSWORD = "Demo1234!";

type ErrBody = { error?: string; code?: string };
type AuthBody = {
  token?: string;
  code?: string;
  user?: { emailVerified?: boolean };
};
type PresenceBody = {
  presences?: Array<{ venueId?: string }>;
  maxPresences?: number;
  code?: string;
};
type FeedBody = {
  code?: string;
  cards?: Array<{ userId?: string }>;
};
type SwipeBody = {
  ok?: boolean;
  match?: { id: string } | null;
  code?: string;
  likeAllowance?: { unlimited?: boolean; remainingLikes?: number | null };
};
type MatchListBody = { matches?: Array<{ id: string }> };
type MessageListBody = { messages?: Array<{ body?: string }> };
type MessageBody = { message?: { body?: string } };

function as<T>(json: unknown): T {
  return json as T;
}

async function publish(token: string, venueId: string) {
  return api("/api/presence", {
    method: "POST",
    token,
    body: JSON.stringify({ venueId, hours: null }),
  });
}

async function grantPlan(
  userId: string,
  planId: "nocta_2am" | "nocta_4am" | "nocta_6am",
  extras: { boostsRemaining?: number; heartshotsRemaining?: number; remainingLikes?: number } = {}
) {
  await User.findByIdAndUpdate(userId, {
    $set: {
      premium: true,
      premiumPlanId: planId,
      premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      premiumSubscriptionStatus: "authorized",
      ...extras,
    },
  });
}

describe("producto", { concurrency: 1 }, () => {
  before(async () => {
    await startE2E();
  });

  after(async () => {
    await stopE2E();
  });

  it("auth: registro, login sin verificar y bloqueo de presencia", async () => {
    const email = `auth-${Date.now()}@nocta.test`;
    const registered = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD, name: "Ana" }),
    });
    assert.equal(registered.res.status, 201);
    const created = as<AuthBody>(registered.json);
    assert.equal(created.code, "EMAIL_NOT_VERIFIED");
    assert.equal(created.user?.emailVerified, false);
    assert.ok(created.token);

    const login = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    assert.equal(login.res.status, 403);
    assert.equal(as<ErrBody>(login.json).code, "EMAIL_NOT_VERIFIED");

    const presence = await api("/api/presence/me", { token: created.token });
    assert.equal(presence.res.status, 403);
    assert.equal(as<ErrBody>(presence.json).code, "EMAIL_NOT_VERIFIED");

    const wrong = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "OtraClave1!" }),
    });
    assert.equal(wrong.res.status, 401);
  });

  it("presencia: sin publicación no hay Discover; gratis es una sola; 6 A.M. llega a tres", async () => {
    const { token, user } = await createTestUser({
      email: `presence-${Date.now()}@nocta.test`,
      name: "Bruno",
    });
    const owner = await createTestUser({
      email: `owner-${Date.now()}@nocta.test`,
    });
    const venueA = await createTestVenue(owner.user._id.toString());
    const venueB = await Venue.create({
      name: "E2E Espacio B",
      type: "bar",
      address: "Calle 2",
      country: "Uruguay",
      city: "Montevideo",
      description: "Segundo",
      photos: [],
      active: true,
      ownerId: owner.user._id,
      location: { lat: -34.91, lng: -56.17 },
    });

    const feed = await api("/api/discover/feed", { token });
    assert.equal(feed.res.status, 400);
    assert.equal(as<FeedBody>(feed.json).code, "NO_PRESENCE");

    const first = await publish(token, venueA._id.toString());
    assert.equal(first.res.status, 201);
    const second = await publish(token, venueB._id.toString());
    assert.equal(second.res.status, 201);

    const mine = await api("/api/presence/me", { token });
    assert.equal(mine.res.status, 200);
    const listed = as<PresenceBody>(mine.json);
    assert.equal(listed.maxPresences, 1);
    assert.equal(listed.presences?.length, 1);
    assert.equal(listed.presences?.[0]?.venueId, venueB._id.toString());

    await grantPlan(user._id.toString(), "nocta_6am");
    const extraA = await Venue.create({
      name: "E2E Clone A",
      type: "pub",
      address: "Calle 3",
      country: "Uruguay",
      city: "Montevideo",
      description: "Clone",
      photos: [],
      active: true,
      ownerId: owner.user._id,
      location: { lat: -34.9, lng: -56.16 },
    });
    const extraB = await Venue.create({
      name: "E2E Clone B",
      type: "pub",
      address: "Calle 4",
      country: "Uruguay",
      city: "Montevideo",
      description: "Clone",
      photos: [],
      active: true,
      ownerId: owner.user._id,
      location: { lat: -34.9, lng: -56.16 },
    });
    // Ya hay una presencia (venue B). 6 A.M. suma hasta tres.
    assert.equal((await publish(token, venueA._id.toString())).res.status, 201);
    assert.equal((await publish(token, extraA._id.toString())).res.status, 201);
    const cloned = as<PresenceBody>(
      (await api("/api/presence/me", { token })).json
    );
    assert.equal(cloned.maxPresences, 3);
    assert.equal(cloned.presences?.length, 3);

    const blocked = await publish(token, extraB._id.toString());
    assert.equal(blocked.res.status, 409);
    assert.equal(as<ErrBody>(blocked.json).code, "PRESENCE_LIMIT");
  });

  it("swipe y match: pass no matchea, like mutuo sí, y el tope diario corta", async () => {
    const stamp = Date.now();
    const ada = await createTestUser({
      email: `ada-${stamp}@nocta.test`,
      name: "Ada",
      gender: "mujer",
      interestedIn: ["hombre"],
    });
    const leo = await createTestUser({
      email: `leo-${stamp}@nocta.test`,
      name: "Leo",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    const nico = await createTestUser({
      email: `nico-${stamp}@nocta.test`,
      name: "Nico",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    const owner = await createTestUser({
      email: `swipe-owner-${stamp}@nocta.test`,
    });
    const venue = await createTestVenue(owner.user._id.toString());
    const venueId = venue._id.toString();

    for (const person of [ada, leo, nico]) {
      const published = await publish(person.token, venueId);
      assert.equal(published.res.status, 201);
    }

    const deck = as<FeedBody>(
      (await api("/api/discover/feed", { token: ada.token })).json
    );
    const ids = (deck.cards ?? []).map((card) => card.userId);
    assert.ok(ids.includes(leo.user._id.toString()));
    assert.ok(ids.includes(nico.user._id.toString()));

    const passed = as<SwipeBody>(
      (
        await api("/api/discover/swipe", {
          method: "POST",
          token: ada.token,
          body: JSON.stringify({
            toUserId: nico.user._id.toString(),
            venueId,
            direction: "pass",
          }),
        })
      ).json
    );
    assert.equal(passed.ok, true);
    assert.equal(passed.match, null);

    const firstLike = await api("/api/discover/swipe", {
      method: "POST",
      token: ada.token,
      body: JSON.stringify({
        toUserId: leo.user._id.toString(),
        venueId,
        direction: "like",
      }),
    });
    assert.equal(firstLike.res.status, 200);
    assert.equal(as<SwipeBody>(firstLike.json).match, null);

    const secondLike = await api("/api/discover/swipe", {
      method: "POST",
      token: leo.token,
      body: JSON.stringify({
        toUserId: ada.user._id.toString(),
        venueId,
        direction: "like",
      }),
    });
    assert.equal(secondLike.res.status, 200);
    const matchId = as<SwipeBody>(secondLike.json).match?.id;
    assert.ok(matchId);

    const adaMatches = as<MatchListBody>(
      (await api("/api/matches", { token: ada.token })).json
    );
    assert.ok(adaMatches.matches?.some((match) => match.id === matchId));

    const sent = await api(`/api/matches/${matchId}/messages`, {
      method: "POST",
      token: ada.token,
      body: JSON.stringify({ body: "¿Nos vemos en la barra?" }),
    });
    assert.equal(sent.res.status, 201);
    assert.equal(
      as<MessageBody>(sent.json).message?.body,
      "¿Nos vemos en la barra?"
    );

    const read = as<MessageListBody>(
      (
        await api(`/api/matches/${matchId}/messages`, { token: leo.token })
      ).json
    );
    assert.equal(read.messages?.length, 1);

    const outsider = await api(`/api/matches/${matchId}/messages`, {
      token: nico.token,
    });
    assert.equal(outsider.res.status, 404);

    await User.findByIdAndUpdate(ada.user._id, {
      $set: { remainingLikes: 1, likesRechargeAt: null },
    });
    const sol = await createTestUser({
      email: `sol-${stamp}@nocta.test`,
      name: "Sol",
      gender: "mujer",
      interestedIn: ["hombre"],
    });
    const tomas = await createTestUser({
      email: `tomas-${stamp}@nocta.test`,
      name: "Tomás",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    assert.equal((await publish(sol.token, venueId)).res.status, 201);
    assert.equal((await publish(tomas.token, venueId)).res.status, 201);
    await User.findByIdAndUpdate(sol.user._id, {
      $set: { remainingLikes: 1, likesRechargeAt: null },
    });

    const allowed = await api("/api/discover/swipe", {
      method: "POST",
      token: sol.token,
      body: JSON.stringify({
        toUserId: tomas.user._id.toString(),
        venueId,
        direction: "like",
      }),
    });
    assert.equal(allowed.res.status, 200);
    assert.equal(
      as<SwipeBody>(allowed.json).likeAllowance?.remainingLikes,
      0
    );

    const extraTarget = await createTestUser({
      email: `ivo-${stamp}@nocta.test`,
      name: "Ivo",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    assert.equal((await publish(extraTarget.token, venueId)).res.status, 201);
    const exhausted = await api("/api/discover/swipe", {
      method: "POST",
      token: sol.token,
      body: JSON.stringify({
        toUserId: extraTarget.user._id.toString(),
        venueId,
        direction: "like",
      }),
    });
    assert.equal(exhausted.res.status, 429);
    assert.equal(as<ErrBody>(exhausted.json).code, "LIKES_EXHAUSTED");
    assert.equal(DAILY_LIKE_LIMIT, 50);
  });

  it("premium: Teleport desde 2 A.M.; Boost y Heartshot desde 4 A.M.; likes ilimitados", async () => {
    const stamp = Date.now();
    const free = await createTestUser({
      email: `free-${stamp}@nocta.test`,
      name: "Free",
    });
    const early = await createTestUser({
      email: `early-${stamp}@nocta.test`,
      name: "Early",
      gender: "mujer",
      interestedIn: ["hombre"],
    });
    const night = await createTestUser({
      email: `night-${stamp}@nocta.test`,
      name: "Night",
      gender: "mujer",
      interestedIn: ["hombre"],
    });
    const peer = await createTestUser({
      email: `peer-${stamp}@nocta.test`,
      name: "Peer",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    const owner = await createTestUser({
      email: `prem-owner-${stamp}@nocta.test`,
    });
    const venue = await createTestVenue(owner.user._id.toString());
    const venueId = venue._id.toString();

    const freeTeleport = await api("/api/me/settings", {
      method: "PATCH",
      token: free.token,
      body: JSON.stringify({ teleportMode: true }),
    });
    assert.equal(freeTeleport.res.status, 403);
    assert.equal(as<ErrBody>(freeTeleport.json).code, "PREMIUM_REQUIRED");

    await grantPlan(early.user._id.toString(), "nocta_2am", {
      remainingLikes: 0,
      boostsRemaining: 0,
      heartshotsRemaining: 0,
    });
    const earlyTeleport = await api("/api/me/settings", {
      method: "PATCH",
      token: early.token,
      body: JSON.stringify({ teleportMode: true }),
    });
    assert.equal(earlyTeleport.res.status, 200);

    const earlyBoost = await api("/api/premium/boost", {
      method: "POST",
      token: early.token,
      body: JSON.stringify({}),
    });
    assert.equal(earlyBoost.res.status, 403);
    assert.equal(as<ErrBody>(earlyBoost.json).code, "PLAN_REQUIRED");

    assert.equal((await publish(early.token, venueId)).res.status, 201);
    assert.equal((await publish(peer.token, venueId)).res.status, 201);
    const earlyShot = await api("/api/discover/swipe", {
      method: "POST",
      token: early.token,
      body: JSON.stringify({
        toUserId: peer.user._id.toString(),
        venueId,
        direction: "like",
        isHeartshot: true,
      }),
    });
    assert.equal(earlyShot.res.status, 403);
    assert.equal(as<ErrBody>(earlyShot.json).code, "PLAN_REQUIRED");

    const unlimited = await api("/api/discover/swipe", {
      method: "POST",
      token: early.token,
      body: JSON.stringify({
        toUserId: peer.user._id.toString(),
        venueId,
        direction: "like",
      }),
    });
    assert.equal(unlimited.res.status, 200);
    assert.equal(as<SwipeBody>(unlimited.json).likeAllowance?.unlimited, true);

    await grantPlan(night.user._id.toString(), "nocta_4am", {
      boostsRemaining: 1,
      heartshotsRemaining: 1,
    });
    const boost = await api("/api/premium/boost", {
      method: "POST",
      token: night.token,
      body: JSON.stringify({}),
    });
    assert.equal(boost.res.status, 200);
    assert.equal(
      as<{ boostsRemaining?: number }>(boost.json).boostsRemaining,
      0
    );

    const other = await createTestUser({
      email: `other-${stamp}@nocta.test`,
      name: "Other",
      gender: "hombre",
      interestedIn: ["mujer"],
    });
    assert.equal((await publish(night.token, venueId)).res.status, 201);
    assert.equal((await publish(other.token, venueId)).res.status, 201);
    const shot = await api("/api/discover/swipe", {
      method: "POST",
      token: night.token,
      body: JSON.stringify({
        toUserId: other.user._id.toString(),
        venueId,
        direction: "like",
        isHeartshot: true,
      }),
    });
    assert.equal(shot.res.status, 200);
    assert.equal(as<SwipeBody>(shot.json).ok, true);
  });

  it("denuncias: el historial muestra solo las propias", async () => {
    const stamp = Date.now();
    const ada = await createTestUser({
      email: `rep-ada-${stamp}@nocta.test`,
      name: "Ada",
    });
    const leo = await createTestUser({
      email: `rep-leo-${stamp}@nocta.test`,
      name: "Leo",
    });
    const nico = await createTestUser({
      email: `rep-nico-${stamp}@nocta.test`,
      name: "Nico",
    });

    const created = await api(`/api/users/${leo.user._id.toString()}/report`, {
      method: "POST",
      token: ada.token,
      body: JSON.stringify({ reason: "spam", details: "Mensajes repetidos" }),
    });
    assert.equal(created.res.status, 201);
    const reportId = as<{ report?: { id?: string } }>(created.json).report?.id;
    assert.ok(reportId);

    const mine = await api("/api/me/reports", { token: ada.token });
    assert.equal(mine.res.status, 200);
    const rows = as<{
      reports?: Array<{
        id: string;
        reportedName: string;
        reason: string;
        status: string;
      }>;
    }>(mine.json).reports;
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0]?.id, reportId);
    assert.equal(rows?.[0]?.reportedName, "Leo");
    assert.equal(rows?.[0]?.reason, "spam");
    assert.equal(rows?.[0]?.status, "open");

    const other = await api("/api/me/reports", { token: nico.token });
    assert.equal(other.res.status, 200);
    assert.equal(
      as<{ reports?: unknown[] }>(other.json).reports?.length,
      0
    );

    const hidden = await api(`/api/me/reports/${reportId}`, {
      token: nico.token,
    });
    assert.equal(hidden.res.status, 404);
  });
});
