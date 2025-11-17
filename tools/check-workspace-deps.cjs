// tools/check-workspace-deps.cjs
// Checks that every internal import (@bf42lite/*) is declared in dependencies/devDependencies.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PKG_DIRS = ["packages", "apps"]; // adjust if you add more top-level workspaces

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function listWorkspacePackages() {
  const result = [];

  for (const top of PKG_DIRS) {
    const topPath = path.join(ROOT, top);
    if (!exists(topPath)) continue;

    for (const entry of fs.readdirSync(topPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgDir = path.join(topPath, entry.name);
      const pkgJsonPath = path.join(pkgDir, "package.json");
      if (!exists(pkgJsonPath)) continue;

      const pkgJson = readJSON(pkgJsonPath);
      if (typeof pkgJson.name === "string" && pkgJson.name.startsWith("@bf42lite/")) {
        result.push({
          name: pkgJson.name,
          dir: pkgDir,
          pkgJsonPath,
          pkgJson,
        });
      }
    }
  }

  return result;
}

function walkFiles(dir, predicate) {
  const result = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        // Skip common build/output/vendor dirs
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === "target"
        ) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && predicate(full)) {
        result.push(full);
      }
    }
  }

  return result;
}

function isSourceFile(filePath) {
  return (
    filePath.endsWith(".ts") ||
    filePath.endsWith(".tsx") ||
    filePath.endsWith(".js") ||
    filePath.endsWith(".jsx")
  );
}

function findInternalImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const imports = new Set();

  // ES imports: import ... from '@bf42lite/sim'
  const importRegex = /from\s+['"](@bf42lite\/[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // require('@bf42lite/sim')
  const requireRegex = /require\(\s*['"](@bf42lite\/[^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // dynamic import('@bf42lite/sim')
  const dynImportRegex = /import\(\s*['"](@bf42lite\/[^'"]+)['"]\s*\)/g;
  while ((match = dynImportRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return imports;
}

function main() {
  const workspacePkgs = listWorkspacePackages();
  const internalNames = new Set(workspacePkgs.map((p) => p.name));

  const errors = [];

  for (const ws of workspacePkgs) {
    const { name: pkgName, dir, pkgJson } = ws;

    const deps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
      ...(pkgJson.peerDependencies || {}),
    };

    const srcDir = path.join(dir, "src");
    if (!exists(srcDir)) {
      // No src dir, nothing to scan
      continue;
    }

    const files = walkFiles(srcDir, isSourceFile);
    const neededInternalDeps = new Set();

    for (const file of files) {
      const imports = findInternalImportsInFile(file);
      for (const imp of imports) {
        // Only care about other internal packages, not self-imports
        if (internalNames.has(imp) && imp !== pkgName) {
          neededInternalDeps.add(imp);
        }
      }
    }

    for (const needed of neededInternalDeps) {
      if (!deps[needed]) {
        errors.push(
          `Package ${pkgName} imports ${needed} but does NOT declare it in dependencies/devDependencies (dir: ${dir})`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error("❌ Workspace dependency check failed:\n");
    for (const e of errors) {
      console.error(" - " + e);
    }
    console.error(
      "\nFix: add the missing internal packages to dependencies (e.g. \"@bf42lite/sim\": \"workspace:*\") and re-run."
    );
    process.exit(1);
  } else {
    console.log("✅ Workspace dependency check passed: all internal imports are declared.");
  }
}

main();
