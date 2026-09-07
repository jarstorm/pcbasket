import { MaterialIcons } from "@expo/vector-icons";

export default function Icon({ name, size = 18, color, style }) {
  return <MaterialIcons name={name} size={size} color={color} style={style} />;
}
