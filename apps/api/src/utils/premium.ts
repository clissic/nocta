import type {
  PremiumPeriodMonths,
  PremiumPlanId,
  PremiumSubscriptionStatus,
} from "@nocta/shared";
import {
  BOOST_DURATION_MS,
  PREMIUM_ALLOWANCE_CYCLE_DAYS,
  maxActivePresencesForPlan,
  monthlyBoostAllowance,
  monthlyHeartshotAllowance,
  planHasFeature,
} from "@nocta/shared";
import type { UserDocument } from "../models/User.js";
import { User } from "../models/User.js";
import { keepNewestActivePresences } from "./presence.js";

export function isPremiumActive(
  user: Pick<UserDocument, "premium" | "premiumExpiresAt"> | null | undefined
): boolean {
  if (!user?.premium) return false;
  if (!user.premiumExpiresAt) return true; // admin/legacy sin expiry
  return user.premiumExpiresAt.getTime() > Date.now();
}

export function isBoostActive(
  user: Pick<UserDocument, "boostExpiresAt"> | null | undefined
): boolean {
  if (!user?.boostExpiresAt) return false;
  return user.boostExpiresAt.getTime() > Date.now();
}

function clearPremiumEntitlements(user: UserDocument) {
  user.premium = false;
  user.premiumPlanId = undefined;
  user.premiumExpiresAt = null;
  user.premiumPeriodMonths = undefined;
  user.premiumSubscriptionStatus = "none";
  user.premiumCancelAtPeriodEnd = false;
  user.premiumNextPaymentAt = null;
  user.mpPreapprovalId = undefined;
  user.rogueMode = false;
  user.teleportMode = false;
  user.spyMode = false;
  user.teleportCity = undefined;
  user.boostsRemaining = 0;
  user.heartshotsRemaining = 0;
  user.premiumAllowanceNextAt = null;
  user.premiumAllowanceCyclesLeft = 0;
  user.boostExpiresAt = null;
}

/** Revoca Premium y limpia entitlements (uso admin / sync). */
export async function revokePremium(
  userId: string
): Promise<UserDocument | null> {
  const user = await User.findById(userId);
  if (!user) return null;
  clearPremiumEntitlements(user);
  await user.save();
  await keepNewestActivePresences(userId, 1);
  return user;
}

export function addPremiumMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function addPremiumAllowanceDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function applyMonthlyAllowances(
  user: UserDocument,
  planId: PremiumPlanId,
  mode: "set" | "add"
) {
  const boost = planHasFeature(planId, "boost")
    ? monthlyBoostAllowance(planId)
    : 0;
  const heartshots = planHasFeature(planId, "heartshot")
    ? monthlyHeartshotAllowance(planId)
    : 0;

  if (mode === "set") {
    user.boostsRemaining = boost;
    user.heartshotsRemaining = heartshots;
  } else {
    user.boostsRemaining = (user.boostsRemaining ?? 0) + boost;
    user.heartshotsRemaining = (user.heartshotsRemaining ?? 0) + heartshots;
  }

  if (!planHasFeature(planId, "boost")) {
    user.boostExpiresAt = null;
  }
  if (planHasFeature(planId, "spy_mode")) {
    user.spyMode = true;
  } else {
    user.spyMode = false;
  }
}

/**
 * Al comprar N meses: carga 1 mes ahora + agenda N-1 recargas cada 30 días.
 * Si cancela, las recargas siguen mientras premiumExpiresAt esté vigente.
 */
function creditPurchaseAllowances(
  user: UserDocument,
  planId: PremiumPlanId,
  periodMonths: number,
  at: Date,
  mode: "set" | "add"
) {
  applyMonthlyAllowances(user, planId, mode);
  const extraCycles = Math.max(0, Math.floor(periodMonths) - 1);
  user.premiumAllowanceCyclesLeft =
    (user.premiumAllowanceCyclesLeft ?? 0) + extraCycles;
  if (extraCycles > 0) {
    const next = user.premiumAllowanceNextAt;
    if (!next || next.getTime() <= at.getTime()) {
      user.premiumAllowanceNextAt = addPremiumAllowanceDays(
        at,
        PREMIUM_ALLOWANCE_CYCLE_DAYS
      );
    }
  }
}

/** Aplica recargas de Boost/Heartshot vencidas (cada 30 días). */
export function syncPremiumAllowances(user: UserDocument): boolean {
  if (!isPremiumActive(user) || !user.premiumPlanId) return false;

  const planId = user.premiumPlanId as PremiumPlanId;
  const now = Date.now();
  let changed = false;

  while (
    (user.premiumAllowanceCyclesLeft ?? 0) > 0 &&
    user.premiumAllowanceNextAt &&
    user.premiumAllowanceNextAt.getTime() <= now
  ) {
    if (
      user.premiumExpiresAt &&
      user.premiumExpiresAt.getTime() <= user.premiumAllowanceNextAt.getTime()
    ) {
      // No cargar cupos después del fin del periodo pagado.
      user.premiumAllowanceCyclesLeft = 0;
      user.premiumAllowanceNextAt = null;
      changed = true;
      break;
    }

    applyMonthlyAllowances(user, planId, "add");
    user.premiumAllowanceCyclesLeft =
      (user.premiumAllowanceCyclesLeft ?? 0) - 1;
    user.premiumAllowanceNextAt = addPremiumAllowanceDays(
      user.premiumAllowanceNextAt,
      PREMIUM_ALLOWANCE_CYCLE_DAYS
    );
    changed = true;
  }

  if ((user.premiumAllowanceCyclesLeft ?? 0) <= 0) {
    if (user.premiumAllowanceNextAt || user.premiumAllowanceCyclesLeft) {
      changed = true;
    }
    user.premiumAllowanceCyclesLeft = 0;
    user.premiumAllowanceNextAt = null;
  }

  return changed;
}

/**
 * Otorga Premium desde ahora (no extiende un vencimiento previo).
 * Uso admin: fija plan, periodo, cupos y status authorized.
 */
export async function adminGrantPremium(opts: {
  userId: string;
  planId: PremiumPlanId;
  periodMonths: PremiumPeriodMonths;
}): Promise<UserDocument | null> {
  const user = await User.findById(opts.userId);
  if (!user) return null;

  const now = new Date();
  const endsAt = addPremiumMonths(now, opts.periodMonths);

  user.premium = true;
  user.premiumPlanId = opts.planId;
  user.premiumExpiresAt = endsAt;
  user.premiumPeriodMonths = opts.periodMonths;
  user.premiumSubscriptionStatus = "authorized";
  user.premiumCancelAtPeriodEnd = false;
  user.premiumNextPaymentAt = endsAt;
  user.mpPreapprovalId = undefined;
  user.likesRechargeAt = null;
  user.premiumAllowanceCyclesLeft = 0;
  user.premiumAllowanceNextAt = null;
  creditPurchaseAllowances(user, opts.planId, opts.periodMonths, now, "set");
  await user.save();
  await keepNewestActivePresences(
    opts.userId,
    maxActivePresencesForPlan(opts.planId)
  );
  return user;
}

/** Si la suscripción venció, baja premium y limpia entitlements. */
export async function syncExpiredPremium(
  userId: string
): Promise<UserDocument | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  if (user.premium) {
    const allowancesChanged = syncPremiumAllowances(user);
    if (
      user.premiumExpiresAt &&
      user.premiumExpiresAt.getTime() <= Date.now()
    ) {
      clearPremiumEntitlements(user);
      await user.save();
      await keepNewestActivePresences(userId, 1);
      return user;
    }
    if (allowancesChanged) {
      await user.save();
    }
  }
  return user;
}

export async function activatePremiumPurchase(opts: {
  userId: string;
  planId: PremiumPlanId;
  periodMonths: PremiumPeriodMonths;
  mpPreapprovalId?: string;
  subscriptionStatus?: PremiumSubscriptionStatus;
  nextPaymentAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<UserDocument | null> {
  const user = await User.findById(opts.userId);
  if (!user) return null;

  const now = new Date();
  const wasActive = isPremiumActive(user);
  const samePlan =
    wasActive && String(user.premiumPlanId) === String(opts.planId);
  const base =
    user.premiumExpiresAt && user.premiumExpiresAt.getTime() > now.getTime()
      ? user.premiumExpiresAt
      : now;
  const endsAt = addPremiumMonths(base, opts.periodMonths);

  user.premium = true;
  user.premiumPlanId = opts.planId;
  user.premiumExpiresAt = endsAt;
  user.premiumPeriodMonths = opts.periodMonths;
  user.premiumSubscriptionStatus =
    opts.subscriptionStatus ??
    (opts.mpPreapprovalId
      ? "authorized"
      : user.premiumSubscriptionStatus || "authorized");
  if (opts.mpPreapprovalId) user.mpPreapprovalId = opts.mpPreapprovalId;
  if (opts.nextPaymentAt !== undefined) {
    user.premiumNextPaymentAt = opts.nextPaymentAt;
  } else {
    user.premiumNextPaymentAt = endsAt;
  }
  if (opts.cancelAtPeriodEnd !== undefined) {
    user.premiumCancelAtPeriodEnd = opts.cancelAtPeriodEnd;
  } else {
    user.premiumCancelAtPeriodEnd = false;
  }
  user.likesRechargeAt = null;

  if (!samePlan) {
    // Cambio de plan: reinicia agenda de cupos y deja la carga del mes actual.
    user.premiumAllowanceCyclesLeft = 0;
    user.premiumAllowanceNextAt = null;
    creditPurchaseAllowances(user, opts.planId, opts.periodMonths, now, "set");
  } else {
    creditPurchaseAllowances(user, opts.planId, opts.periodMonths, now, "add");
  }

  await user.save();
  await keepNewestActivePresences(
    opts.userId,
    maxActivePresencesForPlan(opts.planId)
  );
  return user;
}

export async function activateBoost(
  userId: string
): Promise<
  | { ok: true; user: UserDocument }
  | { ok: false; status: number; error: string; code?: string }
> {
  const synced = await syncExpiredPremium(userId);
  const user = synced ?? (await User.findById(userId));
  if (!user || !isPremiumActive(user)) {
    return {
      ok: false,
      status: 403,
      error: "Necesitás Premium 4 A.M. para usar Boost",
      code: "PREMIUM_REQUIRED",
    };
  }
  if (!planHasFeature(String(user.premiumPlanId), "boost")) {
    return {
      ok: false,
      status: 403,
      error: "Boost está disponible desde Nocta 4 A.M.",
      code: "PLAN_REQUIRED",
    };
  }
  if (isBoostActive(user)) {
    return {
      ok: false,
      status: 409,
      error: "Ya tenés un Boost activo",
      code: "BOOST_ACTIVE",
    };
  }
  if ((user.boostsRemaining ?? 0) <= 0) {
    return {
      ok: false,
      status: 429,
      error: "No te quedan Boosts este periodo",
      code: "NO_BOOSTS",
    };
  }

  user.boostsRemaining = (user.boostsRemaining ?? 0) - 1;
  user.boostExpiresAt = new Date(Date.now() + BOOST_DURATION_MS);
  await user.save();
  return { ok: true, user };
}

export async function consumeHeartshot(
  userId: string
): Promise<
  | { ok: true; user: UserDocument }
  | { ok: false; status: number; error: string; code?: string }
> {
  await syncExpiredPremium(userId);
  const user = await User.findById(userId);
  if (!user || !isPremiumActive(user)) {
    return {
      ok: false,
      status: 403,
      error: "Necesitás Premium 4 A.M. para enviar Heartshot",
      code: "PREMIUM_REQUIRED",
    };
  }
  if (!planHasFeature(String(user.premiumPlanId), "heartshot")) {
    return {
      ok: false,
      status: 403,
      error: "Heartshot está disponible desde Nocta 4 A.M.",
      code: "PLAN_REQUIRED",
    };
  }
  if ((user.heartshotsRemaining ?? 0) <= 0) {
    return {
      ok: false,
      status: 429,
      error: "No te quedan Heartshots este periodo",
      code: "NO_HEARTSHOTS",
    };
  }

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      heartshotsRemaining: { $gt: 0 },
    },
    { $inc: { heartshotsRemaining: -1 } },
    { new: true }
  );
  if (!updated) {
    return {
      ok: false,
      status: 429,
      error: "No te quedan Heartshots este periodo",
      code: "NO_HEARTSHOTS",
    };
  }
  return { ok: true, user: updated };
}

export async function refundHeartshot(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $inc: { heartshotsRemaining: 1 } });
}

export async function markPremiumCancelledAtPeriodEnd(
  userId: string
): Promise<UserDocument | null> {
  const user = await User.findById(userId);
  if (!user) return null;
  user.premiumCancelAtPeriodEnd = true;
  user.premiumSubscriptionStatus = "cancelled";
  user.premiumNextPaymentAt = null;
  await user.save();
  return user;
}

export async function markPremiumPaused(
  userId: string
): Promise<UserDocument | null> {
  const user = await User.findById(userId);
  if (!user) return null;
  user.premiumSubscriptionStatus = "paused";
  user.premiumNextPaymentAt = null;
  await user.save();
  return user;
}
