// 阶段 0：把模型与 MediaPipe WASM 拷进 public/，产品运行时只读本地，不引用任何外链。
// 模型源文件（唯一一份）在 tools/models；WASM 源文件随 node_modules 版本走。
import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const modelsSrc = path.join(root, 'tools', 'models');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const modelsDst = path.join(root, 'public', 'models');
const wasmDst = path.join(root, 'public', 'wasm');

const MODEL_FILES = ['efficientdet_lite0.tflite', 'pose_landmarker_lite.task'];

async function sizeOf(file) {
  const s = await stat(file);
  return s.size;
}

async function copyModels() {
  await mkdir(modelsDst, { recursive: true });
  for (const name of MODEL_FILES) {
    const src = path.join(modelsSrc, name);
    const dst = path.join(modelsDst, name);
    await cp(src, dst);
    const size = await sizeOf(dst);
    // 下载中断会留下约 1MB 的损坏文件，FlatBuffer 校验会直接报 INVALID_ARGUMENT。
    if (size < 1_000_000) {
      throw new Error(`${name} 只有 ${size} B，疑似下载不完整（应 > 1MB）`);
    }
    console.log(`models/${name}  ${size} B`);
  }
}

async function copyWasm() {
  await mkdir(wasmDst, { recursive: true });
  await cp(wasmSrc, wasmDst, { recursive: true });
  let count = 0;
  let bytes = 0;
  for (const name of ['vision_wasm_internal', 'vision_wasm_module_internal', 'vision_wasm_nosimd_internal']) {
    for (const ext of ['.js', '.wasm']) {
      bytes += await sizeOf(path.join(wasmDst, name + ext));
      count += 1;
    }
  }
  console.log(`wasm/*  ${count} 个文件  ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

await copyModels();
await copyWasm();
console.log('ok: public/models 与 public/wasm 已就绪');
