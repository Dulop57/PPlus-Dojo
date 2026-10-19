import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve,join,delimiter } from 'node:path';
// Isolated workspace toolchain; falls back to the developer's installed Cargo.
const root=resolve(import.meta.dirname,'..'),cargoHome=join(root,'.tools/cargo');
const local=join(cargoHome,'bin/cargo.exe'),env={...process.env};
if(existsSync(local)){
  env.CARGO_HOME=cargoHome;env.RUSTUP_HOME=join(root,'.tools/rustup');
  env.PATH=[join(root,'.tools/binutils/mingw64/bin'),join(cargoHome,'bin'),env.PATH].join(delimiter);
}
const child=spawn(existsSync(local)?local:'cargo',process.argv.slice(2),{env,stdio:'inherit'});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
