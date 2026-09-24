export const COURSE_COLORS = [
  { name: "Blue", value: "#2764C5" },
  { name: "Red", value: "#E63946" },
  { name: "Purple", value: "#7C3DBB" },
  { name: "Green", value: "#1B8B5A" },
  { name: "Brown", value: "#795548" },
  { name: "Orange", value: "#ED7A22" },
  { name: "Yellow", value: "#D8B400" },
  { name: "Bordeaux", value: "#6D163A" },
  { name: "Pink", value: "#D35A9B" },
  { name: "Gold", value: "#A97816" },
] as const;

export function textOnColor(color: string) {
  const n = parseInt(color.slice(1), 16);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return luminance > 0.179 ? "#17231f" : "#fff";
}
