const fs=require('fs');
const path='src/components/tree2/ForceDirectedTree.js';
let text=fs.readFileSync(path,'utf8');
if(!text.includes(" "'useMemo')) {
