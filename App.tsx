// Minimal reproduction for react-native-sortables #605
// (`autoAdjustOffsetDuringDrag` + collapsible items).
//
// Bug 1: drag once → tap "Collapse all" (no drag) → layout shifts far down and
//        sorting is permanently dead until an item is expanded again.
// Bug 2: collapse all FIRST → long-press any item → it lifts and follows the
//        finger, but no reorder ever fires (slot stays put, items frozen).
//
// See README.md for step-by-step scripts.

import { StatusBar } from "expo-status-bar"
import React, { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, { useAnimatedRef } from "react-native-reanimated"
import Sortable from "react-native-sortables"

const COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8",
  "#f58231", "#911eb4", "#46f0f0", "#f032e6",
]

type Item = { id: string; color: string; label: string }

const ITEMS: Item[] = COLORS.map((color, i) => ({
  id: `item-${i}`,
  color,
  label: `Item ${i + 1}`,
}))

const COLLAPSED_H = 72
const EXPANDED_H = 280

export default function App() {
  const [items, setItems] = useState(ITEMS)
  // Per-item expanded state + a force-collapse flag during drags (mirrors a
  // real app that collapses cards while sorting).
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.id, true])),
  )
  const [isDragging, setIsDragging] = useState(false)

  const scrollableRef = useAnimatedRef<Animated.ScrollView>()

  // Diagnostic event log — proves the bugs without touching the library:
  //  bug 1: "touch …" lines keep arriving but "DRAG ACTIVATED" never follows.
  //  bug 2: "DRAG ACTIVATED" fires but no "ORDER CHANGE" ever appears.
  const [events, setEvents] = useState<string[]>([])
  const logEvent = useCallback((msg: string) => {
    const line = `${new Date().toISOString().slice(14, 23)}  ${msg}`
    console.log("[repro]", line)
    setEvents((e) => [line, ...e].slice(0, 7))
  }, [])

  const allCollapsed = items.every((i) => !expanded[i.id])
  const toggleAll = useCallback(() => {
    setExpanded(Object.fromEntries(ITEMS.map((i) => [i.id, allCollapsed])))
  }, [allCollapsed])

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      const isExpanded = expanded[item.id] && !isDragging
      return (
        <View
          onTouchStart={() => logEvent(`touch      ${item.label}`)}
          style={[
            styles.card,
            { backgroundColor: item.color, height: isExpanded ? EXPANDED_H : COLLAPSED_H },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Pressable
              hitSlop={12}
              onPress={() =>
                setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))
              }
            >
              <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
            </Pressable>
          </View>
          {isExpanded && (
            <Text style={styles.cardBody}>
              Expanded content — this area disappears while collapsed or during
              a drag, shrinking the item from {EXPANDED_H} to {COLLAPSED_H} px.
            </Text>
          )}
        </View>
      )
    },
    [expanded, isDragging, logEvent],
  )

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.toolbar}>
        <Pressable style={styles.button} onPress={toggleAll}>
          <Text style={styles.buttonText}>
            {allCollapsed ? "Expand all" : "Collapse all"}
          </Text>
        </Pressable>
        <Text style={styles.hint}>long-press a card to drag</Text>
      </View>
      <Animated.ScrollView ref={scrollableRef} contentContainerStyle={styles.content}>
        <Sortable.Grid
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          columns={1}
          rowGap={8}
          dragActivationDelay={400}
          activeItemScale={1.05}
          enableActiveItemSnap={false}
          dimensionsAnimationType="worklet"
          scrollableRef={scrollableRef}
          autoAdjustOffsetDuringDrag
          onDragStart={({ key }) => {
            logEvent(`DRAG ACTIVATED  ${key}`)
            setIsDragging(true)
          }}
          onOrderChange={({ fromIndex, toIndex }) =>
            logEvent(`ORDER CHANGE  ${fromIndex} -> ${toIndex}`)
          }
          onDragEnd={({ data, indexToKey }) => {
            logEvent(`DROP  order: ${indexToKey.map((k: string) => k.slice(-1)).join(",")}`)
            setIsDragging(false)
            setItems(data)
          }}
        />
      </Animated.ScrollView>
      <View style={styles.logOverlay} pointerEvents="none">
        {events.map((e, i) => (
          <Text key={i} style={[styles.logLine, i === 0 && styles.logLineLatest]}>
            {e}
          </Text>
        ))}
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f4f4", paddingTop: 64 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  button: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  hint: { color: "#666" },
  content: { padding: 16, paddingBottom: 120 },
  card: { borderRadius: 12, padding: 16, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: { fontSize: 16, fontWeight: "700", color: "#fff" },
  chevron: { fontSize: 16, color: "#fff" },
  cardBody: { marginTop: 12, color: "#fff", opacity: 0.85 },
  logOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.82)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logLine: { color: "#9e9e9e", fontFamily: "Menlo", fontSize: 11 },
  logLineLatest: { color: "#4ade80" },
})
