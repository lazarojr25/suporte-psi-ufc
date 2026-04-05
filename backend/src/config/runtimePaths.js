import os from 'os';
import path from 'path';

const TRUE_VALUES = new Set(['true', '1', 'yes']);

const toBool = (value) =>
  typeof value === 'string' && TRUE_VALUES.has(value.toLowerCase());

export const isServerlessRuntime =
  Boolean(process.env.FUNCTION_TARGET) ||
  Boolean(process.env.K_SERVICE) ||
  toBool(process.env.FUNCTIONS_EMULATOR) ||
  toBool(process.env.FIREBASE_EMULATOR_HUB);

const baseDir = () => (isServerlessRuntime ? os.tmpdir() : process.cwd());

const resolveRuntimePath = (configuredPath, fallbackRelativePath) => {
  if (configuredPath && path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const relativePath = configuredPath || fallbackRelativePath;
  return path.resolve(baseDir(), relativePath);
};

export const getUploadsDir = () =>
  resolveRuntimePath(process.env.UPLOAD_DIR, 'uploads');

export const getWorkDir = () =>
  resolveRuntimePath(process.env.WORK_DIR, 'work');
