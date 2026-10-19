import { fighterStockImage } from '../data/fighter-images';

export default function FighterName({ name, className = '' }: { name: string; className?: string }) {
  const icons = name.split(/\s*\/\s*/).map(part => fighterStockImage('', part)).filter((icon): icon is string => !!icon);
  return <span className={`fighter-name-with-icon ${className}`.trim()}>
    {icons.length > 0 && <span className="fighter-name-icons">{icons.map((icon, index) => <img className="fighter-name-icon" key={`${icon}-${index}`} src={icon} alt="" aria-hidden="true" loading="lazy" decoding="async"/>)}</span>}
    <span>{name}</span>
  </span>;
}
