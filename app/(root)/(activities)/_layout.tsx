import { Stack } from "expo-router";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.

const Layout = () => {
  return (
    <Stack>
      <Stack.Screen name="chargeStart" options={{ headerShown: false }} />
      <Stack.Screen
        name="reservation/[connectorId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="reservation/details/[reservationId]"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="ChargeHistory" options={{ headerShown: false }} />
      <Stack.Screen name="[chargeHistoryId]" options={{ headerShown: false }} />
    </Stack>
  );
};
export default Layout;
