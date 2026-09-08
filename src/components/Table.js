import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors } from "../theme";

function Cell({ col, row }) {
  return (
    <View style={[styles.cell, { width: col.width || 90 }]}>
      {col.render ? col.render(row) : <Text style={styles.cellText}>{row[col.key]}</Text>}
    </View>
  );
}

// pinFirst keeps columns[0] (usually the player name) fixed while the rest
// of the row scrolls horizontally — avoids the primary action/identity
// column being pushed off-screen behind a wide stat table.
export default function Table({ columns, data, rowKey, rowStyle, pinFirst }) {
  if (!pinFirst) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.cell, { width: col.width || 90 }]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>
          {data.map((row, i) => (
            <View key={rowKey ? rowKey(row) : i} style={[styles.row, rowStyle ? rowStyle(row) : null]}>
              {columns.map((col) => (
                <Cell key={col.key} col={col} row={row} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  const [pinnedCol, ...scrollCols] = columns;
  return (
    <View style={{ flexDirection: "row" }}>
      <View>
        <View style={styles.headerRow}>
          <View style={[styles.cell, { width: pinnedCol.width || 90 }]}>
            <Text style={styles.headerText}>{pinnedCol.label}</Text>
          </View>
        </View>
        {data.map((row, i) => (
          <View key={rowKey ? rowKey(row) : i} style={[styles.row, rowStyle ? rowStyle(row) : null]}>
            <Cell col={pinnedCol} row={row} />
          </View>
        ))}
      </View>
      <View style={styles.pinDivider} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            {scrollCols.map((col) => (
              <View key={col.key} style={[styles.cell, { width: col.width || 90 }]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>
          {data.map((row, i) => (
            <View key={rowKey ? rowKey(row) : i} style={[styles.row, rowStyle ? rowStyle(row) : null]}>
              {scrollCols.map((col) => (
                <Cell key={col.key} col={col} row={row} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: "center",
    overflow: "hidden",
  },
  headerText: {
    color: colors.textDim,
    fontWeight: "600",
    textTransform: "uppercase",
    fontSize: 11,
  },
  cellText: {
    color: colors.text,
    fontSize: 13,
  },
  pinDivider: {
    width: 2,
    backgroundColor: colors.accent,
  },
});
