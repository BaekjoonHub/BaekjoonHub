import fs from 'fs';
import archiver from 'archiver';
import path, { dirname } from 'path';
import packageJson from '../package.json' with { type: 'json' };
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// package.json에서 name 읽기
const projectName = packageJson.name || 'project';

// 빌드 폴더와 ZIP 파일 이름 설정
const buildFolder = path.resolve(__dirname, '../dist'); // 빌드 폴더 경로
const outputZip = path.resolve(__dirname, `../${projectName}.zip`); // ZIP 파일 경로

// ZIP 파일 생성
function createZip() {
  const output = fs.createWriteStream(outputZip);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`ZIP file created: ${outputZip} (${archive.pointer()} total bytes)`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  // 빌드 폴더의 모든 파일을 ZIP에 추가
  archive.directory(buildFolder, false);
  void archive.finalize();
}

// 빌드 폴더 존재 여부 확인
if (fs.existsSync(buildFolder)) {
  createZip();
} else {
  console.error(`Build folder not found: ${buildFolder}`);
  process.exit(1);
}
