// Keep every distinct collision parameter set. Motion alone does not create
// duplicate cards; disjoint active windows remain attached to the same phase.
export function extractStudyHits(move, entry) {
  const phases = new Map(), ordinals = new Map();
  function add(kind, values, frame, boxIndex, hitboxId, radius) {
    const base = `${kind}:${hitboxId ?? 'event'}:${values.set_id ?? '-'}`;
    const signature = JSON.stringify([Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b))),radius]);
    const key = `${base}:${signature}`;
    let phase = phases.get(key);
    if (!phase) {
      const ordinal = (ordinals.get(base) ?? 0) + 1; ordinals.set(base, ordinal);
      phase = {id:`${entry.id}:${base}:${ordinal}`,moveId:entry.id,path:entry.path,internalName:entry.internalName,kind,hitboxId:hitboxId??null,frame,boxIndex,radius,ranges:[],values};
      phases.set(key, phase);
    }
    const last = phase.ranges.at(-1);
    if (last && last[1] === frame - 1) last[1] = frame;
    else if (!last || last[1] !== frame) phase.ranges.push([frame,frame]);
  }
  move.frames.forEach((frame,i)=>{
    frame.hit_boxes.forEach((box,boxIndex)=>{
      if ('Hit' in box.next_values) {
        if (box.next_values.Hit.enabled) add('hit',box.next_values.Hit,i+1,boxIndex,box.hitbox_id,box.next_size);
      } else if ('Grab' in box.next_values) add('grab',box.next_values.Grab,i+1,boxIndex,box.hitbox_id,box.next_size);
    });
    if (frame.throw) add('throw',frame.throw,i+1,null,null);
  });
  return [...phases.values()];
}
