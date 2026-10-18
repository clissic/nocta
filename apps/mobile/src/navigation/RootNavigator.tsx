import { useEffect } from "react";
import { AppState, View } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import * as Linking from "expo-linking";
import { useAuth } from "../auth/AuthContext";
import { LoadingBlock } from "../components/ui";
import { colors } from "../theme/tokens";
import {
  listenAndroidPush,
  registerAndroidPush,
  setPushNavigation,
} from "../lib/push";
import type {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "./types";

const navigationRef = createNavigationContainerRef<RootStackParamList>();
import { MainTabBar } from "./MainTabBar";
import { AppTopBar } from "../components/shell/AppTopBar";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";
import { VerifyEmailScreen } from "../screens/auth/VerifyEmailScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { HumanCheckScreen } from "../screens/auth/HumanCheckScreen";
import { ResetPasswordScreen } from "../screens/auth/ResetPasswordScreen";
import { AuthCallbackScreen } from "../screens/auth/AuthCallbackScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { PendingDeletionScreen } from "../screens/PendingDeletionScreen";
import { VenuesScreen } from "../screens/VenuesScreen";
import { VenueDetailScreen } from "../screens/VenueDetailScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { LikesScreen } from "../screens/LikesScreen";
import { MatchesScreen } from "../screens/MatchesScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PremiumScreen } from "../screens/PremiumScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { MyPromosScreen } from "../screens/MyPromosScreen";
import { UserReportScreen } from "../screens/UserReportScreen";
import { AdScreen } from "../screens/AdScreen";
import { ReportResolutionScreen } from "../screens/ReportResolutionScreen";
import { VenueRequestScreen } from "../screens/VenueRequestScreen";
import { VenueManageScreen } from "../screens/VenueManageScreen";
import { VenueEditScreen } from "../screens/VenueEditScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const GateStack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.canvas,
    card: colors.panel,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const linking = {
  prefixes: [Linking.createURL("/"), "nocta://"],
  config: {
    screens: {
      Login: "login",
      Register: "register",
      VerifyEmail: "verify-email",
      ForgotPassword: "forgot-password",
      ResetPassword: "auth/reset-password",
      AuthCallback: "auth/callback",
      Onboarding: "onboarding",
      PendingDeletion: "pending-deletion",
      Main: {
        screens: {
          Venues: "venues",
          Likes: "likes",
          Discover: "discover",
          Matches: "matches",
          Profile: "profile",
        },
      },
      VenueDetail: "venues/:venueId",
      Chat: "matches/:matchId",
    },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Venues" component={VenuesScreen} />
      <Tab.Screen name="Likes" component={LikesScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="HumanCheck" component={HumanCheckScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <AuthStack.Screen name="AuthCallback" component={AuthCallbackScreen} />
      <AuthStack.Screen name="Terms" component={TermsScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{ headerShown: false }}
      layout={({ children, state }) => {
        const route = state.routes[state.index];
        const hideBar =
          route?.name === "Onboarding" || route?.name === "Terms";
        return (
          <View style={{ flex: 1, backgroundColor: colors.canvas }}>
            {hideBar ? null : (
              <AppTopBar
                aboveTabs={route?.name === "Main"}
                routeKey={route?.key ?? ""}
              />
            )}
            <View style={{ flex: 1 }}>{children}</View>
          </View>
        );
      }}
    >
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen name="VenueDetail" component={VenueDetailScreen} />
      <RootStack.Screen name="Chat" component={ChatScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="Premium" component={PremiumScreen} />
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      <RootStack.Screen name="Terms" component={TermsScreen} />
      <RootStack.Screen name="MyPromos" component={MyPromosScreen} />
      <RootStack.Screen name="UserReport" component={UserReportScreen} />
      <RootStack.Screen name="Ad" component={AdScreen} />
      <RootStack.Screen
        name="ReportResolution"
        component={ReportResolutionScreen}
      />
      <RootStack.Screen name="VenueRequest" component={VenueRequestScreen} />
      <RootStack.Screen name="VenueManage" component={VenueManageScreen} />
      <RootStack.Screen name="VenueEdit" component={VenueEditScreen} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const {
    user,
    loading,
    planazosOffer,
    pendingOpenPremium,
    setPendingOpenPremium,
  } = useAuth();

  useEffect(() => {
    setPushNavigation(
      () =>
        Boolean(
          user?.emailVerified &&
            user.profileComplete &&
            !user.deletionRequestedAt &&
            !planazosOffer
        ),
      navigationRef
    );
  }, [user, planazosOffer]);

  useEffect(() => {
    if (!user || user.deletionRequestedAt || !user.emailVerified) return;
    void registerAndroidPush();
    void listenAndroidPush();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerAndroidPush();
    });
    return () => sub.remove();
  }, [user?.id, user?.emailVerified, user?.deletionRequestedAt]);

  useEffect(() => {
    if (!pendingOpenPremium) return;
    if (!user?.profileComplete || planazosOffer) return;
    const planId = pendingOpenPremium;
    setPendingOpenPremium(null);
    const open = () => {
      if (navigationRef.isReady()) {
        navigationRef.navigate("Premium", { planId });
      }
    };
    const t = setTimeout(open, 50);
    return () => clearTimeout(t);
  }, [
    pendingOpenPremium,
    planazosOffer,
    setPendingOpenPremium,
    user?.profileComplete,
  ]);

  if (loading) return <LoadingBlock label="Nocta…" />;

  const needsOnboardingGate =
    Boolean(user) &&
    !user!.deletionRequestedAt &&
    user!.emailVerified &&
    (!user!.profileComplete || planazosOffer);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking as never}
    >
      {!user ? (
        <AuthNavigator />
      ) : user.deletionRequestedAt ? (
        <GateStack.Navigator screenOptions={{ headerShown: false }}>
          <GateStack.Screen
            name="PendingDeletion"
            component={PendingDeletionScreen}
          />
        </GateStack.Navigator>
      ) : !user.emailVerified ? (
        <GateStack.Navigator screenOptions={{ headerShown: false }}>
          <GateStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        </GateStack.Navigator>
      ) : needsOnboardingGate ? (
        <GateStack.Navigator screenOptions={{ headerShown: false }}>
          <GateStack.Screen name="Onboarding" component={OnboardingScreen} />
        </GateStack.Navigator>
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
