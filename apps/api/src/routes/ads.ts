import { Router } from "express";
import { planHasFeature } from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Ad } from "../models/Ad.js";
import { isObjectId, paramId } from "../utils/ids.js";
import { isPremiumActive } from "../utils/premium.js";
import { resolvePublicAssetUrl } from "../utils/serialize.js";

const router = Router();

async function serializeAd(ad: InstanceType<typeof Ad>) {
  return {
    id: ad._id.toString(),
    title: ad.title,
    subtitle: ad.subtitle || undefined,
    body: ad.body || undefined,
    imageUrl: (await resolvePublicAssetUrl(ad.imageUrl)) ?? ad.imageUrl,
    ctaLabel: ad.ctaLabel || "Ver más",
    ctaUrl: ad.ctaUrl,
    sponsorName: ad.sponsorName || undefined,
    href: `/ads/${ad._id.toString()}`,
  };
}

/** Próximo anuncio para el deck (null si Premium con Sin anuncios). */
router.get("/next", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (
    isPremiumActive(user) &&
    planHasFeature(String(user.premiumPlanId), "no_ads")
  ) {
    return res.json({ ad: null });
  }

  const ads = await Ad.find({ active: true }).limit(50);
  if (!ads.length) {
    return res.json({ ad: null });
  }

  const totalWeight = ads.reduce((sum, ad) => sum + (ad.weight || 1), 0);
  let tick = Math.random() * totalWeight;
  let chosen = ads[0]!;
  for (const ad of ads) {
    tick -= ad.weight || 1;
    if (tick <= 0) {
      chosen = ad;
      break;
    }
  }

  return res.json({
    ad: {
      kind: "ad" as const,
      ...(await serializeAd(chosen)),
    },
  });
});

router.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = paramId(req.params.id);
  if (!isObjectId(id)) {
    return res.status(400).json({ error: "Id inválido" });
  }
  const ad = await Ad.findById(id);
  if (!ad || !ad.active) {
    return res.status(404).json({ error: "Anuncio no encontrado" });
  }
  return res.json({ ad: await serializeAd(ad) });
});

export default router;
