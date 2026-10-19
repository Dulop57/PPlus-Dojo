import type { FrameRange, MoveData, MoveIndex } from './types';

const names: Record<string, [string, string, string]> = {
  Attack11: ['Jab 1', 'Ground attacks', 'jab'], Attack12: ['Jab 2', 'Ground attacks', 'jab'],
  Attack13: ['Jab 3', 'Ground attacks', 'jab'], Attack100: ['Rapid Jab', 'Ground attacks', 'jab'],
  Attack100End: ['Rapid Jab · End', 'Ground attacks', 'jab'], AttackDash: ['Dash Attack', 'Ground attacks', 'da'],
  AttackS3: ['Forward Tilt', 'Tilts', 'ftilt'], AttackS3Hi: ['Forward Tilt · High', 'Tilts', 'ftilt'],
  AttackS3S: ['Forward Tilt', 'Tilts', 'ftilt'],
  AttackS3Lw: ['Forward Tilt · Low', 'Tilts', 'ftilt'], AttackHi3: ['Up Tilt', 'Tilts', 'utilt'], AttackLw3: ['Down Tilt', 'Tilts', 'dtilt'],
  AttackS4: ['Forward Smash', 'Smashes', 'fsmash'], AttackS4Hi: ['Forward Smash · High', 'Smashes', 'fsmash'],
  AttackS4Lw: ['Forward Smash · Low', 'Smashes', 'fsmash'], AttackHi4: ['Up Smash', 'Smashes', 'usmash'], AttackLw4: ['Down Smash', 'Smashes', 'dsmash'],
  AttackAirN: ['Neutral Air', 'Aerials', 'nair'], AttackAirF: ['Forward Air', 'Aerials', 'fair'],
  AttackAirB: ['Back Air', 'Aerials', 'bair'], AttackAirHi: ['Up Air', 'Aerials', 'uair'], AttackAirLw: ['Down Air', 'Aerials', 'dair'],
  Catch: ['Standing Grab', 'Grabs & throws', 'grab'], CatchDash: ['Dash Grab', 'Grabs & throws', 'grab'],
  CatchTurn: ['Pivot Grab', 'Grabs & throws', 'grab'], CatchAttack: ['Pummel', 'Grabs & throws', 'pummel'],
  ThrowF: ['Forward Throw', 'Grabs & throws', 'fthrow'], ThrowB: ['Back Throw', 'Grabs & throws', 'bthrow'],
  ThrowHi: ['Up Throw', 'Grabs & throws', 'uthrow'], ThrowLw: ['Down Throw', 'Grabs & throws', 'dthrow'],
  Escape: ['Spot Dodge', 'Defense', 'dodge'], EscapeF: ['Forward Roll', 'Defense', 'roll'], EscapeB: ['Back Roll', 'Defense', 'roll'],
  EscapeAir: ['Air Dodge', 'Defense', 'airdodge'], GuardOn: ['Shield · Start', 'Defense', 'shield'], GuardOff: ['Shield · End', 'Defense', 'shield'],
};
export const categoryOrder = ['Ground attacks', 'Tilts', 'Smashes', 'Aerials', 'Specials', 'Grabs & throws', 'Defense', 'Ledge options', 'Get-up options', 'Slip', 'Movement', 'Other subactions'];
export function moveLabel(internal: string, fighterId?:string) {
  if (names[internal]) return { name: names[internal][0], category: names[internal][1], alias: names[internal][2] };
  if (internal.startsWith('Special') && /bitten|capture|egg|zitabata/i.test(internal)) return { name: internal, category: 'Other subactions', alias: '' };
  const smash = internal.match(/^Attack(S4|Hi4|Lw4)(SHi|SLw|S|Hi|Lw|Start|Hold|1|2|S2)?(_\d+)?$/);
  if (smash) {
    const direction = { S4: ['Forward', 'fsmash'], Hi4: ['Up', 'usmash'], Lw4: ['Down', 'dsmash'] }[smash[1]]!;
    const phase = smash[2];
    const fullFollowup=fighterId==='ike'&&internal==='AttackLw42'||['link','pit'].includes(fighterId??'')&&internal==='AttackS4S2';
    const suffix = phase === 'Hi'||phase==='SHi' ? ' · High' : phase === 'Lw'||phase==='SLw' ? ' · Low' : phase === 'Start' ? ' · Start subaction' : phase === 'Hold' ? ' · Charge loop' : phase==='1'?' · Hit 1':phase==='2'||phase==='S2'?` · Hit 2${fullFollowup?' (full sequence)':''}`:'';
    return { name: `${direction[0]} Smash${suffix}${smash[3] ? ` · Variant ${smash[3].slice(1)}` : ''}`, category: phase === 'Start' || phase === 'Hold' ? 'Smash subactions' : 'Smashes', alias: direction[1] };
  }
  if (internal.startsWith('Special')) {
    const match = internal.match(/^Special(Air)?(N|S|Hi|Lw)(.*)$/);
    if (match) {
      const direction: Record<string, string> = { N: 'Neutral', S: 'Side', Hi: 'Up', Lw: 'Down' };
      const suffix = match[3].replace(/([a-z])([A-Z])/g, '$1 $2');
      return { name: `${direction[match[2]]} Special${match[1] ? ' · Air' : ' · Ground'}${suffix ? ` · ${suffix}` : ''}`, category: 'Specials', alias: `${match[2]}b` };
    }
    return { name: internal, category: 'Specials', alias: '' };
  }
  if (internal.startsWith('Cliff')) return { name: internal.replace(/^Cliff/, 'Ledge · '), category: 'Ledge options', alias: 'ledge' };
  const getup = internal.match(/^Down(Stand|Attack|Forward|Back|Spot)(U|D)$/);
  if (getup) {
    const option: Record<string,string> = {Stand:'Stand up',Attack:'Get-up Attack',Forward:'Get-up Roll · Forward',Back:'Get-up Roll · Back',Spot:'Get-up · In place'};
    return {name:`${option[getup[1]]} · ${getup[2]}`,category:'Get-up options',alias:'getup'};
  }
  if (/^Passive/.test(internal)) return {name:internal.replace(/^Passive/,'Tech · ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/ · $/,''),category:'Get-up options',alias:'tech'};
  if (internal === 'SlipAttack') return {name:'Slip Attack',category:'Get-up options',alias:'getup'};
  if (/^Slip/.test(internal)) return {name:internal.replace(/([a-z])([A-Z])/g,'$1 $2'),category:'Other subactions',alias:'slip'};
  if (/^(Wait|Walk|Run|Dash|Turn|Jump|Fall|Landing|Squat)/.test(internal)) return { name: internal.replace(/([a-z])([A-Z])/g, '$1 $2'), category: 'Movement', alias: '' };
  return { name: internal, category: 'Other subactions', alias: '' };
}
/** Category used only by the fighter move picker; study topics keep their stable source categories. */
export function moveListCategory(internal: string) {
  if (/^Slip/.test(internal)) return 'Slip';
  const smash = internal.match(/^Attack(S4|Hi4|Lw4)(S|Hi|Lw|Start|Hold)?(_\d+)?$/);
  if (smash && (smash[2] === 'Start' || smash[2] === 'Hold')) return 'Other subactions';
  return moveLabel(internal).category;
}
export function smashStartFor(release: MoveIndex, moves: MoveIndex[], fighterId?:string) {
  if (release.totalFrames === 0) return undefined;
  const special=(fighterId==='ike'&&/^AttackLw4[12]$/.test(release.internalName))?'Lw4':(['link','pit'].includes(fighterId??'')&&release.internalName==='AttackS4S2')?'S4':undefined;
  const match = release.internalName.match(/^Attack(S4|Hi4|Lw4)(SHi|SLw|S|Hi|Lw)?(_\d+)?$/);
  if (!match&&!special) return undefined;
  const candidates = moves.filter(m => m.internalName === `Attack${special??match![1]}Start` && m.totalFrames > 0);
  // Ambiguous or absent phases retain the original animation rather than guessing.
  return candidates.length === 1 ? candidates[0] : undefined;
}
export function combineSmash(start: MoveData, release: MoveData): MoveData {
  if (start.fighterId !== release.fighterId || !start.frames.length || !release.frames.length) throw new Error('The smash sequence has missing or mismatched phases.');
  // The last Start frame is the transition to release, not an extra game frame.
  const opening = start.frames.slice(0, -1), count = opening.length;
  const offset = opening.at(-1) ?? {x_pos: 0, y_pos: 0};
  const frames = [...opening.map(f => ({...f})), ...release.frames.map(f => ({...f, x_pos: f.x_pos + offset.x_pos, y_pos: f.y_pos + offset.y_pos}))].map((f,index) => ({...f,index}));
  return {
    ...release, frames, iasa: release.iasa === null ? null : release.iasa + count,
    bad_interrupts: start.bad_interrupts || release.bad_interrupts,
    extent: { left: Math.min(start.extent.left, release.extent.left + offset.x_pos), right: Math.max(start.extent.right, release.extent.right + offset.x_pos), down: Math.min(start.extent.down, release.extent.down + offset.y_pos), up: Math.max(start.extent.up, release.extent.up + offset.y_pos) },
    warnings: [...new Set([...start.warnings, ...release.warnings])],
    sequence: { startName: start.name, startFrames: count, releaseName: release.name },
  };
}
export function ranges(flags: boolean[]): FrameRange[] {
  const result: FrameRange[] = [];
  let start = -1;
  flags.forEach((flag, index) => {
    if (flag && start < 0) start = index;
    if (!flag && start >= 0) { result.push([start + 1, index]); start = -1; }
  });
  if (start >= 0) result.push([start + 1, flags.length]);
  return result;
}
export function formatRanges(value: FrameRange[]) {
  return value.length ? value.map(([a, b]) => a === b ? `${a}` : `${a}–${b}`).join(', ') : 'None';
}
export function summarize(move: MoveData) {
  const active = ranges(move.frames.map(f => f.hit_boxes.some(h => !('Hit' in h.next_values) || h.next_values.Hit.enabled)));
  const throws = ranges(move.frames.map(f => f.throw !== null));
  const hits = move.frames.flatMap(f => f.hit_boxes.flatMap(h => 'Hit' in h.next_values && h.next_values.Hit.enabled ? [h.next_values.Hit] : []));
  const damage = [...hits.map(h => h.damage), ...move.frames.flatMap(f => f.throw ? [f.throw.damage] : [])];
  return {
    active: move.timing?.active??active, throws, startup: (move.timing?.active??active)[0]?.[0] ?? throws[0]?.[0] ?? null,
    damage: damage.length ? [Math.min(...damage), Math.max(...damage)] : null,
    total: move.frames.length, iasa: move.iasa === null ? null : move.iasa + 1,
    autocancel: move.landing_lag === null ? null : ranges(move.frames.map(f => !f.landing_lag)),
    lcancel: move.landing_lag === null ? null : Math.floor(move.landing_lag / 2),
    invincible: ranges(move.frames.map(f => f.hurt_boxes.length > 0 && f.hurt_boxes.every(h => h.state === 'Invincible'))),
    intangible: ranges(move.frames.map(f => f.hurt_boxes.length > 0 && f.hurt_boxes.every(h => h.state.startsWith('Intangible')))),
  };
}
