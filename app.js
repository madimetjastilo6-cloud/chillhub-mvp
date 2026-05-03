const socket = io();
let selectedRole = location.pathname.toLowerCase().includes('/host') ? 'host' : 'user';
let me = JSON.parse(localStorage.getItem('chillProfile') || 'null');
let peerId = null, pc = null, localStream = null, muted=false, camOff=false, timerInt=null, seconds=20;
const $ = id => document.getElementById(id);

document.querySelectorAll('.rolePick button').forEach(b=>b.onclick=()=>{selectedRole=b.dataset.role;document.querySelectorAll('.rolePick button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
document.querySelectorAll('.rolePick button').forEach(b=>b.classList.toggle('selected', b.dataset.role===selectedRole));
$('enterBtn').onclick=()=>{ me={name:$('nameInput').value||'Say Less',role:selectedRole,country:'South Africa',coins:20,tickets:3}; localStorage.setItem('chillProfile',JSON.stringify(me)); $('setup').classList.remove('show'); register(); };
if(me){ if(location.pathname.toLowerCase().includes('/host')) me.role='host'; if(location.pathname.toLowerCase().includes('/user')) me.role='user'; localStorage.setItem('chillProfile',JSON.stringify(me)); $('setup').classList.remove('show'); register(); }
function register(){ socket.emit('register', me); updateUI(); }
socket.on('me', u=>{ me={...me,...u}; localStorage.setItem('chillProfile',JSON.stringify(me)); updateUI(); });
function updateUI(){
  if(!me)return;
  $('coinCount').textContent=me.coins||20;
  $('ticketCount').textContent=me.tickets||3;
  $('profileCoins').textContent=me.coins||20;
  $('profileName').textContent=me.name;
  $('profileId').textContent='ID:'+String(me.id||'offline').slice(0,8)+' • '+me.role;
  $('profileAvatar').textContent=me.role==='host'?'💃':'🙂';
  $('heroAvatar').textContent=me.role==='host'?'✅':'👩';
  $('roleBtn').textContent=me.role==='host'?'Switch to User Mode':'Switch to Host Mode';
  document.body.classList.toggle('hostMode', me.role==='host');
  $('startBtn').innerHTML = me.role==='host' ? '✅ Host Mode Online <span>Waiting</span>' : '📹 Start Video Chat <span>Free</span>';
}


document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(b.dataset.go).classList.add('active');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active'); if(b.dataset.go==='hosts') socket.emit('get-hosts');});
$('startBtn').onclick=()=>{ if(me?.role==='host'){ alert('Host mode is ON. Leave this phone open and call from the other device.'); return; } document.querySelector('[data-go="hosts"]').click()};
$('refreshHosts').onclick=()=>socket.emit('get-hosts');
$('roleBtn').onclick=()=>{ const role=me.role==='host'?'user':'host'; me.role=role; localStorage.setItem('chillProfile',JSON.stringify(me)); socket.emit('change-role',role); updateUI(); alert('Now you are '+role+'. Keep this page open.'); };
$('editBtn').onclick=()=>{ $('editName').value=me.name; $('editRole').value=me.role; $('editModal').classList.add('show'); };
function closeEdit(){ $('editModal').classList.remove('show'); }
function saveEdit(){ me.name=$('editName').value||me.name; me.role=$('editRole').value; localStorage.setItem('chillProfile',JSON.stringify(me)); socket.emit('register',me); closeEdit(); updateUI(); }
$('coinBtn').onclick=$('getMore').onclick=()=> $('buyModal').classList.add('show'); function closeBuy(){ $('buyModal').classList.remove('show'); }

socket.on('hosts', list=>{ const box=$('hostList'); box.innerHTML=''; const filtered=list.filter(h=>h.id!==me?.id); if(!filtered.length){box.innerHTML='<p>No hosts yet. On the other device tap Profile → Switch to Host Mode, then refresh.</p>';return;} filtered.forEach(h=>{ const d=document.createElement('div'); d.className='host'; d.innerHTML=`<div class="av">${h.avatar||'💃'}</div><div><b>${h.name}</b><p>🟢 online • ${h.country}</p></div><button>Call</button>`; d.querySelector('button').onclick=()=>startCall(h.id); box.appendChild(d); }); });

async function ensureMedia(){
  if(localStream)return localStream;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    throw new Error('Camera needs HTTPS on iPhone. Use: npx localtunnel --port 3000 and open the https:// link on both devices.');
  }
  try{
    localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    $('localVideo').srcObject=localStream;
    return localStream;
  }catch(err){
    console.error(err);
    throw new Error('Camera permission failed. On iPhone use the HTTPS localtunnel link, then allow Camera + Microphone.');
  }
}

function makePC(){ pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}); pc.onicecandidate=e=>{ if(e.candidate) socket.emit('webrtc-ice',{to:peerId,candidate:e.candidate});}; pc.ontrack=e=>{$('remoteVideo').srcObject=e.streams[0];}; localStream.getTracks().forEach(t=>pc.addTrack(t,localStream)); }
async function startCall(hostId){ peerId=hostId; socket.emit('call-host',{hostId}); alert('Calling host... accept on the other device.'); }
socket.on('incoming-call', async ({from,caller})=>{ peerId=from; $('incomingText').textContent=(caller?.name||'Someone')+' wants to call you'; $('incoming').classList.add('show'); });
$('acceptBtn').onclick=async()=>{
  $('acceptBtn').disabled=true;
  $('acceptBtn').textContent='Opening camera...';
  try{
    await ensureMedia();
    makePC();
    socket.emit('accept-call',{to:peerId});
    $('incoming').classList.remove('show');
    openCall();
  }catch(e){
    alert(e.message || e);
  }finally{
    $('acceptBtn').disabled=false;
    $('acceptBtn').textContent='Accept';
  }
};
$('rejectBtn').onclick=()=>{ socket.emit('reject-call',{to:peerId}); $('incoming').classList.remove('show'); };
socket.on('call-accepted', async ({from})=>{
  peerId=from;
  try{
    await ensureMedia();
    makePC();
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc-offer',{to:peerId,offer});
    openCall();
  }catch(e){
    alert(e.message || e);
  }
});
socket.on('webrtc-offer', async ({from,offer})=>{
  peerId=from;
  try{
    if(!pc){ await ensureMedia(); makePC(); }
    await pc.setRemoteDescription(offer);
    const answer=await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer',{to:peerId,answer});
    openCall();
  }catch(e){
    alert(e.message || e);
  }
});
socket.on('webrtc-answer', async ({answer})=>{ if(pc) await pc.setRemoteDescription(answer); });
socket.on('webrtc-ice', async ({candidate})=>{ try{ if(pc) await pc.addIceCandidate(candidate); }catch(e){console.warn(e)} });
socket.on('call-ended',()=>endCall(false)); socket.on('call-rejected',()=>alert('Call rejected'));
function openCall(){ $('callScreen').classList.add('show'); seconds=20; tick(); clearInterval(timerInt); timerInt=setInterval(tick,1000); }
function tick(){ $('timer').textContent='00:'+String(seconds).padStart(2,'0'); if(seconds--<=0) endCall(); }
function endCall(notify=true){ if(notify&&peerId) socket.emit('end-call',{to:peerId}); clearInterval(timerInt); if(pc){pc.close();pc=null;} if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;} $('localVideo').srcObject=null; $('remoteVideo').srcObject=null; $('callScreen').classList.remove('show'); }
function toggleMic(){ if(!localStream)return; muted=!muted; localStream.getAudioTracks().forEach(t=>t.enabled=!muted); }
function toggleCam(){ if(!localStream)return; camOff=!camOff; localStream.getVideoTracks().forEach(t=>t.enabled=!camOff); }
function sendGift(gift){ if(peerId) socket.emit('gift',{to:peerId,gift}); }
socket.on('gift',({from,gift})=>alert(`${from} sent ${gift}`));


socket.on('call-error', msg=>alert(msg));
setInterval(()=>{ if(me) socket.emit('register', me); }, 15000); // keep host visible
