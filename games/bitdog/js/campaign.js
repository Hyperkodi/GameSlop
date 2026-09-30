(function(root){
 'use strict';
 function create(){
  let level=1,hearts=5,score=0,finished=false,outcome=null;
  return {
   get level(){return level;},get hearts(){return hearts;},get score(){return score;},
   finish(state){
    if(finished||state.level.id!==level||!['won','lost'].includes(state.phase))return;
    hearts=state.hearts;outcome=state.phase;finished=true;
    if(outcome==='won')score+=state.score;
   },
   advance(){if(!finished||outcome!=='won'||level>=8)return false;level++;finished=false;outcome=null;return true;},
   restart(){level=1;hearts=5;score=0;finished=false;outcome=null;}
  };
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.BitDogCampaign=api;
})(typeof window!=='undefined'?window:globalThis);
