import type { NavigatorScreenParams } from "@react-navigation/native";
import type { PremiumPlanId } from "@nocta/shared";

export type HumanCheckParams =
  | { kind: "login"; email: string; password: string }
  | {
      kind: "register";
      email: string;
      password: string;
      name: string;
      marketingEmailsOptIn: boolean;
    }
  | { kind: "forgot"; email: string };

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email?: string } | undefined;
  ForgotPassword: undefined;
  HumanCheck: HumanCheckParams;
  ResetPassword: { token: string };
  AuthCallback: { token?: string };
  Terms: undefined;
};

export type MainTabParamList = {
  Venues: undefined;
  Likes: undefined;
  Discover: { venueId?: string; userId?: string } | undefined;
  Matches: undefined;
  Profile: { focus?: "settings" | "requests" } | undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  PendingDeletion: undefined;
  Onboarding: { edit?: boolean; step?: number } | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  VenueDetail: { venueId: string };
  Chat: { matchId: string };
  Notifications: undefined;
  Premium: { planId?: PremiumPlanId } | undefined;
  Terms: undefined;
  MyPromos: undefined;
  UserReport: { userId: string };
  Ad: { adId: string };
  ReportResolution: { reportId: string };
  VenueRequest: undefined;
  VenueManage: { venueId: string };
  VenueEdit: { venueId: string };
  ResetPassword: { token: string };
};
