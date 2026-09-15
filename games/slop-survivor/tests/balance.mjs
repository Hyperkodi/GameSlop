import {simulate} from './campaign-harness.mjs';
import {cardsNeeded} from '../../../docs/superpowers/specs/2026-09-14-slop-survivor-curve-model.mjs';
const full=process.argv.includes('--full'),reports=[],bands={easy:[.73,.98],hard:[1.39,1.87],impossible:[2.04,2.76]};
for(let n=1;n<=100;n++)if(full||n===1||n%5===0)for(const d of Object.keys(bands)){
 const result=simulate(n,d);const need=cardsNeeded(n,d),[lo,hi]=bands[d];result.modelCards=+need.toFixed(3);reports.push(result);console.log(JSON.stringify(result));
 if(result.result!=='won'||need<lo*.75||need>hi*1.25)process.exitCode=1;
}
console.log(`${reports.filter(r=>r.result==='won').length}/${reports.length} engine encounters won. Analytical bands checked separately; no-card and economy checks are added in phase 6.`);
