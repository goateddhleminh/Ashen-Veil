// All synthesized voices pass through one bounded, player-controlled bus.
export class GameAudio {
  constructor(){this.context=null;this.voices=new Set();this.volume=.5;this.muted=false;this.paused=true;}
  async unlock(){
    try{
      if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;this.context=new Audio();this.master=this.context.createGain();this.master.connect(this.context.destination);this.updateGain();}
      if(this.context.state==='suspended')await this.context.resume();
    }catch{/* Audio is optional on restricted browsers. */}
  }
  configure({volume,muted}){this.volume=volume;this.muted=muted;this.updateGain();}
  setPaused(value){if(this.paused===value)return;this.paused=value;this.updateGain();}
  updateGain(){if(this.master)this.master.gain.value=this.paused||this.muted?0:this.volume*this.volume*.18;}
  play(kind){
    if(!this.context||this.context.state!=='running'||this.paused||this.muted||this.volume===0||this.voices.size>=8)return false;
    const notes={hit:[130,50,.09],skill:[440,110,.22],loot:[660,990,.12],level:[440,880,.4],hurt:[90,35,.18]};
    const [start,end,duration]=notes[kind]||notes.hit,now=this.context.currentTime;
    const oscillator=this.context.createOscillator(),envelope=this.context.createGain();
    oscillator.type=kind==='hit'||kind==='hurt'?'triangle':'sine';const variation=.97+Math.random()*.06;
    oscillator.frequency.setValueAtTime(start*variation,now);oscillator.frequency.exponentialRampToValueAtTime(end*variation,now+duration);
    envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(.5,now+.005);envelope.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(envelope);envelope.connect(this.master);this.voices.add(oscillator);
    oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();this.voices.delete(oscillator);};
    oscillator.start(now);oscillator.stop(now+duration+.01);return true;
  }
  async dispose(){if(this.context){await this.context.close();this.context=null;}this.voices.clear();}
}
