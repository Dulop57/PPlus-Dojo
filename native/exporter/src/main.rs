use anyhow::{Context, Result, bail, ensure};
use brawllib_rs::{brawl_mod::BrawlMod, fighter::ModType, high_level_fighter::HighLevelFighter};
use clap::Parser;
use flate2::{Compression, GzBuilder};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fs, io::{Read, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{SystemTime, UNIX_EPOCH}};
use walkdir::WalkDir;

#[derive(Parser)]
#[command(about = "Export Project+ v3.2 collision data from local Brawl + P+ files. No raw game files are copied.")]
struct Args {
    #[arg(long)] brawl: PathBuf,
    /// Root of the extracted SD-card contents, containing project+/pf/fighter and codes.
    #[arg(long)] pplus: PathBuf,
    #[arg(long)] out: PathBuf,
    /// Comma-separated internal names for a representative, explicitly partial extraction.
    #[arg(long, value_delimiter = ',')] fighters: Vec<String>,
    /// In-game and upstream comparison report, bound to this exact source digest.
    #[arg(long)] verification_report: Option<PathBuf>,
    /// Validate input layout and print source digest without running the parser.
    #[arg(long)] preflight: bool,
}

fn hash(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
fn slug(name: &str) -> String {
    match name {
        "Game & Watch" => "game-watch".into(), "R.O.B." | "ROB" | "R.O.B" | "Rob" => "rob".into(),
        _ => name.to_lowercase().split(|c: char| !c.is_ascii_alphanumeric()).filter(|s| !s.is_empty()).collect::<Vec<_>>().join("-"),
    }
}
fn source_checksums(root: &Path, source: &str) -> Result<Vec<Value>> {
    let mut files: Vec<_> = WalkDir::new(root).follow_links(false).into_iter().collect::<std::result::Result<Vec<_>, _>>()?
        .into_iter().filter(|e| e.file_type().is_file() && e.path().extension().is_some_and(|x| {
            let ext = x.to_string_lossy().to_lowercase(); ext == "pac" || ext == "gct" || ext == "pcs"
        })).collect();
    files.sort_by_key(|e| e.path().to_path_buf());
    let mut checksums = Vec::new();
    for entry in files {
        let mut reader = fs::File::open(entry.path())?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 65536];
        loop { let count = reader.read(&mut buffer)?; if count == 0 { break; } hasher.update(&buffer[..count]); }
        checksums.push(json!({"source":source,"path":entry.path().strip_prefix(root)?.to_string_lossy().replace('\\', "/"),"sha256":format!("{:x}",hasher.finalize())}));
    }
    Ok(checksums)
}
fn verify_sources(brawl: &Path, pplus: &Path) -> Result<Vec<Value>> {
    ensure!(brawl.join("fighter/Fighter.pac").is_file(), "Brawl folder must contain fighter/Fighter.pac. Extract the RSBE01 data partition in Dolphin; see the README game-data setup.");
    ensure!(fs::read_dir(pplus)?.filter_map(|e| e.ok()).any(|e| e.path().join("pf/fighter").is_dir()), "P+ folder must contain a child folder with pf/fighter (the complete SD-card layout), not just the fighter folder.");
    let mut sources = source_checksums(brawl, "brawl")?;
    sources.extend(source_checksums(pplus, "pplus")?);
    ensure!(sources.iter().any(|s| s["source"] == "pplus" && s["path"].as_str().is_some_and(|p| p.to_lowercase().ends_with(".gct"))), "P+ codesets (.gct, including BOOST.GCT where present) are missing. Use the complete official mod files.");
    Ok(sources)
}
fn verify_report(path: Option<&Path>, digest: &str) -> Result<&'static str> {
    let Some(path) = path else { return Ok("unverified"); };
    let report: Value = serde_json::from_slice(&fs::read(path)?)?;
    ensure!(report["sourceDigest"] == digest, "Verification report belongs to different source files.");
    ensure!(report["gameVersion"] == "3.2", "Verification report must target P+ 3.2.");
    ensure!(report["reviewer"].as_str().is_some_and(|r| !r.trim().is_empty()), "Report needs a reviewer.");
    for case in ["single-hit", "multi-hit", "grab-throw", "aerial-autocancel", "movement", "custom-character"] {
        let entries = report["checks"].as_array().context("Report needs checks array")?;
        ensure!(entries.iter().any(|c| c["scenario"] == case && c["passed"] == true
            && c["upstreamCompared"] == true && c["inGameCompared"] == true
            && c["evidence"].as_str().is_some_and(|v| !v.trim().is_empty())), "Missing successful upstream/in-game check: {case}");
    }
    Ok("verified")
}
fn write_json(path: &Path, value: &Value, compressed: bool) -> Result<String> {
    fs::create_dir_all(path.parent().context("Missing output parent")?)?;
    let bytes = serde_json::to_vec(value)?;
    let output = if compressed {
        let mut writer = GzBuilder::new().mtime(0).write(Vec::new(), Compression::best());
        writer.write_all(&bytes)?; writer.finish()?
    } else { bytes };
    fs::write(path, &output)?;
    Ok(hash(&output))
}
fn frame_ranges(flags: &[bool]) -> Vec<[usize; 2]> {
    let mut ranges = Vec::new(); let mut start = None;
    for (i, &flag) in flags.iter().enumerate() {
        if flag && start.is_none() { start = Some(i); }
        if !flag { if let Some(first) = start.take() { ranges.push([first + 1, i]); } }
    }
    if let Some(first) = start { ranges.push([first + 1, flags.len()]); }
    ranges
}
fn main() -> Result<()> {
    // Preserve upstream diagnostics in the published manifest as well as stderr.
    // Repeated loop warnings are deduplicated; they are not accuracy verification.
    let diagnostics = Arc::new(Mutex::new(BTreeSet::<String>::new()));
    let captured = Arc::clone(&diagnostics);
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn"))
        .format(move |buffer, record| {
            let message = format!("{} {}: {}", record.level(), record.target(), record.args());
            if matches!(record.level().as_str(), "ERROR" | "WARN") {
                captured.lock().unwrap().insert(message.clone());
            }
            writeln!(buffer, "{message}")
        }).init();
    let args = Args::parse();
    let brawl = fs::canonicalize(&args.brawl).context("Brawl input folder does not exist")?;
    let pplus = fs::canonicalize(&args.pplus).context("P+ input folder does not exist")?;
    let sources = verify_sources(&brawl, &pplus)?;
    let digest = hash(&serde_json::to_vec(&sources)?);
    println!("Source digest: {digest}");
    if args.preflight { println!("Input layout valid. {} source files fingerprinted. Confirm these mod files are official P+ v3.2; patch version cannot be inferred from PAC files.", sources.len()); return Ok(()); }
    let verification = verify_report(args.verification_report.as_deref(), &digest)?;
    // Immutable generation directories prevent old/new datasets mixing on a failed export.
    let out = std::path::absolute(&args.out)?;
    ensure!(!out.starts_with(&brawl) && !out.starts_with(&pplus), "Output must be outside both source folders.");
    fs::create_dir_all(&out)?;
    let generation = format!("generations/{}-{}", &digest[..16], SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos());
    let input = BrawlMod::new(&brawl, Some(&pplus));
    let fighters = input.load_fighters(true).context("brawllib_rs could not load P+ fighters")?;
    let mut entries = Vec::new(); let mut warnings = Vec::new();
    for fighter in fighters {
        if fighter.cased_name.eq_ignore_ascii_case("poketrainer") || matches!(fighter.mod_type, ModType::NotMod) { continue; }
        if !args.fighters.is_empty() && !args.fighters.iter().any(|f| f.eq_ignore_ascii_case(&fighter.cased_name)) { continue; }
        println!("Extracting {}", fighter.cased_name);
        let high = HighLevelFighter::new(&fighter);
        let id = slug(&high.name);
        ensure!(!id.is_empty() && !entries.iter().any(|f: &Value| f["id"] == id), "Duplicate/invalid fighter ID: {id}");
        let mut moves = Vec::new();
        for (i, action) in high.subactions.iter().enumerate() {
            let safe_name: String = action.name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '_' }).collect();
            let move_id = format!("{safe_name}-{i}");
            let path = format!("{generation}/{id}/moves/{move_id}.json.gz");
            let mut action_json = serde_json::to_value(action)?;
            action_json.as_object_mut().unwrap().remove("scripts");
            let frames = action_json["frames"].as_array_mut().context("Missing animation frames")?;
            for (index, frame) in frames.iter_mut().enumerate() { frame["index"] = json!(index); }
            let move_warnings: Vec<String> = if action.bad_interrupts { vec!["The parser ignored an interrupt while evaluating this subaction. Dynamic behavior may be incomplete.".into()] } else { vec![] };
            if action.frames.is_empty() { warnings.push(format!("{id}/{}: no animation frames", action.name)); }
            let mut extent = action.hurt_box_extent(); extent.extend(&action.hit_box_extent()); extent.extend(&action.ledge_grab_box_extent());
            action_json["schemaVersion"] = json!(1); action_json["fighterId"] = json!(id); action_json["moveId"] = json!(move_id);
            action_json["extent"] = serde_json::to_value(&extent)?; action_json["warnings"] = json!(move_warnings);
            let active = frame_ranges(&action.frames.iter().map(|f| f.hit_boxes.iter().any(|h| match &h.next_values {
                brawllib_rs::high_level_fighter::CollisionBoxValues::Hit(v) => v.enabled,
                brawllib_rs::high_level_fighter::CollisionBoxValues::Grab(_) => true,
            })).collect::<Vec<_>>());
            let sha = write_json(&out.join(&path), &action_json, true)?;
            moves.push(json!({"id":move_id,"internalName":action.name,"path":path,"totalFrames":action.frames.len(),"activeWindows":active,"iasa":action.iasa.map(|x|x+1),"warnings":move_warnings,"sha256":sha}));
        }
        let path = format!("{generation}/{id}/index.json");
        let fighter_warnings: Vec<String> = if moves.iter().any(|m| !m["warnings"].as_array().unwrap().is_empty()) { vec!["Some subactions have parser warnings. See individual moves.".into()] } else { vec![] };
        write_json(&out.join(&path), &json!({"schemaVersion":1,"id":id,"name":high.name,"internalName":high.internal_name,"attributes":high.attributes,"moves":moves,"warnings":fighter_warnings}), false)?;
        entries.push(json!({"id":id,"name":high.name,"internalName":high.internal_name,"path":path,"moveCount":moves.len()}));
    }
    if entries.is_empty() { bail!("No fighters matched. Use internal names such as marth, mario, fox, sonic, knuckles. No manifest was published."); }
    ensure!(args.fighters.is_empty() || entries.len() == args.fighters.len(), "One or more requested fighters were not found. No manifest was published.");
    entries.sort_by_key(|e| e["name"].as_str().unwrap().to_owned());
    let mut general = vec!["Script-derived data does not simulate every engine, projectile/article, state-dependent, or Gecko-code behavior. In-game validation covers representative cases, not every possible game state.".to_string()];
    general.append(&mut warnings);
    general.extend(diagnostics.lock().unwrap().iter().cloned());
    let manifest = json!({"schemaVersion":1,"game":"Project+","version":"3.2","generatedAt":SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs().to_string(),"parser":{"name":"brawllib_rs","version":"0.29.0","build":"parser-only; unchanged parsing source"},"verification":verification,"partial":!args.fighters.is_empty(),"fighters":entries,"warnings":general,"sourceChecksums":sources,"sourceDigest":digest});
    // Write manifest last. Failed generations never become the active dataset.
    let temp = out.join("manifest.json.tmp"); write_json(&temp, &manifest, false)?;
    fs::rename(temp, out.join("manifest.json"))?;
    println!("Exported {} fighters to {} ({verification}).", entries.len(), out.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn range_boundaries() { assert_eq!(frame_ranges(&[false,true,true,false,true]), vec![[2,3],[5,5]]); assert!(frame_ranges(&[]).is_empty()); }
    #[test] fn canonical_ids() { assert_eq!(slug("Captain Falcon"), "captain-falcon"); assert_eq!(slug("Game & Watch"),"game-watch"); assert_eq!(slug("R.O.B."),"rob"); }
    #[test] fn report_rejects_mismatched_source() { let report = std::env::temp_dir().join(format!("dojo-report-{}.json",std::process::id())); fs::write(&report, r#"{"sourceDigest":"other"}"#).unwrap(); assert!(verify_report(Some(&report),"expected").is_err()); fs::remove_file(report).unwrap(); }
}
