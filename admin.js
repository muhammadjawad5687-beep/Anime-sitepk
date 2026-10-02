async function api(u,o){const r=await fetch(u,o);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let supabaseClient=null;
async function getSupabase(){
  if(supabaseClient)return supabaseClient;
  const cfg=await api('/api/storage/config');
  if(!window.supabase||!cfg.url||!cfg.anonKey)throw Error('Supabase upload configuration is missing');
  supabaseClient=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return supabaseClient;
}
async function uploadFile(file,kind){
  if(!file)return '';
  const maxBytes=50*1024*1024;
  if(file.size>maxBytes)throw Error('Supabase Free allows a maximum of 50 MB per file. Please compress this file first.');
  const ext=(file.name.split('.').pop()||'bin').toLowerCase();
  const info=await api('/api/storage/upload-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,extension:ext})});
  const sb=await getSupabase();
  const {error}=await sb.storage.from('anime-media').uploadToSignedUrl(info.path,info.token,file,{contentType:file.type||'application/octet-stream'});
  if(error)throw error;
  return info.publicUrl;
}
async function init(){const m=await api('/api/me');if(m.admin){loginBox.hidden=true;admin.hidden=false;refresh()}}
async function login(){try{await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value})});loginBox.hidden=true;admin.hidden=false;refresh()}catch(e){loginMsg.textContent=e.message}}
async function logout(){await api('/api/logout',{method:'POST'});location.reload()}
animeForm.onsubmit=async e=>{e.preventDefault();try{const fd=new FormData(animeForm);const poster=fd.get('poster');const posterUrl=poster&&poster.size?await uploadFile(poster,'poster'):'';await api('/api/anime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),description:fd.get('description'),genres:fd.get('genres'),year:fd.get('year'),status:fd.get('status'),poster:posterUrl})});animeForm.reset();refresh()}catch(x){alert(x.message)}};
async function refresh(){const list=await api('/api/anime');stats.innerHTML=`<div class="stat"><span class="muted">Anime</span><br><b>${list.length}</b></div><div class="stat"><span class="muted">Episodes</span><br><b>${list.reduce((n,a)=>n+a.episodes.length,0)}</b></div><div class="stat"><span class="muted">Genres</span><br><b>${new Set(list.flatMap(a=>a.genres)).size}</b></div>`;adminList.innerHTML=list.map(a=>`<div class="admin-card"><div class="row"><div><b>${esc(a.title)}</b><div class="muted">${a.episodes.length} episodes · ${esc(a.status)}</div></div><button class="btn danger" onclick="delAnime('${a.id}')">Delete Anime</button></div><form onsubmit="uploadEp(event,'${a.id}')" class="panel"><input name="number" type="number" min="1" placeholder="Episode number" required><input name="title" placeholder="Episode title"><input name="video" type="file" accept="video/*" required><button class="btn">Upload Episode</button></form><div class="episodes">${a.episodes.map(e=>`<div class="episode"><span>EP ${e.number} — ${esc(e.title)}</span><button class="btn danger" onclick="delEp('${a.id}','${e.id}')">Delete</button></div>`).join('')}</div></div>`).join('')||'<p class="muted">No anime yet.</p>'}
async function uploadEp(ev,id){ev.preventDefault();const button=ev.target.querySelector('button');try{button.disabled=true;button.textContent='Uploading…';const fd=new FormData(ev.target);const file=fd.get('video');const videoUrl=await uploadFile(file,'video');await api('/api/anime/'+id+'/episodes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number:fd.get('number'),title:fd.get('title'),video:videoUrl})});ev.target.reset();refresh()}catch(e){alert(e.message)}finally{button.disabled=false;button.textContent='Upload Episode'}}
async function delAnime(id){if(confirm('Delete anime and all its uploaded files?')){await api('/api/anime/'+id,{method:'DELETE'});refresh()}}
async function delEp(a,e){if(confirm('Delete episode?')){await api('/api/anime/'+a+'/episodes/'+e,{method:'DELETE'});refresh()}}
init();
