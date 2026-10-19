# Flashcard stats — selection list

This is your active selection: **61 stat types** (53 character stats, one hitbubble table, and seven stage stats). Main attribute values and ranks are merged into one card per metric. Hitbubble cards ask for ID / type, Damage, Angle, KBG, BKB, and WDSK together.

Only checked entries below make cards. Uncheck or delete unwanted entries, then run `npm run study:select` (production builds also apply the selection).

Main metric answers include the data and rank together. Metrics with multiple components keep labeled values, such as A, B, and Sum. Move stats use normal tilt and smash versions only; special-attack move-stat and hitbubble cards are temporarily omitted for a later update. Intangible and invincible frame cards are excluded from Move stats. Missing values do not make cards. Active Frames uses the recorded windows, such as 4-6, 8-10; grab timings combine their first and last active endpoints into the same range format. First Actionable Frame combines animation length and IASA using the lower recorded value, or the available value when only one is recorded.

Attributes · Dodges also includes two cards for each fighter's Stand up U/D and forward/back Get-up Roll U/D: Intangible frames and Actionable. These six actions use their extracted moveset animation/hurtbox data, with a source link and animation preview. Intangible frames includes every recorded full-body intangible window (or None); Actionable uses the same animation-length/IASA rule described above. The existing checked Dodges stat types below select these cards. Universal standing-tech and tech-roll workbook cards remain separate.

Deleted stats, Z-scores, raw constants, movement calculations, and stage coordinates are excluded from this selection.

## Character stats / Move stats (all attack groups)
- [x] CS-bff17e10 — Active Frames
- [x] CS-35f66fed — First Actionable Frame
- [x] CS-68b2f29d — Autocancel frames
- [x] CS-50c42e06 — L-cancelled landing lag
- [x] CS-c03b519e — Throw event frames

## Character stats / Attributes · Dodges
- [x] CS-5feca0e9 — Actionable
- [x] CS-9e887d41 — Intangible frames
- [x] CS-84980f8c — Ledge grab
- [ ] CS-24886a37 — Spotdodge groups

## Character stats / Attributes · Grab Timings
- [x] CS-12fe8854 — Active Frames
- [x] CS-63339172 — SAF

## Character stats / Attributes · Ledge stuff
- [x] CS-e2ce1ba6 — Frame
- [x] CS-cda20f9e — Hit frames
- [x] CS-14798404 — Ledge available
- [x] CS-acb3bc21 — Note
- [x] CS-76c55325 — SAF
- [x] CS-c574f1d8 — Vulnerable

## Character stats / Attributes · Main

- [x] CS-832c404d — Boost Grab
- [x] CS-f216c5b2 — DACUS
- [x] CS-488863b5 — Dash Acceleration
- [x] CS-722b9620 — Dash Dance Avg. Velocity
- [x] CS-2762aa61 — Dash Dance Length
- [x] CS-dbb95b11 — Distance to Max Ground Speed
- [x] CS-098eb740 — Double Jump Height
- [ ] CS-514ebeec — Drift Angle
- [x] CS-3043a5cc — Extended Dash Dance (20 Frames)
- [x] CS-fc02561b — Fast Fall Speed
- [x] CS-23cd66fb — Fast Fall-Max Fall Speed
- [x] CS-61cca367 — Frames to Max Ground Speed
- [x] CS-a647a026 — Full Jump Height
- [x] CS-e4dc4d28 — Glide Toss
- [x] CS-936ac994 — Gravity (Falling Acceleration)
- [x] CS-6c50d210 — Ground Friction
- [x] CS-ab535cb4 — Horizontal Air Accel.
- [x] CS-fcf303e0 — Horizontal Air Drag
- [x] CS-bf58d9bd — Initial Dash Speed
- [x] CS-37ad85a9 — Max Dash/Run Speed
- [x] CS-ec910f1c — Max Fall Speed
- [x] CS-d2c61913 — Max Horizontal Air Speed
- [x] CS-0364e277 — SH FF Time
- [x] CS-14f8753c — Short Hop Height
- [x] CS-3830d2fc — Walk Speed
- [x] CS-19e222de — Walljump Height
- [x] CS-f7ba52a6 — Wavedash
- [x] CS-ec13c284 — Weight
- [ ] CS-9e601b3f — Attack
- [x] CS-0ee41afd — Attribute
- [ ] CS-6a317f2f — Costumes
- [x] CS-7033e943 — Crawl options
- [x] CS-22b66a3b — Dash length
- [x] CS-5ca12710 — Empty landing lag
- [x] CS-d5a87e27 — Jumpsquat
- [x] CS-a36cb6d8 — Number of jumps
- [x] CS-1763eb9b — Rank
- [x] CS-b5791794 — Wall movement
- [x] CS-42a95996 — Short hop
- [x] CS-715773c7 — Short hop + fastfall

## Character stats / Attributes · Shine
- [ ] CS-b3829e89 — Distance
- [ ] CS-736ec95a — Frame advantage
- [ ] CS-92676da3 — Hitstun
- [ ] CS-cbdeea2c — Knockback
- [ ] CS-e2bfe0c8 — Traction
- [ ] CS-06d85655 — Velocity
- [ ] CS-cc554496 — Weight

## Stage cards / Stage stats
- [x] ST-c115729e — Bottom blastzone distance (summary)
- [x] ST-a382afdd — Highest platform height
- [x] ST-35b4f9fb — Lowest platform height
- [x] ST-9645c862 — Platform width
- [x] ST-788cc5aa — Right ledge to side blastzone
- [x] ST-efe92b79 — Stage width
- [x] ST-49ce74e8 — Top blastzone distance (summary)


## Collision cards / Hitbubble, grab and throw parameters
- [x] HB-85c6ab6a — Bubble data
