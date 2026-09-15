// Serial, coalesced cloud writes. Never write before the initial cloud read succeeds.
// Local persistence remains the source of truth while offline; no save/load UI is needed.
export class AutoSync {
 constructor({storage,read,restore,status=()=>{},delay=15000,retryDelay=30000}) {
  Object.assign(this,{storage,read,restore,status,delay,retryDelay});
  this.ready=false;this.busy=false;this.dirty=false;this.timer=null;this.stopped=false;
 }
 schedule(delay=this.delay){if(this.stopped||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;void this.flush();},delay);}
 changed(){this.dirty=true;this.schedule();}
 async start(){return this.flush();}
 async flush(){
  if(this.stopped)return;if(this.busy){this.dirty=true;return;}
  clearTimeout(this.timer);this.timer=null;this.busy=true;
  try {
   if(!this.ready){
    const before=JSON.stringify(this.read()),cloud=await this.storage.load(),local=this.read();
    const cloudTime=cloud?.save?.updatedAt||cloud?.savedAt||0;
    // Do not replace actions taken while the initial network request was pending.
    if(cloud&&JSON.stringify(local)===before&&cloudTime>(local.updatedAt||0)){
     this.restore({...cloud.save,updatedAt:cloudTime});this.dirty=false;
    }else this.dirty=true;
    this.ready=true;
   }
   if(this.dirty){
    this.dirty=false;const snapshot=JSON.parse(JSON.stringify(this.read()));
    await this.storage.save(snapshot);
   }
   this.status('Progress saved automatically to this device and Telegram.');
  }catch{
   this.dirty=true;
   this.status('Saved on this device. Telegram sync will retry automatically when connected.');
   this.schedule(this.retryDelay);
  }finally{this.busy=false;if(this.dirty)this.schedule();}
 }
 stop(){this.stopped=true;clearTimeout(this.timer);this.timer=null;}
}
