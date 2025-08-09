import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { zip } from "fflate";

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  console.log("Packaging BaekjoonHub extension...");

  const packagesDir = path.join(__dirname, "packages");
  const distDir = path.join(__dirname, "dist");
  const packageJsonPath = path.join(__dirname, "package.json");

  // Clean and create the packages directory
  if (fs.existsSync(packagesDir)) {
    fs.rmSync(packagesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packagesDir, { recursive: true });

  // Get version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = packageJson.version;
  const zipFileName = `baekjoonhub-v${version}.zip`;
  const zipFilePath = path.join(packagesDir, zipFileName);

  console.log("Creating release package...");

  const filesToZip = {};

  // Recursively collect files from dist directory
  function collectFiles(currentPath, zipPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const entryZipPath = path.join(zipPath, entry.name);

      if (entry.isDirectory()) {
        collectFiles(fullPath, entryZipPath);
      } else {
        filesToZip[entryZipPath] = new Uint8Array(fs.readFileSync(fullPath));
      }
    }
  }

  collectFiles(distDir, ""); // Start collecting from the root of dist directory

  zip(filesToZip, { level: 9 }, (err, data) => {
    if (err) {
      console.error("fflate zip error:", err);
      process.exit(1);
    }
    fs.writeFileSync(zipFilePath, data);
    console.log("Packaging complete!");
    console.log(`Packaged extension is available in the 'packages' directory: ${zipFilePath}`);
    
    // GitHub Actions에서 사용할 수 있도록 패키지 파일명을 환경 변수로 출력
    console.log(`RELEASE_PACKAGE_NAME=${zipFileName}`);
  });
}

build().catch(console.error);