import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReduceMotion } from "../lesson/swipeable-card";
import { dropIndex, rowShift } from "./sortable-moves";
import type { RowLayout } from "./sortable-moves";

// How long a press on a row's handle holds before the row lifts; a drag that starts sooner scrolls the screen.
const LIFT_DELAY = 250;

export type DragState = {
  activeIndex: SharedValue<number>;
  offset: SharedValue<number>;
  layouts: SharedValue<RowLayout[]>;
};

// The drag shared by one list's rows; `keys` are the rows' keys in their order.
export function useDragState(keys: readonly string[]): DragState {
  const activeIndex = useSharedValue(-1);
  const offset = useSharedValue(0);
  const layouts = useSharedValue<RowLayout[]>([]);
  const order = keys.join("\n");

  // WHY: a drop keeps the lifted row where the finger left it until the new order renders, so it does not jump back
  // to its old place for a frame; the new order puts it there, and only then does the drag end.
  useEffect(() => {
    activeIndex.value = -1;
    offset.value = 0;
    layouts.value = layouts.value.slice(0, order.split("\n").length);
  }, [order, activeIndex, offset, layouts]);

  return useMemo(() => ({ activeIndex, offset, layouts }), [activeIndex, offset, layouts]);
}

export type DraggableRowProps = {
  index: number;
  drag: DragState;
  // The space between rows, which a row moving to make room crosses too.
  gap: number;
  onDrop: (from: number, to: number) => void;
  handle: ReactNode;
  children: ReactNode;
};

// INVARIANT: the drag and the rows making room run on the UI thread; only the drop crosses to JS.
export function DraggableRow({ index, drag, gap, onDrop, handle, children }: DraggableRowProps) {
  const reduceMotion = useReduceMotion();
  const { activeIndex, offset, layouts } = drag;

  const pan = usePanGesture({
    activateAfterLongPress: LIFT_DELAY,
    onActivate: () => {
      activeIndex.value = index;
      offset.value = 0;
    },
    onUpdate: (event) => {
      offset.value = event.translationY;
    },
    onDeactivate: () => {
      const to = dropIndex(layouts.value, index, offset.value);
      if (to === index) {
        activeIndex.value = -1;
        offset.value = 0;
        return;
      }
      scheduleOnRN(onDrop, index, to);
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === index) return { zIndex: 1, opacity: 0.9, transform: [{ translateY: offset.value }] };
    if (active < 0) return { zIndex: 0, opacity: 1, transform: [{ translateY: 0 }] };
    const to = dropIndex(layouts.value, active, offset.value);
    const slot = (layouts.value[active]?.height ?? 0) + gap;
    return {
      zIndex: 0,
      opacity: 1,
      transform: [{ translateY: withTiming(rowShift(index, active, to, slot), { duration: 150, reduceMotion }) }],
    };
  });

  return (
    <Animated.View
      style={[styles.row, animatedStyle]}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        const next = [...layouts.value];
        next[index] = { y, height };
        layouts.value = next;
      }}
    >
      <GestureDetector gesture={pan}>{handle}</GestureDetector>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  content: { flex: 1 },
});
