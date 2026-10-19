type ImageFiles = Record<string, string>;

const gridFiles = import.meta.glob('../../Images/*_Grid.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as ImageFiles;

const stockFiles = import.meta.glob('../../Images/*_Stock.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as ImageFiles;

function normalize(value: string) {
  return value.toLowerCase().replace(/^mr[._\s-]*/, '').replace(/[^a-z0-9]/g, '');
}

function imageMap(files: ImageFiles, suffix: 'Grid' | 'Stock') {
  return new Map(Object.entries(files).map(([path, url]) => {
    const filename = path.split('/').pop() ?? '';
    const name = filename.replace(/^PPlus_/i, '').replace(new RegExp(`_${suffix}\\.png$`, 'i'), '');
    return [normalize(name), url];
  }));
}

const gridImages = imageMap(gridFiles, 'Grid');
const stockImages = imageMap(stockFiles, 'Stock');
const portraitImages=new Map(Object.entries(import.meta.glob('../../Images/*_Portrait.png',{eager:true,import:'default',query:'?url'}) as ImageFiles).map(([path,url])=>[normalize((path.split('/').pop()??'').replace(/^PPlus_/i,'').replace(/_Portrait\.png$/i,'')),url]));
export function fighterPortraitImage(id:string,name:string){return findImage(portraitImages,id,name);}

const fighterAliases = new Map([
  ['cfalcon', 'captainfalcon'],
  ['dedede', 'kingdedede'],
  ['donkey', 'donkeykong'],
  ['diddy', 'diddykong'],
  ['gameandwatch', 'gamewatch'],
  ['gw', 'gamewatch'],
  ['zerosuit', 'zerosuitsamus'],
]);

function findNamedImage(images: Map<string, string>, value: string) {
  const candidates = [
    value,
    value.replace(/\s*\([^)]*\).*$/, '').trim(),
    value.replace(/\s+(?:\d+|RHUS)$/i, '').trim(),
  ];
  for (const candidate of candidates) {
    const key = normalize(candidate);
    const image = images.get(key) ?? images.get(fighterAliases.get(key) ?? '');
    if (image) return image;
  }
}

function findImage(images: Map<string, string>, id: string, name: string) {
  return findNamedImage(images, id) ?? findNamedImage(images, name);
}

export function fighterGridImage(id: string, name: string) {
  return findImage(gridImages, id, name);
}

export function fighterStockImage(id: string, name: string) {
  return findImage(stockImages, id, name);
}
