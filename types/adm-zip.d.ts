declare module "adm-zip" {
  interface ZipEntry {
    isDirectory: boolean;
    entryName: string;
    getData(): Buffer;
  }
  class AdmZip {
    constructor(buffer?: Buffer);
    getEntry(entryName: string): ZipEntry | null;
    getEntries(): ZipEntry[];
  }
  export = AdmZip;
}
