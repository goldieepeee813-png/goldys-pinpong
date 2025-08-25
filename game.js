(() => {
// GOLDY PingPong Arcade
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W=canvas.width, H=canvas.height;

const scoreEl = document.getElementById('score');
const modeEl = document.getElementById('mode');

// Touch controls
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
let touchUp=false, touchDown=false;
for (const el of [btnUp, btnDown]){
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); if(el===btnUp) touchUp=true; else touchDown=true; });
  el.addEventListener('pointerup', ()=> { if(el===btnUp) touchUp=false; else touchDown=false; });
  el.addEventListener('pointercancel', ()=> { if(el===btnUp) touchUp=false; else touchDown=false; });
}

const keys = {};
addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

let audioCtx;
function beep(freq=440, dur=0.07, type='square', vol=0.03){
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.value=vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  setTimeout(()=>{ o.stop(); }, dur*1000);
}

// Game objects
class Paddle{
  constructor(x){
    this.x=x; this.y=H/2;
    this.w=16; this.h=110;
    this.speed=7;
    this.targetY = this.y;
    this.growTimer=0;
  }
  step(input){
    if (this.growTimer>0) this.growTimer--;
    let v=0;
    if (input.up) v=-this.speed;
    if (input.down) v= this.speed;
    this.y += v;
    this.y = Math.max(this.h/2+10, Math.min(H-this.h/2-10, this.y));
  }
  draw(){
    // glow
    ctx.save();
    ctx.shadowColor = '#4fb0ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#88bfff';
    const hh = this.h + (this.growTimer>0?40:0);
    roundRect(this.x-this.w/2, this.y-hh/2, this.w, hh, 8);
    ctx.restore();
  }
}

class Ball{
  constructor(){
    this.reset();
    this.size=14;
    this.speedInc=1.02;
    this.trail=[];
    this.multi=false;
  }
  reset(dir=Math.random()<0.5?-1:1){
    this.x=W/2; this.y=H/2;
    const a = (Math.random()*0.6 - 0.3);
    const sp = 6;
    this.vx = dir * (sp + Math.random()*1.5);
    this.vy = Math.sin(a) * (sp + Math.random()*1.5);
  }
  step(p1,p2){
    // trail
    this.trail.push({x:this.x, y:this.y, a:1});
    if (this.trail.length>16) this.trail.shift();
    for (const t of this.trail) t.a*=0.92;

    this.x += this.vx;
    this.y += this.vy;

    // walls
    if (this.y < 20+this.size/2){ this.y=20+this.size/2; this.vy *= -1; beep(880,0.05,'triangle'); }
    if (this.y > H-20-this.size/2){ this.y=H-20-this.size/2; this.vy *= -1; beep(880,0.05,'triangle'); }

    // paddles
    const hit1 = Math.abs(this.x - p1.x) < (this.size/2 + p1.w/2) &&
                 Math.abs(this.y - p1.y) < (this.size/2 + p1.h/2 + (p1.growTimer>0?20:0));
    const hit2 = Math.abs(this.x - p2.x) < (this.size/2 + p2.w/2) &&
                 Math.abs(this.y - p2.y) < (this.size/2 + p2.h/2 + (p2.growTimer>0?20:0));

    if (hit1 && this.vx<0){
      const off = (this.y - p1.y) / (p1.h/2);
      this.vx = Math.abs(this.vx)*this.speedInc;
      this.vy = (this.vy + off*5) * 0.9;
      this.x = p1.x + p1.w/2 + this.size/2 + 1;
      beep(440,0.06,'square'); particles(this.x,this.y,'#5ab0ff');
    }
    if (hit2 && this.vx>0){
      const off = (this.y - p2.y) / (p2.h/2);
      this.vx = -Math.abs(this.vx)*this.speedInc;
      this.vy = (this.vy + off*5) * 0.9;
      this.x = p2.x - p2.w/2 - this.size/2 - 1;
      beep(520,0.06,'square'); particles(this.x,this.y,'#ffd166');
    }
  }
  draw(){
    // trail
    for (const t of this.trail){
      ctx.globalAlpha = t.a*0.5;
      ctx.beginPath();
      ctx.arc(t.x,t.y,this.size/2,0,Math.PI*2);
      ctx.fillStyle='#89c2ff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ball
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.size/2,0,Math.PI*2);
    ctx.fillStyle='#cfe6ff';
    ctx.fill();
  }
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fill();
}

const FX=[];
function particles(x,y,color){
  for (let i=0;i<24;i++){
    const a = Math.random()*Math.PI*2;
    const sp = 2+Math.random()*3;
    FX.push({x,y,vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, t:0, life:40, color});
  }
}

// Power-ups
const PUS = [];
function spawnPowerUps(){
  PUS.length=0;
  for (let i=0;i<3;i++){
    const types = ['grow','slow','multiball'];
    const type = types[i];
    const x = W*0.25 + i*W*0.25 + (Math.random()*120-60);
    const y = 120 + Math.random()*(H-240);
    PUS.push({x,y,type,t:0});
  }
}
function drawPU(p){
  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 12;
  if (p.type==='grow') ctx.fillStyle = '#7af5a0';
  if (p.type==='slow') ctx.fillStyle = '#7ad7f5';
  if (p.type==='multiball') ctx.fillStyle = '#f5d67a';
  ctx.beginPath(); ctx.arc(p.x,p.y,12,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

let left = new Paddle(60);
let right = new Paddle(W-60);
let balls = [new Ball()];
let ai=true, paused=true;
let scoreL=0, scoreR=0;

function resetRound(dir){
  balls = [new Ball()];
  balls[0].reset(dir);
  left.y=H/2; right.y=H/2;
  paused=false;
}

function toggleMode(){
  ai = !ai;
  modeEl.textContent = ai ? 'Mode: 1P vs AI (press M to toggle)' : 'Mode: 2-Player (press M to toggle)';
}

addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase();
  if (k===' '){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if (paused) resetRound(Math.random()<0.5?-1:1); }
  if (k==='m') toggleMode();
  if (k==='p') paused=!paused;
});

spawnPowerUps();
scoreEl.textContent = `${scoreL} : ${scoreR}`;

function loop(){
  requestAnimationFrame(loop);
  // background
  ctx.fillStyle='#0c1020'; ctx.fillRect(0,0,W,H);

  // center net + borders
  ctx.fillStyle='#1e2740';
  for (let y=20;y<H;y+=24){ ctx.fillRect(W/2-3,y,6,12); }
  ctx.fillRect(10,10,W-20,2); ctx.fillRect(10,H-12,W-20,2);

  if (!paused){
    // inputs
    const p1in = {up: keys['w']||touchUp, down: keys['s']||touchDown};
    const p2in = ai ? aiMove(right, balls[0]) : {up: keys['arrowup'], down: keys['arrowdown']};

    left.step(p1in); right.step(p2in);

    balls.forEach(b=> b.step(left,right));

    // FX
    FX.forEach(f=>{ f.x+=f.vx; f.y+=f.vy; f.vx*=0.98; f.vy*=0.98; f.t++; });
    for (let i=FX.length-1;i>=0;i--){ if (FX[i].t>FX[i].life) FX.splice(i,1); }

    // power-ups collide with first ball
    for (let i=PUS.length-1;i>=0;i--){
      const p=PUS[i], b=balls[0];
      const d = Math.hypot(b.x-p.x, b.y-p.y);
      if (d<22){
        if (p.type==='grow'){ left.growTimer=360; right.growTimer=360; beep(660,0.08,'sawtooth',0.05); }
        if (p.type==='slow'){ balls.forEach(bb=>{ bb.vx*=0.8; bb.vy*=0.8; }); beep(300,0.08,'triangle',0.05); }
        if (p.type==='multiball' && balls.length<3){
          const nb = new Ball(); nb.x=b.x; nb.y=b.y; nb.vx=-b.vx*0.9; nb.vy=b.vy*0.9; balls.push(nb); beep(900,0.1,'square',0.05);
        }
        PUS.splice(i,1);
      }
    }
    if (PUS.length===0) spawnPowerUps();

    // score check
    for (let i=balls.length-1;i>=0;i--){
      const b=balls[i];
      if (b.x < -40){ // right scores
        scoreR++; scoreEl.textContent = `${scoreL} : ${scoreR}`; beep(220,0.2,'sine',0.06); paused=true; spawnPowerUps(); checkWin(); }
      if (b.x > W+40){ // left scores
        scoreL++; scoreEl.textContent = `${scoreL} : ${scoreR}`; beep(220,0.2,'sine',0.06); paused=true; spawnPowerUps(); checkWin(); }
    }
  }

  // draw power-ups
  PUS.forEach(drawPU);

  // draw paddles/balls
  left.draw(); right.draw();
  balls.forEach(b=> b.draw());

  // draw FX
  for (const f of FX){
    const a = Math.max(0,1-f.t/f.life);
    ctx.globalAlpha=a;
    ctx.fillStyle=f.color;
    ctx.fillRect(f.x-2,f.y-2,4,4);
    ctx.globalAlpha=1;
  }

  // overlay text
  if (paused){
    ctx.fillStyle='#e7ecff';
    ctx.font='700 42px system-ui,Segoe UI,Roboto,Inter';
    ctx.textAlign='center';
    ctx.fillText('Press Space to Serve', W/2, H/2-10);
    ctx.font='400 20px system-ui,Segoe UI,Roboto,Inter';
    ctx.fillText('W/S to move • M to toggle 1P/2P • P to pause • Touch ▲▼ for mobile', W/2, H/2+28);
  }
}
function aiMove(paddle, ball){
  // Predictive but fair AI
  const target = ball.y + Math.sign(ball.vy)*40;
  return {up: paddle.y > target+8, down: paddle.y < target-8};
}
function checkWin(){
  if (scoreL>=11 || scoreR>=11){
    const winner = scoreL>scoreR ? 'GOLDY (P1)' : (ai?'AI / P2':'P2');
    setTimeout(()=>{
      alert(`Game Over\\nWinner: ${winner}\\nScore: ${scoreL} : ${scoreR}`);
      scoreL=0; scoreR=0; scoreEl.textContent = `${scoreL} : ${scoreR}`;
    }, 10);
  }
}

// Initialize audio on first user gesture
addEventListener('pointerdown', ()=> { if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); });

loop();
})();