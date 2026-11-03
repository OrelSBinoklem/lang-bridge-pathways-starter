import test from 'node:test';
import assert from 'node:assert/strict';
import {assertExclusivePhotos} from './visual-photo-uniqueness.mjs';

const asset = id => ({id, image:`/photo-${id}.webp`, source_url:`https://example.com/${id}`, source_sha256:`source-${id}`, sha256:`output-${id}`});
const variant = (id, image) => ({level:'A1', position:id, replace_sections:{speaking:{tasks:[{visuals:[{image}]}]}}});
test('accepts distinct sources and image bytes', () => {
  assert.equal(assertExclusivePhotos([variant(1,'/photo-1.webp'),variant(2,'/photo-2.webp')],[asset(1),asset(2)],2).length,2);
});
for(const field of ['id','source_url','source_sha256','sha256']) {
  test(`rejects duplicate ${field} even under another public URL`, () => {
    const duplicate={...asset(2),[field]:asset(1)[field]};
    assert.throws(()=>assertExclusivePhotos([variant(1,'/photo-1.webp'),variant(2,'/photo-2.webp')],[asset(1),duplicate]),/Repeated photograph/);
  });
}
test('rejects repeat between a question and visual inside one exam',()=>{
  const entry=variant(1,'/photo-1.webp');
  entry.replace_sections.reading={tasks:[{questions:[{image:'/photo-1.webp'}]}]};
  assert.throws(()=>assertExclusivePhotos([entry],[asset(1)]),/Repeated photograph/);
});
test('rejects unknown images and unused assets',()=>{
  assert.throws(()=>assertExclusivePhotos([variant(1,'/missing.webp')],[asset(1)]),/Unknown photograph/);
  assert.throws(()=>assertExclusivePhotos([variant(1,'/photo-1.webp')],[asset(1),asset(2)]),/Unused assets/);
});
