import type { PipelineStage } from "mongoose";
import {
  ADMIN_OVERVIEW_USD_UYU_RATE,
  ENABLED_VENUE_COUNTRIES,
  PREMIUM_PLAN_IDS,
  type AdminMonthlySeries,
  type AdminOverviewResponse,
  type PremiumPlanId,
} from "@nocta/shared";
import { User } from "../models/User.js";
import { Venue } from "../models/Venue.js";
import { Presence } from "../models/Presence.js";
import { Match } from "../models/Match.js";
import { Report } from "../models/Report.js";
import { VenueRequest } from "../models/VenueRequest.js";
import { VenueReview } from "../models/VenueReview.js";
import { PromoPurchase } from "../models/PromoPurchase.js";
import { PremiumPurchase } from "../models/PremiumPurchase.js";
import { AppCity } from "../models/AppCity.js";
import { expireStalePresences } from "./presence.js";

const MONTHS = 12;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Primer día UTC del mes, N meses atrás desde `now` (0 = mes actual). */
function startOfMonthUtc(now: Date, monthsAgo: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1, 0, 0, 0, 0)
  );
}

export function buildOverviewMonths(now = new Date()): {
  months: string[];
  rangeStart: Date;
  rangeEnd: Date;
} {
  const months: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i -= 1) {
    months.push(monthKey(startOfMonthUtc(now, i)));
  }
  const rangeStart = startOfMonthUtc(now, MONTHS - 1);
  const rangeEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );
  return { months, rangeStart, rangeEnd };
}

function emptySeries(len: number): AdminMonthlySeries {
  return Array.from({ length: len }, () => 0);
}

function fillSeries(
  months: string[],
  rows: Array<{ _id: string | null; count?: number; value?: number }>,
  field: "count" | "value" = "count"
): AdminMonthlySeries {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row._id) continue;
    map.set(row._id, Number(row[field] ?? 0));
  }
  return months.map((m) => map.get(m) ?? 0);
}

type MonthCountRow = { _id: string | null; count: number };
type MonthValueRow = { _id: string | null; value: number };

async function monthlyCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: { aggregate: (pipeline: PipelineStage[]) => any },
  dateField: string,
  rangeStart: Date,
  rangeEnd: Date,
  matchExtra: Record<string, unknown> = {}
): Promise<MonthCountRow[]> {
  const rows = await model.aggregate([
    {
      $match: {
        ...matchExtra,
        [dateField]: { $gte: rangeStart, $lt: rangeEnd },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: `$${dateField}`, timezone: "UTC" },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  return rows as MonthCountRow[];
}

export async function buildAdminOverview(
  now = new Date()
): Promise<AdminOverviewResponse> {
  await expireStalePresences();
  const { months, rangeStart, rangeEnd } = buildOverviewMonths(now);
  const premiumActiveFilter = {
    premium: true,
    $or: [
      { premiumExpiresAt: null },
      { premiumExpiresAt: { $gt: now } },
    ],
  };

  const [
    usersCount,
    adminsCount,
    matchesCount,
    openReportsCount,
    premiumActive,
    venuesCount,
    ownerlessVenues,
    activePresences,
    bestRated,
    worstRated,
    pendingRequests,
    approvedRequests,
    rejectedRequests,
    promoMetrics,
    premiumPurchaseMetrics,
    usersBeforeRange,
    usersMonthlyRows,
    premiumPlanMonthlyRows,
    presenceMonthlyRows,
    ratingsMonthlyRows,
    requestsMonthlyRows,
    manageMonthlyRows,
    suggestMonthlyRows,
    promoRevenueMonthlyRows,
    promoCountMonthlyRows,
    premiumRevenueMonthlyRows,
    premiumCountMonthlyRows,
    activeCities,
    inactiveCities,
    activeCountryRows,
    allCityCountryRows,
    topCountryRows,
    venuesByCountryRows,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "admin" }),
    Match.countDocuments(),
    Report.countDocuments({ status: "open" }),
    User.countDocuments(premiumActiveFilter),
    Venue.countDocuments({ active: true }),
    Venue.countDocuments({
      $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
    }),
    Presence.countDocuments({ status: "active" }),
    Venue.find({ active: true, ratingCount: { $gt: 0 } })
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .limit(1)
      .select({ name: 1, ratingAvg: 1 })
      .lean(),
    Venue.find({ active: true, ratingCount: { $gt: 0 } })
      .sort({ ratingAvg: 1, ratingCount: -1 })
      .limit(1)
      .select({ name: 1, ratingAvg: 1 })
      .lean(),
    VenueRequest.countDocuments({ status: "pending" }),
    VenueRequest.countDocuments({ status: "approved" }),
    VenueRequest.countDocuments({ status: "rejected" }),
    PromoPurchase.aggregate<{ purchases: number; revenueUyu: number }>([
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          revenueUyu: { $sum: { $ifNull: ["$priceUyu", 0] } },
        },
      },
    ]),
    PremiumPurchase.aggregate<{ purchases: number; revenueUsd: number }>([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          revenueUsd: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
    User.countDocuments({ createdAt: { $lt: rangeStart } }),
    monthlyCounts(User, "createdAt", rangeStart, rangeEnd),
    PremiumPurchase.aggregate<{
      _id: { month: string | null; planId: string | null };
      count: number;
    }>([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt",
                timezone: "UTC",
              },
            },
            planId: "$planId",
          },
          count: { $sum: 1 },
        },
      },
    ]),
    monthlyCounts(Presence, "startsAt", rangeStart, rangeEnd),
    VenueReview.aggregate<MonthValueRow>([
      {
        $match: {
          active: true,
          createdAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          value: { $avg: "$rating" },
        },
      },
    ]),
    monthlyCounts(VenueRequest, "createdAt", rangeStart, rangeEnd),
    monthlyCounts(VenueRequest, "createdAt", rangeStart, rangeEnd, {
      $or: [{ wantsToManage: true }, { requestType: "claim" }],
    }),
    monthlyCounts(VenueRequest, "createdAt", rangeStart, rangeEnd, {
      wantsToManage: false,
      requestType: { $ne: "claim" },
    }),
    PromoPurchase.aggregate<MonthValueRow>([
      {
        $match: {
          purchasedAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$purchasedAt",
              timezone: "UTC",
            },
          },
          value: { $sum: { $ifNull: ["$priceUyu", 0] } },
        },
      },
    ]),
    monthlyCounts(PromoPurchase, "purchasedAt", rangeStart, rangeEnd),
    PremiumPurchase.aggregate<MonthValueRow>([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: rangeStart, $lt: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          value: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
    monthlyCounts(PremiumPurchase, "createdAt", rangeStart, rangeEnd, {
      status: "approved",
    }),
    AppCity.countDocuments({ active: true }),
    AppCity.countDocuments({ active: false }),
    AppCity.aggregate<{ _id: string }>([
      { $match: { active: true } },
      { $group: { _id: "$country" } },
    ]),
    AppCity.aggregate<{ _id: string }>([{ $group: { _id: "$country" } }]),
    Venue.aggregate<{ _id: string; count: number }>([
      { $match: { active: true } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    Venue.aggregate<{ _id: string; count: number }>([
      { $match: { active: true } },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const usersNewMonthly = fillSeries(months, usersMonthlyRows, "count");
  let running = usersBeforeRange;
  const usersCumulativeMonthly: AdminMonthlySeries = usersNewMonthly.map(
    (n: number) => {
      running += n;
      return running;
    }
  );

  const premiumByPlanMonthly = Object.fromEntries(
    PREMIUM_PLAN_IDS.map((id) => [id, emptySeries(months.length)])
  ) as Record<PremiumPlanId, AdminMonthlySeries>;
  for (const row of premiumPlanMonthlyRows) {
    const month = row._id.month;
    const planId = row._id.planId;
    if (
      !month ||
      !planId ||
      !(PREMIUM_PLAN_IDS as readonly string[]).includes(planId)
    ) {
      continue;
    }
    const idx = months.indexOf(month);
    if (idx >= 0) {
      premiumByPlanMonthly[planId as PremiumPlanId][idx] = row.count;
    }
  }

  const promoRevenueUyu = promoMetrics[0]?.revenueUyu ?? 0;
  const promoPurchases = promoMetrics[0]?.purchases ?? 0;
  const premiumRevenueUsd = premiumPurchaseMetrics[0]?.revenueUsd ?? 0;
  const premiumPurchasesApproved = premiumPurchaseMetrics[0]?.purchases ?? 0;

  const promoUyuMonthly = fillSeries(months, promoRevenueMonthlyRows, "value");
  const premiumUsdMonthly = fillSeries(
    months,
    premiumRevenueMonthlyRows,
    "value"
  );
  const totalUsdMonthly = months.map(
    (_, i) =>
      Math.round(
        ((promoUyuMonthly[i] ?? 0) / ADMIN_OVERVIEW_USD_UYU_RATE +
          (premiumUsdMonthly[i] ?? 0)) *
          100
      ) / 100
  );
  const promoTxMonthly = fillSeries(months, promoCountMonthlyRows, "count");
  const premiumTxMonthly = fillSeries(months, premiumCountMonthlyRows, "count");
  const transactionsMonthly = months.map(
    (_, i) => promoTxMonthly[i]! + premiumTxMonthly[i]!
  );

  const totalRevenueUsd =
    Math.round(
      (promoRevenueUyu / ADMIN_OVERVIEW_USD_UYU_RATE + premiumRevenueUsd) * 100
    ) / 100;

  const activeCountrySet = new Set(
    activeCountryRows.map((r) => r._id).filter(Boolean)
  );
  const catalogCountries = new Set<string>([
    ...ENABLED_VENUE_COUNTRIES,
    ...allCityCountryRows.map((r) => r._id).filter(Boolean),
  ]);
  let inactiveCountries = 0;
  for (const country of catalogCountries) {
    if (!activeCountrySet.has(country)) inactiveCountries += 1;
  }

  const best = bestRated[0];
  const worst = worstRated[0];

  const ratingsAvgMonthly = fillSeries(months, ratingsMonthlyRows, "value").map(
    (v: number) => Math.round(v * 100) / 100
  );

  return {
    months,
    users: {
      cards: {
        users: usersCount,
        admins: adminsCount,
        matches: matchesCount,
        openReports: openReportsCount,
        premiumActive,
      },
      premiumByPlanMonthly,
      usersCumulativeMonthly,
    },
    venues: {
      cards: {
        venues: venuesCount,
        ownerlessVenues,
        activePresences,
        bestRated: best
          ? {
              id: String(best._id),
              name: best.name,
              value: best.ratingAvg ?? 0,
            }
          : null,
        worstRated: worst
          ? {
              id: String(worst._id),
              name: worst.name,
              value: worst.ratingAvg ?? 0,
            }
          : null,
      },
      presencesMonthly: fillSeries(months, presenceMonthlyRows, "count"),
      ratingsAvgMonthly,
    },
    requests: {
      cards: {
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
      },
      requestsMonthly: fillSeries(months, requestsMonthlyRows, "count"),
      manageMonthly: fillSeries(months, manageMonthlyRows, "count"),
      suggestMonthly: fillSeries(months, suggestMonthlyRows, "count"),
    },
    transactions: {
      cards: {
        promoRevenueUyu,
        promoPurchases,
        premiumRevenueUsd,
        premiumPurchasesApproved,
        totalRevenueUsd,
      },
      revenueMonthly: {
        promoUyu: promoUyuMonthly,
        premiumUsd: premiumUsdMonthly,
        totalUsd: totalUsdMonthly,
      },
      transactionsMonthly,
    },
    cities: {
      cards: {
        activeCountries: activeCountrySet.size,
        activeCities,
        inactiveCountries,
        inactiveCities,
        topCountryByVenues: topCountryRows[0]
          ? {
              name: topCountryRows[0]._id,
              value: topCountryRows[0].count,
            }
          : null,
      },
      venuesByCountry: venuesByCountryRows.map((row) => ({
        name: row._id,
        value: row.count,
      })),
    },
  };
}
