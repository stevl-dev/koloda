import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import type { LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from "react-native";
import { GestureDetector, GestureStateManager, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { dragOwner, SWIPE_ARROWS, swipeGrade, swipeProgress } from "./swipe-grades";
import type { ScrollRoom } from "./swipe-grades";

export type SwipeableCardProps = {
  // WHY: a new key resets the offsets, so the next card fades in from the center.
  cardKey: number;
  isEnabled: boolean;
  onSwipe: (gradeIndex: number) => void;
  // INVARIANT: the grade labels in `FSRS_GRADES` order, shown on the card while a drag points at them.
  gradeLabels: readonly string[];
  hintStyle?: StyleProp<TextStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// INVARIANT: the swipe, its hint, and the card leaving the screen run on the UI thread; only the grade crosses to JS.
export function SwipeableCard({
  cardKey,
  isEnabled,
  onSwipe,
  gradeLabels,
  hintStyle,
  contentContainerStyle,
  style,
  children,
}: SwipeableCardProps) {
  const { scrollRoom, scrollProps } = useCardScroll();
  const { width, height } = useWindowDimensions();
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const appear = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    offsetX.value = 0;
    offsetY.value = 0;
    appear.value = 0;
    appear.value = withTiming(1, { duration: 180 });
  }, [cardKey, offsetX, offsetY, appear]);

  const pan = usePanGesture({
    enabled: isEnabled,
    // WHY: the pan decides from the content's scroll whether a vertical drag is a swipe; see `dragOwner`.
    manualActivation: true,
    onTouchesDown: (event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      startX.value = touch.absoluteX;
      startY.value = touch.absoluteY;
    },
    onTouchesMove: (event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const owner = dragOwner(touch.absoluteX - startX.value, touch.absoluteY - startY.value, scrollRoom.value);
      if (owner === "swipe") GestureStateManager.activate(event.handlerTag);
      else if (owner === "scroll") GestureStateManager.fail(event.handlerTag);
    },
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
      <Animated.View style={[styles.card, style, animatedStyle]}>
        <Animated.ScrollView {...scrollProps} contentContainerStyle={contentContainerStyle}>
          {children}
        </Animated.ScrollView>
        {gradeLabels.map((label, gradeIndex) => (
          <SwipeHint
            key={gradeIndex}
            gradeIndex={gradeIndex}
            label={`${SWIPE_ARROWS[gradeIndex]} ${label}`}
            offsetX={offsetX}
            offsetY={offsetY}
            style={hintStyle}
          />
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

// The room the card's content has to scroll, which `dragOwner` reads on the UI thread.
function useCardScroll() {
  const scrollRoom = useSharedValue<ScrollRoom>({ offset: 0, content: 0, viewport: 0 });
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollRoom.value = {
      offset: event.contentOffset.y,
      content: event.contentSize.height,
      viewport: event.layoutMeasurement.height,
    };
  });
  return {
    scrollRoom,
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
      onContentSizeChange: (_width: number, height: number) => {
        scrollRoom.value = { ...scrollRoom.value, content: height };
      },
      onLayout: (event: LayoutChangeEvent) => {
        scrollRoom.value = { ...scrollRoom.value, viewport: event.nativeEvent.layout.height };
      },
    },
  };
}

type SwipeHintProps = {
  gradeIndex: number;
  label: string;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  style?: StyleProp<TextStyle>;
};

function SwipeHint({ gradeIndex, label, offsetX, offsetY, style }: SwipeHintProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = swipeProgress(offsetX.value, offsetY.value, gradeIndex);
    return { opacity: progress, transform: [{ scale: 0.9 + progress * 0.1 }] };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hint, animatedStyle]}>
      <Animated.Text style={[styles.hintLabel, style]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  hint: { alignItems: "center", justifyContent: "center" },
  hintLabel: { fontSize: 28, fontWeight: "700", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
});
