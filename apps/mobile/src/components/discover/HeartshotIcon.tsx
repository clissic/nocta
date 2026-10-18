import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type Props = {
  size?: number;
  color?: string;
};

/** Heartshot: corazón + rayo (MaterialCommunityIcons `heart-flash`). */
export function HeartshotIcon({ size = 24, color = "#c4b5fd" }: Props) {
  return (
    <MaterialCommunityIcons name="heart-flash" size={size} color={color} />
  );
}
