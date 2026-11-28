import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AccessibilityActionInfo } from "react-native";
import { useAppColors } from "../colors";
import { DraggableRow, useDragState } from "./draggable-row";

const GAP = 12;

export type SortableListProps<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  handleLabel: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
};

// A list whose rows a long press on their handle lifts and a drag moves.
// WHY: a screen reader cannot drag, so each handle also moves its row up or down as an accessibility action.
export function SortableList<T>({ items, keyOf, handleLabel, onMove, renderItem }: SortableListProps<T>) {
  const { _ } = useLingui();
  const colors = useAppColors();
  const drag = useDragState(items.map(keyOf));

  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const actions: AccessibilityActionInfo[] = [];
        if (index > 0) actions.push({ name: "moveUp", label: _(msg`mobile.sortable.move-up`) });
        if (index < items.length - 1) actions.push({ name: "moveDown", label: _(msg`mobile.sortable.move-down`) });
        const handle = (
          <View
            accessible
            accessibilityLabel={handleLabel(item, index)}
            accessibilityHint={_(msg`mobile.sortable.hint`)}
            accessibilityActions={actions}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === "moveUp") onMove(index, index - 1);
              if (nativeEvent.actionName === "moveDown") onMove(index, index + 1);
            }}
            style={styles.handle}
          >
            <Text style={[styles.grip, { color: colors.muted }]}>≡</Text>
          </View>
        );
        return (
          <DraggableRow key={keyOf(item)} index={index} drag={drag} gap={GAP} onDrop={onMove} handle={handle}>
            {renderItem(item, index)}
          </DraggableRow>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  // WHY: the handle stays wide and tall enough to press and hold.
  handle: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  grip: { fontSize: 24 },
});
