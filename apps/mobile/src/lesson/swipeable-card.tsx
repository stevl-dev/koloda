import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const SWIPE_DISTANCE = 96;

// INVARIANT: a grade index in `FSRS_GRADES` order: left is Again, down is Hard, right is Good, up is Easy.
function swipeGrade(x: number, y: number): number | null {
  "worklet";
  if (Math.max(Math.abs(x), Math.abs(y)) < SWIPE_DISTANCE) return null;
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 0 : 2;
  return y > 0 ? 1 : 3;
}

export type SwipeableCardProps = {
  // WHY: a new key resets the offsets, so the next card fades in from the center.
  cardKey: number;
  isEnabled: boolean;
  onSwipe: (gradeIndex: number) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// INVARIANT: the swipe and the card leaving the screen run on the UI thread; only the grade crosses to JS.
export function SwipeableCard({ cardKey, isEnabled, onSwipe, style, children }: SwipeableCardProps) {
  const { width, height } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const appear = useSharedValue(0);

  useEffect(() => {
    offsetX.value = 0;
    offsetY.value = 0;
    appear.value = 0;
    appear.value = withTiming(1, { duration: 180 });
  }, [cardKey, offsetX, offsetY, appear]);

  const pan = usePanGesture({
    enabled: isEnabled,
    onUpdate: (event) => {
      offsetX.value = event.translationX;
      offsetY.value = event.translationY;
    },
    onDeactivate: (event) => {
      const gradeIndex = swipeGrade(event.translationX, event.translationY);
      if (gradeIndex === null) {
        offsetX.value = withSpring(0);
        offsetY.value = withSpring(0);
        return;
      }
      offsetX.value = withTiming(Math.sign(event.translationX) * width * 1.5, { duration: 160 });
      offsetY.value = withTiming(Math.sign(event.translationY) * height, { duration: 160 }, () => {
        scheduleOnRN(onSwipe, gradeIndex);
      });
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${offsetX.value / 30}deg` },
      { scale: 0.96 + appear.value * 0.04 },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
});
