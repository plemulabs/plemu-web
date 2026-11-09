import { Icon } from "./icon";

export function NativeCartridge({
  title,
  system = "gb",
  cover,
}: {
  title: string;
  system?: string;
  cover?: string;
}) {
  return (
    <div
      className={`dn-native-cartridge dn-cartridge-${system}`}
      aria-hidden="true"
      title={title}
    >
      <div className="dn-native-ridges">
        <i />
        <i />
        <i />
      </div>
      <span className="dn-native-system">{system.toUpperCase()}</span>
      <div className="dn-native-label">
        {cover ? (
          <img src={cover} alt="" loading="lazy" draggable={false} />
        ) : (
          <Icon name="create" size={42} />
        )}
      </div>
      <span className="dn-native-contacts" />
    </div>
  );
}
