// One familiar collectible in each maze corner. All trigger ordinary Chad Mode.
export const POWER_PELLETS = [
  {id:'pickup-protein-bar',name:'Protein bar'},
  {id:'pickup-white-monster',name:'White Monster'},
  {id:'pickup-creatine',name:'Creatine'},
  {id:'pickup-cleavage',name:'Cleavage'},
];
export function powerPelletArt(x,y){
  return POWER_PELLETS[(y>9?2:0)+(x>11?1:0)];
}
