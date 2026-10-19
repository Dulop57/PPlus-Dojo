# Parser-only build of brawllib_rs 0.29.0

Source: the published crates.io brawllib_rs 0.29.0 package, MIT, Copyright (c) 2018 Lucas Kent. The original license is preserved in license.txt.

Only build configuration is changed:

- `src/lib.rs` puts `pub mod renderer` behind `#[cfg(feature = "renderer")]`.
- Cargo.toml makes the renderer's dependencies optional; default features are empty.

All other Rust source files are copied byte-for-byte from the published crate. P+ Dojo's exporter needs the parser and script evaluator, and uses its own Three.js browser viewer. Compiling/linking wgpu, winit, and Win32 graphics DLLs for a headless export is unnecessary and caused a pre-main crash on this workstation's Windows GNU toolchain. This patch avoids those unused dependencies without altering data extraction logic.

Regenerate and verify source-bound data after any parser source update. Upstream payload comparison should use original brawllib_rs 0.29.0 on identical inputs.
