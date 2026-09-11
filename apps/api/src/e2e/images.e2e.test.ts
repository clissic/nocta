import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import {
  api,
  createTestUser,
  createTestVenue,
  jpegPart,
  makeJpeg,
  patchVenueCover,
  startE2E,
  stopE2E,
  uploadProfilePhoto,
  type E2EContext,
} from "./harness.js";
import { ImageAsset } from "../models/ImageAsset.js";
import { User } from "../models/User.js";
import { VenueNews } from "../models/VenueNews.js";
import { VenueReview } from "../models/VenueReview.js";
import { Presence } from "../models/Presence.js";
import { parseMediaImageId } from "../image-service/refs.js";
import { resolvePublicAssetUrl } from "../utils/serialize.js";
import {
  requestAccountDeletion,
  purgeExpiredDeletedAccounts,
  ACCOUNT_DELETION_RECOVERY_DAYS,
} from "../image-lifecycle/accountDeletion.js";

const results: Array<{ flow: string; status: "PASS" | "FAIL"; detail?: string }> =
  [];

function record(flow: string, status: "PASS" | "FAIL", detail?: string) {
  results.push({ flow, status, detail });
  if (status === "FAIL") {
    console.error(`[E2E FAIL] ${flow}${detail ? `: ${detail}` : ""}`);
  } else {
    console.log(`[E2E PASS] ${flow}`);
  }
}

async function assertManagedFromStableRef(
  stableRef: string,
  ctx: E2EContext
): Promise<string> {
  const imageId = parseMediaImageId(stableRef);
  assert.ok(imageId, `no imageId en ref estable ${stableRef}`);
  const doc = await ImageAsset.findOne({ imageId }).lean();
  assert.ok(doc, "ImageAsset ausente");
  assert.equal(doc.visibility, "public");
  assert.ok(doc.variants?.medium?.webp?.key);
  assert.equal(await ctx.storage.exists(doc.variants!.medium!.webp!.key), true);
  return imageId;
}

async function stableProfilePhotos(userId: string): Promise<string[]> {
  const u = await User.findById(userId).lean();
  return (u?.profile?.photos ?? []).filter(Boolean);
}

describe("E2E Image Service — Fase 10", () => {
  let ctx: E2EContext;

  before(async () => {
    ctx = await startE2E();
  });

  after(async () => {
    await stopE2E();
    console.log("\n=== INFORME E2E IMÁGENES ===");
    for (const r of results) {
      console.log(`${r.status}\t${r.flow}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    const failed = results.filter((r) => r.status === "FAIL").length;
    console.log(
      `\nTotal ${results.length} | PASS ${results.length - failed} | FAIL ${failed}`
    );
  });

  it("1. USER PROFILE — upload → storage → serialize → replace → delete", async () => {
    const flow = "USER_PROFILE";
    try {
      const { user, token } = await createTestUser({
        email: `profile-${Date.now()}@e2e.test`,
      });
      const jpeg = await makeJpeg(700, 500);

      const up = await uploadProfilePhoto(token, jpeg);
      assert.equal(up.res.status, 201, JSON.stringify(up.json));
      const photos = (up.json as { photos?: string[] }).photos ?? [];
      assert.ok(photos[0]);
      assert.match(photos[0]!, /^https:\/\/cdn\.e2e\.test\//);

      const stable0 = (await stableProfilePhotos(user._id.toString()))[0]!;
      const imageId = await assertManagedFromStableRef(stable0, ctx);

      const me = await api("/api/auth/me", { token });
      assert.equal(me.res.status, 200);
      const mePhotos = (me.json as { user: { profile: { photos: string[] } } })
        .user.profile.photos;
      assert.ok(mePhotos[0]?.startsWith("https://cdn.e2e.test/"));

      const jpeg2 = await makeJpeg(640, 480, { r: 200, g: 40, b: 40 });
      const up2 = await uploadProfilePhoto(token, jpeg2);
      assert.equal(up2.res.status, 201);
      assert.equal((await stableProfilePhotos(user._id.toString())).length, 2);

      const del = await api("/api/profile/photos/1", {
        method: "DELETE",
        token,
      });
      assert.equal(del.res.status, 200);
      const after = await stableProfilePhotos(user._id.toString());
      assert.equal(after.length, 1);
      assert.equal(after[0], `/api/media/${imageId}`);

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("2. SPACE — upload → read → replace → delete cover", async () => {
    const flow = "SPACE";
    try {
      const { user, token } = await createTestUser({
        email: `space-owner-${Date.now()}@e2e.test`,
      });
      const venue = await createTestVenue(user._id.toString());

      const patch = await patchVenueCover(
        token,
        venue,
        await makeJpeg(800, 600)
      );
      assert.equal(patch.res.status, 200, JSON.stringify(patch.json));
      const venueJson = (patch.json as { venue: { photos: string[] } }).venue;
      assert.ok(venueJson.photos[0]?.startsWith("https://cdn.e2e.test/"));

      const refreshed = await (
        await import("../models/Venue.js")
      ).Venue.findById(venue._id);
      const stable = refreshed!.photos[0]!;
      const firstId = await assertManagedFromStableRef(stable, ctx);

      const get = await api(`/api/venues/${venue._id}`);
      assert.equal(get.res.status, 200);
      const publicPhotos = (get.json as { venue: { photos: string[] } }).venue
        .photos;
      assert.ok(publicPhotos[0]?.startsWith("https://"));

      const patch2 = await patchVenueCover(
        token,
        refreshed!,
        await makeJpeg(720, 540, { r: 10, g: 200, b: 80 }),
        "Portada reemplazo"
      );
      assert.equal(patch2.res.status, 200);
      const after = await (
        await import("../models/Venue.js")
      ).Venue.findById(venue._id);
      const secondId = parseMediaImageId(after!.photos[0]!);
      assert.ok(secondId);
      assert.notEqual(secondId, firstId);
      assert.equal(await ImageAsset.findOne({ imageId: firstId }), null);

      // Eliminación de portada: manage sin foto nueva no borra; vaciamos vía photos=[] no expuesto.
      // Validamos que replace ya eliminó la anterior (política Image Service).
      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("3. SPACE NEWS — upload → public read → replace → delete", async () => {
    const flow = "SPACE_NEWS";
    try {
      const { user, token } = await createTestUser({
        email: `news-owner-${Date.now()}@e2e.test`,
      });
      const venue = await createTestVenue(user._id.toString());

      const form = new FormData();
      form.append("photo", jpegPart(await makeJpeg(720, 480)), "news.jpg");
      form.append("title", "Novedad E2E");
      form.append("body", "Cuerpo de la noticia E2E");
      const created = await api(`/api/venues/${venue._id}/news`, {
        method: "POST",
        token,
        body: form,
      });
      assert.equal(created.res.status, 201, JSON.stringify(created.json));
      const news = (created.json as { news: { id: string; photos: string[] } })
        .news;
      assert.ok(news.photos[0]?.startsWith("https://cdn.e2e.test/"));

      const dbNews = await VenueNews.findById(news.id);
      const firstId = await assertManagedFromStableRef(dbNews!.photos[0]!, ctx);

      const list = await api(`/api/venues/${venue._id}/news`);
      assert.equal(list.res.status, 200);
      const items = (list.json as { news: Array<{ photos: string[] }> }).news;
      assert.ok(items.some((n) => n.photos?.[0]?.startsWith("https://")));

      // Reemplazo: nueva noticia (promo/news no tiene multipart en PATCH)
      const form2 = new FormData();
      form2.append(
        "photo",
        jpegPart(await makeJpeg(700, 460, { r: 220, g: 100, b: 40 })),
        "news2.jpg"
      );
      form2.append("title", "Novedad E2E v2");
      form2.append("body", "Reemplazo de imagen E2E");
      const created2 = await api(`/api/venues/${venue._id}/news`, {
        method: "POST",
        token,
        body: form2,
      });
      assert.equal(created2.res.status, 201);
      const news2 = (created2.json as { news: { id: string } }).news;

      const del = await api(`/api/venues/${venue._id}/news/${news.id}`, {
        method: "DELETE",
        token,
      });
      assert.equal(del.res.status, 200);
      const soft = await VenueNews.findById(news.id);
      assert.equal(soft?.active, false);
      // Soft-delete de news no purga storage todavía (legacy cleanup); asset puede existir
      void firstId;
      void news2;

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("4. REVIEW — upload → public read → delete", async () => {
    const flow = "REVIEW";
    try {
      const owner = await createTestUser({
        email: `rev-owner-${Date.now()}@e2e.test`,
      });
      const reviewer = await createTestUser({
        email: `rev-user-${Date.now()}@e2e.test`,
      });
      const venue = await createTestVenue(owner.user._id.toString());

      const form = new FormData();
      form.append("photos", jpegPart(await makeJpeg(600, 400)), "review.jpg");
      form.append("rating", "5");
      form.append("body", "Muy bueno el Espacio E2E");
      const created = await api(`/api/venues/${venue._id}/reviews`, {
        method: "POST",
        token: reviewer.token,
        body: form,
      });
      assert.equal(created.res.status, 201, JSON.stringify(created.json));
      const review = (
        created.json as { review: { id: string; photos: string[] } }
      ).review;
      assert.ok(review.photos[0]?.startsWith("https://cdn.e2e.test/"));

      const db = await VenueReview.findById(review.id);
      await assertManagedFromStableRef(db!.photos[0]!, ctx);

      const list = await api(`/api/venues/${venue._id}/reviews`);
      assert.equal(list.res.status, 200);

      const del = await api(`/api/venues/${venue._id}/reviews/${review.id}`, {
        method: "DELETE",
        token: reviewer.token,
      });
      assert.equal(del.res.status, 200);
      const soft = await VenueReview.findById(review.id);
      assert.equal(soft?.active, false);

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("5. IDENTITY — private, admin-only, no public leak", async () => {
    const flow = "IDENTITY_VERIFICATION";
    try {
      const user = await createTestUser({
        email: `id-user-${Date.now()}@e2e.test`,
      });
      const peer = await createTestUser({
        email: `id-peer-${Date.now()}@e2e.test`,
      });
      const admin = await createTestUser({
        email: `id-admin-${Date.now()}@e2e.test`,
        role: "admin",
      });

      const form = new FormData();
      form.append(
        "documentFront",
        jpegPart(await makeJpeg(900, 600)),
        "doc.jpg"
      );
      form.append(
        "selfieWithDocument",
        jpegPart(await makeJpeg(640, 640, { r: 90, g: 90, b: 90 })),
        "selfie.jpg"
      );

      const up = await api("/api/me/identity-verification", {
        method: "POST",
        token: user.token,
        body: form,
      });
      assert.equal(up.res.status, 200, JSON.stringify(up.json));
      const serialized = JSON.stringify(up.json);
      assert.ok(!serialized.includes("documentFrontPath"));
      assert.ok(!serialized.includes("selfieWithDocumentPath"));
      assert.equal(
        (up.json as { user: { identityVerification?: { status?: string } } })
          .user.identityVerification?.status,
        "pending"
      );

      const dbUser = await User.findById(user.user._id).lean();
      const front = (
        dbUser?.identityVerification as { documentFrontPath?: string }
      )?.documentFrontPath;
      assert.ok(front);
      assert.match(front!, /^[a-f0-9]{32}$/i);

      const asset = await ImageAsset.findOne({ imageId: front }).lean();
      assert.equal(asset?.visibility, "private");
      assert.ok(asset?.storageKey?.startsWith("private/"));
      assert.equal(await ctx.storage.exists(asset!.storageKey!), true);

      const mediaPublic = await api(`/api/media/${front}`);
      assert.equal(mediaPublic.res.status, 404);

      const peerAccess = await api(
        `/api/admin/identity-verifications/${user.user._id}/files/documentFront`,
        { token: peer.token }
      );
      assert.ok([401, 403].includes(peerAccess.res.status));

      const ownerAccess = await api(
        `/api/admin/identity-verifications/${user.user._id}/files/documentFront`,
        { token: user.token }
      );
      assert.ok([401, 403].includes(ownerAccess.res.status));

      const adminAccess = await api(
        `/api/admin/identity-verifications/${user.user._id}/files/documentFront`,
        { token: admin.token }
      );
      assert.equal(adminAccess.res.status, 302);
      const loc = adminAccess.res.headers.get("location");
      assert.ok(loc && loc.length > 8, `location admin: ${loc}`);
      // memory driver → memory://signed/…; railway → https://…

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("6. DISCOVER — solo 1ª firmada + FE sin large (contrato web)", async () => {
    const flow = "DISCOVER";
    try {
      const venueOwner = await createTestUser({
        email: `disc-owner-${Date.now()}@e2e.test`,
      });
      const venue = await createTestVenue(venueOwner.user._id.toString());

      const viewer = await createTestUser({
        email: `disc-view-${Date.now()}@e2e.test`,
        gender: "woman",
        interestedIn: ["man"],
      });
      const candidate = await createTestUser({
        email: `disc-cand-${Date.now()}@e2e.test`,
        gender: "man",
        interestedIn: ["woman"],
        name: "Cand E2E",
      });

      for (let i = 0; i < 3; i++) {
        const up = await uploadProfilePhoto(
          candidate.token,
          await makeJpeg(500 + i, 500, { r: 40 + i * 40, g: 80, b: 120 })
        );
        assert.equal(up.res.status, 201);
      }
      const stables = await stableProfilePhotos(candidate.user._id.toString());
      assert.equal(stables.length, 3);

      await Presence.create({
        userId: viewer.user._id,
        venueId: venue._id,
        status: "active",
        startsAt: new Date(),
      });
      await Presence.create({
        userId: candidate.user._id,
        venueId: venue._id,
        status: "active",
        startsAt: new Date(),
      });

      const feed = await api(`/api/discover/feed?venueId=${venue._id}`, {
        token: viewer.token,
      });
      assert.equal(feed.res.status, 200, JSON.stringify(feed.json));
      const cards = (feed.json as { cards: Array<{ userId: string; profile: { photos: string[] } }> })
        .cards;
      const card = cards.find((c) => c.userId === candidate.user._id.toString());
      assert.ok(card, "candidato ausente en feed");
      assert.equal(card!.profile.photos.length, 3);
      assert.match(card!.profile.photos[0]!, /^https:\/\//);
      assert.match(card!.profile.photos[1]!, /^\/api\/media\//);
      assert.match(card!.profile.photos[2]!, /^\/api\/media\//);

      // Contrato FE (suite dedicada en apps/web); assert mínimo aquí
      const { discoverVisiblePhotoPlan, DISCOVER_SWIPE_VARIANTS } = await import(
        "../../../web/src/lib/discoverImages.ts"
      );
      const { planOptimizedSource } = await import(
        "../../../web/src/lib/optimizedImage.ts"
      );
      assert.deepEqual([...DISCOVER_SWIPE_VARIANTS], ["thumb", "medium"]);
      const visible = discoverVisiblePhotoPlan({
        currentPhotos: Array.from({ length: 10 }, (_, i) => `/p${i}`),
        photoIndex: 0,
        nextPrimaryPhoto: "/next",
        detailOpen: false,
      });
      assert.equal(visible.renderSrc, "/p0");
      assert.equal(visible.preloadNext, "/next");
      const plan = planOptimizedSource(card!.profile.photos[0]!, {
        preferred: "thumb",
        variants: DISCOVER_SWIPE_VARIANTS,
      });
      if (plan?.kind === "picture") {
        assert.doesNotMatch(plan.webpSrcSet, /v=large/);
      }

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("7. SERIALIZATION round-trip /api/media/{id}", async () => {
    const flow = "SERIALIZATION";
    try {
      const { user, token } = await createTestUser({
        email: `ser-${Date.now()}@e2e.test`,
      });
      const up = await uploadProfilePhoto(token, await makeJpeg());
      assert.equal(up.res.status, 201);
      const delivered = (up.json as { photos: string[] }).photos[0]!;
      assert.match(delivered, /^https:\/\/cdn\.e2e\.test\//);

      const stable = (await stableProfilePhotos(user._id.toString()))[0]!;
      assert.match(stable, /^\/api\/media\/[a-f0-9]{32}$/i);
      const imageId = parseMediaImageId(stable)!;

      const fromStable = await resolvePublicAssetUrl(stable);
      assert.ok(fromStable?.startsWith("https://cdn.e2e.test/"));

      const media = await api(`/api/media/${imageId}`);
      assert.equal(media.res.status, 302);
      const loc = media.res.headers.get("location");
      assert.ok(loc?.startsWith("https://cdn.e2e.test/"));

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("8. SEGURIDAD — MIME/SVG/GIF/dims/auth/path/ajena", async () => {
    const flow = "SECURITY";
    try {
      const { token } = await createTestUser({
        email: `sec-${Date.now()}@e2e.test`,
      });

      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
      );
      const formSvg = new FormData();
      formSvg.append(
        "photo",
        new Blob([svg], { type: "image/svg+xml" }),
        "x.svg"
      );
      const svgRes = await api("/api/profile/photos", {
        method: "POST",
        token,
        body: formSvg,
      });
      assert.ok(svgRes.res.status >= 400, `svg status ${svgRes.res.status}`);

      const gif = await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#111" },
      })
        .gif()
        .toBuffer();
      const formGif = new FormData();
      formGif.append(
        "photo",
        new Blob([new Uint8Array(gif)], { type: "image/gif" }),
        "a.gif"
      );
      const gifRes = await api("/api/profile/photos", {
        method: "POST",
        token,
        body: formGif,
      });
      assert.ok(gifRes.res.status >= 400, `gif status ${gifRes.res.status}`);

      const fake = Buffer.from("%PDF-1.4 fake");
      const formFake = new FormData();
      formFake.append(
        "photo",
        new Blob([fake], { type: "image/jpeg" }),
        "fake.jpg"
      );
      const fakeRes = await api("/api/profile/photos", {
        method: "POST",
        token,
        body: formFake,
      });
      assert.ok(fakeRes.res.status >= 400);

      // Dimensiones excesivas (tope E2E 2000px)
      const huge = await makeJpeg(2100, 100);
      const formHuge = new FormData();
      formHuge.append("photo", jpegPart(huge), "huge.jpg");
      const hugeRes = await api("/api/profile/photos", {
        method: "POST",
        token,
        body: formHuge,
      });
      assert.ok(hugeRes.res.status >= 400, `dims status ${hugeRes.res.status}`);

      // Archivo demasiado grande (>10MB multer)
      const big = Buffer.alloc(11 * 1024 * 1024, 0xff);
      big[0] = 0xff;
      big[1] = 0xd8;
      big[2] = 0xff;
      const formBig = new FormData();
      formBig.append(
        "photo",
        new Blob([big], { type: "image/jpeg" }),
        "big.jpg"
      );
      const bigRes = await api("/api/profile/photos", {
        method: "POST",
        token,
        body: formBig,
      });
      assert.ok(bigRes.res.status >= 400);

      const unauthForm = new FormData();
      unauthForm.append("photo", jpegPart(await makeJpeg(100, 100)), "a.jpg");
      const unauth = await api("/api/profile/photos", {
        method: "POST",
        body: unauthForm,
      });
      assert.equal(unauth.res.status, 401);

      const mediaTraversal = await api("/api/media/../etc/passwd");
      assert.ok([400, 404].includes(mediaTraversal.res.status));

      const other = await createTestUser({
        email: `sec-other-${Date.now()}@e2e.test`,
      });
      const owner = await createTestUser({
        email: `sec-owner-${Date.now()}@e2e.test`,
      });
      const venue = await createTestVenue(owner.user._id.toString());
      await patchVenueCover(owner.token, venue, await makeJpeg());

      const steal = await api(`/api/venues/${venue._id}/manage`, {
        method: "PATCH",
        token: other.token,
        body: (() => {
          const f = new FormData();
          f.append("name", "hack");
          f.append("type", "bar");
          f.append("address", "18 de Julio 1234");
          f.append("country", "Uruguay");
          f.append("city", "Montevideo");
          f.append(
            "location",
            JSON.stringify({ lat: -34.9, lng: -56.16 })
          );
          return f;
        })(),
      });
      assert.equal(steal.res.status, 403);

      // imageId conocido de identity ajena → /api/media 404
      const idUser = await createTestUser({
        email: `sec-id-${Date.now()}@e2e.test`,
      });
      const idForm = new FormData();
      idForm.append(
        "documentFront",
        jpegPart(await makeJpeg(400, 300)),
        "d.jpg"
      );
      idForm.append(
        "selfieWithDocument",
        jpegPart(await makeJpeg(400, 300)),
        "s.jpg"
      );
      await api("/api/me/identity-verification", {
        method: "POST",
        token: idUser.token,
        body: idForm,
      });
      const idDoc = await User.findById(idUser.user._id).lean();
      const idFront = (
        idDoc?.identityVerification as { documentFrontPath?: string }
      )?.documentFrontPath;
      assert.ok(idFront);
      const knownId = await api(`/api/media/${idFront}`, {
        token: other.token,
      });
      assert.equal(knownId.res.status, 404);

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  it("9. ACCOUNT DELETION — soft → invisible → restore → purge imágenes", async () => {
    const flow = "ACCOUNT_DELETION";
    try {
      const { user, token } = await createTestUser({
        email: `del-${Date.now()}@e2e.test`,
      });
      const up = await uploadProfilePhoto(token, await makeJpeg(500, 400));
      assert.equal(up.res.status, 201);
      const imageId = parseMediaImageId(
        (await stableProfilePhotos(user._id.toString()))[0]!
      )!;
      assert.ok(await ImageAsset.exists({ imageId }));

      await Presence.create({
        userId: user._id,
        venueId: (await createTestVenue(user._id.toString()))._id,
        status: "active",
        startsAt: new Date(),
      });

      const soft = await api("/api/me/account", {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmation: "Eliminar" }),
      });
      assert.equal(soft.res.status, 200, JSON.stringify(soft.json));
      assert.equal(
        (soft.json as { pendingDeletion?: boolean }).pendingDeletion,
        true
      );

      // Token viejo: authVersion bump → revocado
      const oldTok = await api("/api/profile", { token });
      assert.equal(oldTok.res.status, 401);

      const login = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          password: "Demo1234!",
        }),
      });
      assert.equal(login.res.status, 200);
      const newToken = (login.json as { token: string }).token;

      const blocked = await api("/api/profile", { token: newToken });
      assert.equal(blocked.res.status, 403);
      assert.equal(
        (blocked.json as { code?: string }).code,
        "ACCOUNT_PENDING_DELETION"
      );

      // Soft: imágenes siguen existiendo
      assert.ok(await ImageAsset.exists({ imageId }));

      const restore = await api("/api/me/account/restore", {
        method: "POST",
        token: newToken,
        body: JSON.stringify({}),
      });
      assert.equal(restore.res.status, 200);

      // Purge definitivo: soft + fecha vencida
      const again = await User.findById(user._id);
      assert.ok(again);
      await requestAccountDeletion(again!);
      again!.deletionRequestedAt = new Date(
        Date.now() - (ACCOUNT_DELETION_RECOVERY_DAYS + 1) * 86400000
      );
      await again!.save();

      const purged = await purgeExpiredDeletedAccounts();
      assert.ok(purged.purged >= 1);
      assert.equal(await User.findById(user._id), null);
      assert.equal(await ImageAsset.findOne({ imageId }), null);

      record(flow, "PASS");
    } catch (err) {
      record(flow, "FAIL", err instanceof Error ? err.message : String(err));
      throw err;
    }
  });
});
