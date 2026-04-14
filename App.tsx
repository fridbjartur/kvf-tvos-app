import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LiveScreen } from "./src/screens/LiveScreen";
import { ProgramScreen } from "./src/screens/ProgramScreen";
import { SectionProvider } from "./src/context/SectionContext";
import { TopBar } from "./src/components/TopBar";
import { navigationRef } from "./src/navigation/ref";
import { palette, spacing } from "./src/theme";
import type { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.background,
    card: palette.panel,
    border: palette.border,
    primary: palette.focus,
    text: palette.text,
  },
};

export default function App() {
  const [routeName, setRouteName] = useState<string | undefined>(undefined);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background);
  }, []);

  function handleNavigationChange() {
    setRouteName(navigationRef.current?.getCurrentRoute()?.name);
  }

  // Keep top-level navigation focusable on every browsable screen so
  // tvOS can move cleanly between the header and the active content area.
  const tabsFocusable = true;

  return (
    <SafeAreaProvider>
      <SectionProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={navigationTheme}
          onReady={handleNavigationChange}
          onStateChange={handleNavigationChange}
        >
          <StatusBar hidden />
          <SafeAreaView
            edges={["left", "right"]}
            style={{
              flex: 1,
              backgroundColor: palette.background,
              paddingHorizontal: spacing.sm,
              paddingBottom: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <TopBar tabsFocusable={tabsFocusable} routeName={routeName} />
              <Stack.Navigator
                screenOptions={{
                  animation: Platform.isTV ? "fade" : "default",
                  contentStyle: { backgroundColor: palette.background },
                  headerLargeTitle: false,
                  headerShown: false,
                }}
              >
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Live" component={LiveScreen} />
                <Stack.Screen name="ProgramDetail" component={ProgramScreen} />
              </Stack.Navigator>
            </View>
          </SafeAreaView>
        </NavigationContainer>
      </SectionProvider>
    </SafeAreaProvider>
  );
}
