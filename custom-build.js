const fs = require("fs");
const { execSync } = require("child_process");

console.log("Building native module with Cargo...");
execSync("cd native && cargo build --release", { stdio: "inherit" });

console.log("Creating npm/linux-x64-gnu/ directory...");
fs.mkdirSync("npm/linux-x64-gnu", { recursive: true });

console.log("Copying binary to npm/linux-x64-gnu/index.node...");
fs.copyFileSync("native/target/release/libpayjoin_typescript.so", "npm/linux-x64-gnu/index.node");

console.log("Creating symlinks...");
try {
  fs.unlinkSync("index.linux-x64-gnu.node");
} catch {}
try {
  fs.unlinkSync("index.linux-x64");
} catch {}
fs.symlinkSync("npm/linux-x64-gnu/index.node", "index.linux-x64-gnu.node");
fs.symlinkSync("index.linux-x64-gnu.node", "index.linux-x64");

console.log("Custom build script finished.");