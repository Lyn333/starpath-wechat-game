const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const roots = ["core", "cloudfunctions", "open-data", "audio", "catalog"].map((entry) => path.join(root, entry));
const files = [path.join(root, "game.js")];

function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (entry.isFile() && entry.name.endsWith(".js") && entry.name !== "launchCatalog.js") files.push(target);
  }
}
for (const directory of roots) collect(directory);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `语法检查失败：${file}\n`);
    process.exit(result.status || 1);
  }
}
console.log(`PASS syntax (${files.length} files)`);
