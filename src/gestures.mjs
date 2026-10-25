export class ShakeDetector {
  constructor(count=5, windowMs=2000, distance=25) {this.count=count;this.windowMs=windowMs;this.distance=distance;this.cooldown=0;this.reset();}
  reset(){this.anchor=null;this.axis=null;this.direction=0;this.strokes=[];}
  sample(x,y,now) {
    if(now<this.cooldown){this.reset();return null;}
    if(!this.anchor){this.anchor=[x,y];return null;}
    const dx=x-this.anchor[0],dy=y-this.anchor[1];
    if(Math.max(Math.abs(dx),Math.abs(dy))<this.distance) return null;
    const axis=Math.abs(dx)>Math.abs(dy)*1.5?'x':Math.abs(dy)>Math.abs(dx)*1.5?'y':null;
    // Ignore small off-axis samples instead of discarding the whole gesture.
    if(!axis){if(Math.max(Math.abs(dx),Math.abs(dy))>75)this.reset();return null;}
    this.anchor=[x,y];
    if(axis!==this.axis){this.axis=axis;this.strokes=[];this.direction=0;}
    this.strokes=this.strokes.filter(s=>now-s.time<=this.windowMs);
    const dir=Math.sign(axis==='x'?dx:dy);
    if(dir!==this.direction || !this.strokes.length)this.strokes.push({dir,time:now});
    this.direction=dir;
    if(this.strokes.filter(s=>s.dir<0).length>=this.count && this.strokes.filter(s=>s.dir>0).length>=this.count){this.cooldown=now+4000;this.reset();return axis==='x'?'screen':'text';}
    return null;
  }
}
