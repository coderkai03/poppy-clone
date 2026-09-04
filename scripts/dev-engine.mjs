import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engine = path.join(root, "engine");
const winPy = path.join(engine, "venv", "Scripts", "python.exe");
const unixPy = path.join(engine, "venv", "bin", "python");
const python = existsSync(winPy) ? winPy : unixPy;

if (!existsSync(python)) {
  console.error("Engine virtualenv not found at engine/venv.");
  console.error("Create it, then install deps:");
  console.error("  python -m venv engine/venv");
  console.error(
    "  engine\\venv\\Scripts\\python.exe -m pip install -r engine/requirements.txt   # Windows",
  );
  console.error(
    "  engine/venv/bin/python -m pip install -r engine/requirements.txt           # macOS/Linux",
  );
  process.exit(1);
}

const child = spawn(
  python,
  ["-m", "uvicorn", "app:app", "--reload", "--port", "8000"],
  { cwd: engine, stdio: "inherit", windowsHide: true },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }
  process.exit(code ?? 1);
});
