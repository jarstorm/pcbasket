import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors } from "../theme";

export default function Table({ columns, data, rowKey, rowStyle }) {
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
          <View
            key={rowKey ? rowKey(row) : i}
            style={[styles.row, rowStyle ? rowStyle(row) : null]}
          >
            {columns.map((col) => (
              <View key={col.key} style={[styles.cell, { width: col.width || 90 }]}>
                {col.render ? col.render(row) : <Text style={styles.cellText}>{row[col.key]}</Text>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: "center",
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
});
