interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export default function Avatar({ name, color, size = 36 }: AvatarProps) {
  const chars = size >= 40 ? name.slice(0, 2) : name.slice(0, 1);
  const fontSize = Math.round(size * 0.38);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color || "#6366f1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {chars.toUpperCase()}
    </div>
  );
}
