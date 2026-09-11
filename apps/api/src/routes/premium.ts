import { Router } from "express";
import { z } from "zod";
import {
  MercadoPagoConfig,
  Payment,
  PreApproval,
} from "mercadopago";
import {
  getPremiumPlan,
  isPremiumPlanDowngrade,
  PREMIUM_PERIOD_MONTHS,
  PREMIUM_PLAN_IDS,
  premiumDashboardFeatureItems,
  premiumFeatureItems,
  premiumPeriodLabel,
  premiumPeriodPriceUsd,
  type PremiumPeriodMonths,
  type PremiumPlanId,
} from "@nocta/shared";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { requireVerified } from "../middleware/gates.js";
import { config } from "../config.js";
import { PremiumPurchase } from "../models/PremiumPurchase.js";
import { User } from "../models/User.js";
import {
  activateBoost,
  activatePremiumPurchase,
  isPremiumActive,
  markPremiumCancelledAtPeriodEnd,
  markPremiumPaused,
  syncExpiredPremium,
} from "../utils/premium.js";
import { createNotification } from "../utils/notify.js";
import { serializeUser } from "../utils/serialize.js";

const router = Router();

function mpClient() {
  if (!config.mercadoPago.accessToken) return null;
  return new MercadoPagoConfig({
    accessToken: config.mercadoPago.accessToken,
  });
}

function periodLabelFromMonths(months: number) {
  if ((PREMIUM_PERIOD_MONTHS as readonly number[]).includes(months)) {
    return premiumPeriodLabel(months as PremiumPeriodMonths);
  }
  return `${months} meses`;
}

router.get("/plans", (_req, res) => {
  return res.json({
    currency: config.mercadoPago.currency,
    billing: "subscription",
    plans: PREMIUM_PLAN_IDS.map((id) => {
      const plan = getPremiumPlan(id)!;
      return {
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        comingSoon: plan.comingSoon,
        features: plan.features,
        featureLabels: plan.featureLabels,
        featureItems: premiumFeatureItems(plan.features),
        periods: plan.comingSoon
          ? []
          : PREMIUM_PERIOD_MONTHS.map((months) => ({
              months,
              priceUsd: premiumPeriodPriceUsd(months, plan.id),
              label: premiumPeriodLabel(months),
              cadence: `Cobro cada ${
                months === 1 ? "mes" : `${months} meses`
              }`,
            })),
      };
    }),
  });
});

const checkoutSchema = z.object({
  planId: z.enum(PREMIUM_PLAN_IDS),
  periodMonths: z.coerce
    .number()
    .refine((v): v is PremiumPeriodMonths =>
      (PREMIUM_PERIOD_MONTHS as readonly number[]).includes(v)
    ),
});

router.post(
  "/checkout",
  requireAuth,
  requireVerified,
  async (req: AuthedRequest, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    const plan = getPremiumPlan(parsed.data.planId);
    if (!plan || plan.comingSoon) {
      return res.status(400).json({
        error: "Ese plan todavía no está disponible",
        code: "PLAN_UNAVAILABLE",
      });
    }

    if (
      isPremiumActive(req.user!) &&
      String(req.user!.premiumPlanId) === parsed.data.planId
    ) {
      return res.status(409).json({
        error: "Ya tenés este plan. Gestionarlo desde Premium.",
        code: "ALREADY_ON_PLAN",
      });
    }

    if (
      isPremiumActive(req.user!) &&
      isPremiumPlanDowngrade(
        String(req.user!.premiumPlanId),
        parsed.data.planId
      )
    ) {
      return res.status(409).json({
        error: "Ya tenés un plan superior. Gestionarlo desde Premium.",
        code: "PLAN_DOWNGRADE",
      });
    }

    const client = mpClient();
    if (!client) {
      return res.status(503).json({
        error: "Pagos no configurados. Probá más tarde.",
        code: "MP_NOT_CONFIGURED",
      });
    }

    const previousPreapprovalId = req.user!.mpPreapprovalId?.trim() || null;
    if (previousPreapprovalId) {
      try {
        const api = new PreApproval(client);
        await api.update({
          id: previousPreapprovalId,
          body: { status: "cancelled" },
        });
      } catch (err) {
        console.error("[mp] cancel previous preapproval on upgrade failed", err);
        return res.status(502).json({
          error: "No se pudo reemplazar la suscripción anterior en Mercado Pago",
          code: "MP_CANCEL_FAILED",
        });
      }
    }

    const amount = premiumPeriodPriceUsd(
      parsed.data.periodMonths,
      parsed.data.planId
    );
    const purchase = await PremiumPurchase.create({
      userId: req.user!._id,
      planId: parsed.data.planId,
      periodMonths: parsed.data.periodMonths,
      amount,
      currency: config.mercadoPago.currency,
      status: "pending",
      kind: "subscription",
    });

    const preapproval = new PreApproval(client);
    const reason = `${plan.name} · ${premiumPeriodLabel(parsed.data.periodMonths)}`;
    try {
      const result = await preapproval.create({
        body: {
          reason,
          external_reference: purchase._id.toString(),
          payer_email: req.user!.email,
          auto_recurring: {
            frequency: parsed.data.periodMonths,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: config.mercadoPago.currency,
          },
          back_url: `${config.clientOrigin}/premium?status=success`,
          status: "pending",
        },
      });

      purchase.mpPreapprovalId = result.id ?? undefined;
      await purchase.save();

      await User.findByIdAndUpdate(req.user!._id, {
        $set: {
          premiumSubscriptionStatus: "pending",
          ...(result.id ? { mpPreapprovalId: result.id } : {}),
        },
      });

      const initPoint = result.init_point || null;
      if (!initPoint) {
        return res.status(502).json({
          error: "No se pudo crear la suscripción de Mercado Pago",
        });
      }

      return res.json({
        purchaseId: purchase._id.toString(),
        initPoint,
        preapprovalId: result.id,
        billing: {
          frequency: parsed.data.periodMonths,
          frequencyType: "months",
          amount,
          currency: config.mercadoPago.currency,
          label: premiumPeriodLabel(parsed.data.periodMonths),
        },
      });
    } catch (err) {
      purchase.status = "rejected";
      await purchase.save();
      console.error("[mp] preapproval create failed", err);
      return res.status(502).json({
        error: "No se pudo iniciar la suscripción con Mercado Pago",
      });
    }
  }
);

async function applyApprovedPayment(paymentId: string) {
  const client = mpClient();
  if (!client) return;

  const paymentApi = new Payment(client);
  const payment = await paymentApi.get({ id: paymentId });
  if (!payment || payment.status !== "approved") return;

  const paymentIdStr = String(payment.id ?? paymentId);
  const existingCharge = await PremiumPurchase.findOne({
    mpPaymentId: paymentIdStr,
  });
  if (existingCharge?.status === "approved") return;

  const metadata = payment.metadata as
    | {
        purchaseId?: string;
        preapproval_id?: string;
        preapprovalId?: string;
      }
    | undefined;

  const purchaseId =
    (payment.external_reference as string | undefined) ||
    metadata?.purchaseId;

  let purchase = purchaseId
    ? await PremiumPurchase.findById(purchaseId)
    : null;

  const preapprovalId =
    metadata?.preapproval_id ||
    metadata?.preapprovalId ||
    purchase?.mpPreapprovalId ||
    undefined;

  if (!purchase && preapprovalId) {
    purchase = await PremiumPurchase.findOne({
      mpPreapprovalId: preapprovalId,
      status: "pending",
      kind: "subscription",
    }).sort({ createdAt: -1 });
  }

  if (!purchase && preapprovalId) {
    const user = await User.findOne({ mpPreapprovalId: preapprovalId });
    if (user?.premiumPlanId && user.premiumPeriodMonths) {
      purchase = await PremiumPurchase.create({
        userId: user._id,
        planId: user.premiumPlanId,
        periodMonths: user.premiumPeriodMonths,
        amount:
          typeof payment.transaction_amount === "number"
            ? payment.transaction_amount
            : premiumPeriodPriceUsd(
                user.premiumPeriodMonths as PremiumPeriodMonths,
                String(user.premiumPlanId)
              ),
        currency:
          (payment.currency_id as string | undefined) ||
          config.mercadoPago.currency,
        mpPreapprovalId: preapprovalId,
        status: "pending",
        kind: "charge",
      });
    }
  }

  if (!purchase) return;

  const nextPaymentAt =
    payment.date_approved != null
      ? (() => {
          const base = new Date(String(payment.date_approved));
          const next = new Date(base);
          next.setUTCMonth(next.getUTCMonth() + Number(purchase!.periodMonths));
          return next;
        })()
      : undefined;

  const user = await activatePremiumPurchase({
    userId: purchase.userId.toString(),
    planId: purchase.planId as PremiumPlanId,
    periodMonths: purchase.periodMonths as PremiumPeriodMonths,
    mpPreapprovalId: preapprovalId || purchase.mpPreapprovalId || undefined,
    subscriptionStatus: "authorized",
    nextPaymentAt: nextPaymentAt ?? null,
    cancelAtPeriodEnd: false,
  });
  if (!user) return;

  if (purchase.status === "pending" && purchase.kind === "subscription") {
    purchase.status = "approved";
    purchase.mpPaymentId = paymentIdStr;
    purchase.kind = "charge";
    purchase.startsAt = new Date();
    purchase.endsAt = user.premiumExpiresAt ?? undefined;
    if (preapprovalId) purchase.mpPreapprovalId = preapprovalId;
    await purchase.save();
  } else if (purchase.status !== "approved") {
    purchase.status = "approved";
    purchase.mpPaymentId = paymentIdStr;
    purchase.kind = "charge";
    purchase.startsAt = new Date();
    purchase.endsAt = user.premiumExpiresAt ?? undefined;
    await purchase.save();
  } else if (!purchase.mpPaymentId) {
    purchase.mpPaymentId = paymentIdStr;
    await purchase.save();
  }

  const plan = getPremiumPlan(purchase.planId);
  void createNotification({
    userId: purchase.userId.toString(),
    type: "premium_activated",
    title: `${plan?.name ?? "Premium"} activo`,
    body: `Suscripción ${periodLabelFromMonths(
      Number(purchase.periodMonths)
    ).toLowerCase()}. Vigente hasta ${
      user.premiumExpiresAt
        ? user.premiumExpiresAt.toLocaleDateString("es-UY")
        : "nuevo aviso"
    }`,
    href: "/premium",
    data: {
      purchaseId: purchase._id.toString(),
      planId: purchase.planId,
    },
    dedupeKey: `premium_payment:${paymentIdStr}`,
  });
}

async function syncPreapprovalStatus(preapprovalId: string) {
  const client = mpClient();
  if (!client) return;
  const api = new PreApproval(client);
  const sub = await api.get({ id: preapprovalId });
  if (!sub?.id) return;

  const user = await User.findOne({ mpPreapprovalId: String(sub.id) });
  if (!user) return;

  const status = String(sub.status || "");
  if (status === "authorized") {
    user.premiumSubscriptionStatus = "authorized";
    if (sub.next_payment_date) {
      user.premiumNextPaymentAt = new Date(String(sub.next_payment_date));
    }
    user.premiumCancelAtPeriodEnd = false;
    await user.save();
  } else if (status === "paused") {
    user.premiumSubscriptionStatus = "paused";
    user.premiumNextPaymentAt = null;
    await user.save();
  } else if (status === "cancelled") {
    user.premiumSubscriptionStatus = "cancelled";
    user.premiumCancelAtPeriodEnd = true;
    user.premiumNextPaymentAt = null;
    await user.save();
  }
}

router.post("/webhook", async (req, res) => {
  try {
    const topic =
      (typeof req.query.type === "string" && req.query.type) ||
      (typeof req.query.topic === "string" && req.query.topic) ||
      (typeof req.body?.type === "string" && req.body.type) ||
      "";
    const dataId =
      (typeof req.query["data.id"] === "string" && req.query["data.id"]) ||
      (typeof req.body?.data?.id === "string" && req.body.data.id) ||
      (typeof req.body?.id === "string" && req.body.id) ||
      "";

    if (!dataId) {
      return res.status(200).json({ ok: true });
    }

    if (
      topic === "payment" ||
      topic === "payment.created" ||
      topic === "subscription_authorized_payment" ||
      !topic
    ) {
      await applyApprovedPayment(String(dataId));
    }

    if (
      topic === "subscription_preapproval" ||
      topic === "subscription_preapproval_updated"
    ) {
      await syncPreapprovalStatus(String(dataId));
    }
  } catch (err) {
    console.error("[mp] webhook failed", err);
  }
  return res.status(200).json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await syncExpiredPremium(req.user!._id.toString());
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const active = isPremiumActive(user);
  const plan = user.premiumPlanId
    ? getPremiumPlan(String(user.premiumPlanId))
    : null;
  const periodMonths = user.premiumPeriodMonths as
    | PremiumPeriodMonths
    | undefined;

  return res.json({
    user: serializeUser(user),
    subscription: {
      active,
      planId: active ? user.premiumPlanId : undefined,
      planName: active ? plan?.name : undefined,
      periodMonths: active ? periodMonths : undefined,
      periodLabel:
        active && periodMonths ? premiumPeriodLabel(periodMonths) : undefined,
      amountUsd:
        active && periodMonths
          ? premiumPeriodPriceUsd(periodMonths, String(user.premiumPlanId))
          : undefined,
      currency: config.mercadoPago.currency,
      status: user.premiumSubscriptionStatus || "none",
      cancelAtPeriodEnd: Boolean(user.premiumCancelAtPeriodEnd),
      expiresAt: user.premiumExpiresAt
        ? user.premiumExpiresAt.toISOString()
        : null,
      nextPaymentAt: user.premiumNextPaymentAt
        ? user.premiumNextPaymentAt.toISOString()
        : null,
      managedByMercadoPago: Boolean(user.mpPreapprovalId),
      features: plan ? premiumFeatureItems(plan.features) : [],
      featureItems: active
        ? premiumDashboardFeatureItems(String(user.premiumPlanId))
        : [],
    },
  });
});

router.post(
  "/boost",
  requireAuth,
  requireVerified,
  async (req: AuthedRequest, res) => {
    const result = await activateBoost(req.user!._id.toString());
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
    }
    return res.json({
      user: serializeUser(result.user),
      boostExpiresAt: result.user.boostExpiresAt?.toISOString() ?? null,
      boostsRemaining: result.user.boostsRemaining ?? 0,
    });
  }
);

router.get("/payments", requireAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
  const filter = {
    userId: req.user!._id,
    status: "approved" as const,
  };
  const [items, total] = await Promise.all([
    PremiumPurchase.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PremiumPurchase.countDocuments(filter),
  ]);

  return res.json({
    payments: items.map((item) => ({
      id: item._id.toString(),
      planId: item.planId,
      planName: getPremiumPlan(String(item.planId))?.name ?? item.planId,
      periodMonths: item.periodMonths,
      periodLabel: periodLabelFromMonths(Number(item.periodMonths)),
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      paidAt: item.startsAt?.toISOString() || item.createdAt?.toISOString(),
      coversUntil: item.endsAt?.toISOString() ?? null,
      mpPaymentId: item.mpPaymentId,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
});

router.post(
  "/cancel",
  requireAuth,
  requireVerified,
  async (req: AuthedRequest, res) => {
    const user = await User.findById(req.user!._id);
    if (!user || !isPremiumActive(user)) {
      return res.status(400).json({ error: "No tenés una suscripción activa" });
    }

    if (user.mpPreapprovalId) {
      const client = mpClient();
      if (!client) {
        return res.status(503).json({
          error: "Pagos no configurados. Probá más tarde.",
          code: "MP_NOT_CONFIGURED",
        });
      }
      try {
        const api = new PreApproval(client);
        await api.update({
          id: user.mpPreapprovalId,
          body: { status: "cancelled" },
        });
      } catch (err) {
        console.error("[mp] cancel preapproval failed", err);
        return res.status(502).json({
          error: "No se pudo cancelar la suscripción en Mercado Pago",
        });
      }
    }

    const updated = await markPremiumCancelledAtPeriodEnd(user._id.toString());
    return res.json({
      user: serializeUser(updated!),
      message: user.premiumExpiresAt
        ? `Tu plan sigue activo hasta ${user.premiumExpiresAt.toLocaleDateString("es-UY")}. No se renovará.`
        : "Suscripción cancelada.",
    });
  }
);

router.post(
  "/pause",
  requireAuth,
  requireVerified,
  async (req: AuthedRequest, res) => {
    const user = await User.findById(req.user!._id);
    if (!user || !isPremiumActive(user) || !user.mpPreapprovalId) {
      return res.status(400).json({
        error: "No hay una suscripción de Mercado Pago para pausar",
      });
    }
    const client = mpClient();
    if (!client) {
      return res.status(503).json({
        error: "Pagos no configurados. Probá más tarde.",
        code: "MP_NOT_CONFIGURED",
      });
    }
    try {
      const api = new PreApproval(client);
      await api.update({
        id: user.mpPreapprovalId,
        body: { status: "paused" },
      });
    } catch (err) {
      console.error("[mp] pause preapproval failed", err);
      return res.status(502).json({ error: "No se pudo pausar la suscripción" });
    }
    const updated = await markPremiumPaused(user._id.toString());
    return res.json({ user: serializeUser(updated!) });
  }
);

router.post(
  "/resume",
  requireAuth,
  requireVerified,
  async (req: AuthedRequest, res) => {
    const user = await User.findById(req.user!._id);
    if (!user || !user.mpPreapprovalId) {
      return res.status(400).json({
        error: "No hay una suscripción para reactivar. Suscribite de nuevo.",
        code: "NEEDS_CHECKOUT",
      });
    }
    if (user.premiumSubscriptionStatus === "cancelled") {
      return res.status(400).json({
        error: "La suscripción fue cancelada. Elegí un plan para volver a suscribirte.",
        code: "NEEDS_CHECKOUT",
      });
    }
    const client = mpClient();
    if (!client) {
      return res.status(503).json({
        error: "Pagos no configurados. Probá más tarde.",
        code: "MP_NOT_CONFIGURED",
      });
    }
    try {
      const api = new PreApproval(client);
      const result = await api.update({
        id: user.mpPreapprovalId,
        body: { status: "authorized" },
      });
      user.premiumSubscriptionStatus = "authorized";
      user.premiumCancelAtPeriodEnd = false;
      if (result.next_payment_date) {
        user.premiumNextPaymentAt = new Date(String(result.next_payment_date));
      }
      await user.save();
      return res.json({ user: serializeUser(user) });
    } catch (err) {
      console.error("[mp] resume preapproval failed", err);
      return res.status(502).json({
        error: "No se pudo reactivar. Probá suscribirte de nuevo.",
        code: "NEEDS_CHECKOUT",
      });
    }
  }
);

export default router;
