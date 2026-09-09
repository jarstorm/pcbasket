import { useRef, useEffect } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

export default function LoadingScreen({ label = "CARGANDO…", style }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.loading, style]}>
      <Animated.Image
        source={require("../../assets/splash-icon.png")}
        style={[styles.loadingBall, { transform: [{ rotate }] }]}
      />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingBall: { width: 72, height: 72, marginBottom: spacing.lg },
  loadingText: { color: colors.textDim, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
});
