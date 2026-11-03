const fs = require('fs');
const path = require('path');

const src = 'C:/ospanel2/home/lbp.loc/public/wp-content/themes/lbp/src/GrammarTablesGallery/data/tablesData.js';
const destDir = 'C:/ospanel2/home/lbpw.loc/frontend/src/features/grammar/data';
const dest = path.join(destDir, 'tablesData.ts');

let s = fs.readFileSync(src, 'utf8');
const start = s.indexOf('const tablesData =');
const end = s.indexOf('const tablesData_admin');
if (start < 0 || end < 0) {
  throw new Error('Could not locate tablesData block');
}

let chunk = s.slice(start, end);
chunk = chunk.replace(/const tablesData =/, 'export const tablesData =');
chunk = chunk.replace(/\/wp-content\/themes\/lbp\/assets\/images\/tables\//g, '/grammar/tables/');
chunk = chunk.replace(/\/wp-content\/themes\/lbp\/assets\/images\/super-tables\//g, '/grammar/super-tables/');
chunk = chunk.replace(/\/wp-content\/themes\/lbp\/assets\/images\/tables_old\//g, '/grammar/tables/');

const header = `export type GrammarLevel = 'a1' | 'a2' | 'b1' | 'b2' | string;

export type GrammarTableItem = {
  id: number | string;
  src: string;
  level: GrammarLevel;
  alt?: string;
  title?: string;
  description?: string;
  hintId?: string | number;
  width?: number;
  height?: number;
  widthMob?: number;
  heightMob?: number;
};

export type GrammarTablesData = {
  group1: GrammarTableItem[];
  group2: GrammarTableItem[];
  group3: GrammarTableItem[];
};

`;

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(dest, header + chunk + '\nexport default tablesData;\n', 'utf8');
console.log('OK', dest, fs.statSync(dest).size);
