import * as fs from 'fs';
const fsp = fs.promises;

export class FileUtils {
  static encodeBucketPath(bucketName: string) {
    return encodeURIComponent(bucketName.replace(/\\/g, '__b__').replace(/\//g, '__f__'));
  }

  static decodeBucketPath(bucketName: string) {
    const patternA = /__b__/g;
    const patternB = /__f__/g;
    return decodeURIComponent(bucketName).replace(patternA, '\\').replace(patternB, '/');
  }

  static async dirList (path: string): Promise<any[]> {
    const files = await fsp.readdir(path);
    return await getStatsForAll(path, files);
  }
}

async function getStatsForAll(path: string, files: string[]) {
  async function getStatsForOne(file: string) {
    try {
      const stat = fsp.stat(`${path}${file}/db`);
      return { file, isDir: (await stat).isDirectory() };
    } catch (err) {
      return null;
    }
  }
  return await Promise.all(files.map(getStatsForOne));
}
