import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./porcelainFracture.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {porcelainFracture,porcelainGeometry,porcelainPoint} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
function random(seed=91){return ()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);}
const area = polygon => Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-p.y*q.x;},0))/2;
test('48 irregular cracks cover the periodic vase exactly, including the back seam',()=>{
  for(const seed of [1,91,173]) {
    const cells=porcelainFracture(random(seed)); assert.equal(cells.length,48);
    assert.ok(Math.abs(cells.reduce((sum,c)=>sum+area(c.polygon),0)-1)<1e-9);
    assert.ok(cells.every(c=>c.polygon.length>=3&&area(c.polygon)>1e-4));
    assert.ok(new Set(cells.map(c=>c.polygon.length)).size>=3);
    assert.ok(cells.some(c=>c.polygon.some(p=>p.x<0||p.x>1)),'one-piece wrap, no artificial vertical split');
  }
});
test('seed is reproducible but a different seed changes fracture topology',()=>{
  assert.deepEqual(porcelainFracture(random(17)),porcelainFracture(random(17)));
  assert.notDeepEqual(porcelainFracture(random(17)),porcelainFracture(random(18)));
});
test('curved fragments have finite geometry, outward front faces and actual shell thickness',()=>{
  let triangles=0;
  for(const cell of porcelainFracture(random())) {
    const g=porcelainGeometry(cell); triangles+=g.indices.length/3;
    assert.equal(g.positions.length,g.normals.length);assert.equal(g.uvs.length,g.positions.length/3*2);
    assert.ok(g.positions.every(Number.isFinite));assert.ok(g.normals.every(Number.isFinite));
    assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<g.positions.length/3));
    assert.ok(g.indices.length>g.shellCount,'cut faces');
    const outer=porcelainPoint(cell.center),inner=porcelainPoint(cell.center,.075);
    assert.ok(Math.abs(Math.hypot(...outer.map((n,i)=>n-inner[i]))-.075)<1e-10);
    for(let i=0;i<g.shellCount;i+=3) {
      const [a,b,c]=g.indices.slice(i,i+3).map(n=>g.positions.slice(n*3,n*3+3));
      const ab=b.map((n,k)=>n-a[k]),ac=c.map((n,k)=>n-a[k]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      const normal=g.normals.slice(g.indices[i]*3,g.indices[i]*3+3);
      assert.ok(cross.reduce((s,n,k)=>s+n*normal[k],0)>-1e-9,'winding matches surface normal');
    }
  }
  assert.ok(triangles<100000,`geometry budget: ${triangles}`);
});
