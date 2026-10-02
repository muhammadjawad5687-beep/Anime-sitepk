const express=require('express');
const crypto=require('crypto');
const path=require('path');
const {createClient}=require('@supabase/supabase-js');

const app=express();
const PORT=process.env.PORT||3000;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'change-this-password';
const SESSION_SECRET=process.env.SESSION_SECRET||'change-this-session-secret';
const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY;
const STORAGE_BUCKET=process.env.SUPABASE_STORAGE_BUCKET||'anime-media';

if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY){
  console.warn('WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured. Set them before deployment.');
}
const supabase=SUPABASE_URL&&SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}})
  : null;

app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use(require('cookie-session')({name:'session',keys:[SESSION_SECRET],httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}));
app.use(express.static(path.join(__dirname,'public'),{index:'index.html',redirect:false}));

app.get('/admin.login',(req,res)=>res.sendFile(path.join(__dirname,'public','admin-login-ui.html')));

function id(){return crypto.randomUUID()}
function admin(req,res,next){if(req.session?.admin)return next();res.status(401).json({error:'Admin login required'})}
function requireSupabase(req,res,next){if(supabase)return next();res.status(500).json({error:'Supabase is not configured on this server'})}
function publicUrl(storagePath){return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`}

app.post('/api/login',(req,res)=>{
  if(req.body.password===ADMIN_PASSWORD){req.session.admin=true;return res.json({ok:true})}
  res.status(401).json({error:'Wrong password'});
});
app.post('/api/logout',admin,(req,res)=>{req.session=null;res.json({ok:true})});
app.get('/api/me',(req,res)=>res.json({admin:!!req.session?.admin}));
app.get('/api/storage/config',admin,(req,res)=>res.json({url:SUPABASE_URL||'',anonKey:SUPABASE_ANON_KEY||''}));

app.get('/api/anime',requireSupabase,async(req,res)=>{
  try{
    let q=supabase.from('anime').select('id,title,description,genres,year,status,poster,created_at,episodes(id,number,title,video,created_at)').order('created_at',{ascending:false});
    const {data,error}=await q;
    if(error)throw error;
    let list=(data||[]).map(a=>({...a,createdAt:a.created_at,episodes:(a.episodes||[]).sort((x,y)=>x.number-y.number).map(e=>({...e,createdAt:e.created_at}))}));
    const term=(req.query.q||'').toLowerCase();
    if(term)list=list.filter(a=>(a.title+' '+a.description+' '+(a.genres||[]).join(' ')).toLowerCase().includes(term));
    res.json(list);
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/api/anime/:id',requireSupabase,async(req,res)=>{
  try{
    const {data,error}=await supabase.from('anime').select('id,title,description,genres,year,status,poster,created_at,episodes(id,number,title,video,created_at)').eq('id',req.params.id).single();
    if(error||!data)return res.status(404).json({error:'Not found'});
    res.json({...data,createdAt:data.created_at,episodes:(data.episodes||[]).sort((x,y)=>x.number-y.number).map(e=>({...e,createdAt:e.created_at}))});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/anime',admin,requireSupabase,async(req,res)=>{
  try{
    const a={id:id(),title:req.body.title||'Untitled',description:req.body.description||'',genres:(req.body.genres||'').split(',').map(x=>x.trim()).filter(Boolean),year:req.body.year||'',status:req.body.status||'Ongoing',poster:req.body.poster||'',created_at:new Date().toISOString()};
    const {data,error}=await supabase.from('anime').insert(a).select().single();
    if(error)throw error;
    res.json({...data,createdAt:data.created_at,episodes:[]});
  }catch(e){res.status(500).json({error:e.message})}
});

app.put('/api/anime/:id',admin,requireSupabase,async(req,res)=>{
  try{
    const patch={};
    for(const k of ['title','description','year','status','poster'])if(req.body[k]!==undefined)patch[k]=req.body[k];
    if(req.body.genres!==undefined)patch.genres=req.body.genres.split(',').map(x=>x.trim()).filter(Boolean);
    const {data,error}=await supabase.from('anime').update(patch).eq('id',req.params.id).select('id,title,description,genres,year,status,poster,created_at,episodes(id,number,title,video,created_at)').single();
    if(error||!data)return res.status(404).json({error:'Not found'});
    res.json({...data,createdAt:data.created_at,episodes:data.episodes||[]});
  }catch(e){res.status(500).json({error:e.message})}
});

async function removeStoragePath(url){
  if(!url||!SUPABASE_URL)return;
  const prefix=publicUrl('').replace(/\/$/,'');
  if(!url.startsWith(prefix))return;
  const storagePath=url.slice(prefix.length+1);
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}

app.delete('/api/anime/:id',admin,requireSupabase,async(req,res)=>{
  try{
    const {data:a,error:getError}=await supabase.from('anime').select('poster,episodes(video)').eq('id',req.params.id).single();
    if(getError||!a)return res.status(404).json({error:'Not found'});
    const paths=[];
    if(a.poster)paths.push(a.poster);
    for(const e of a.episodes||[])if(e.video)paths.push(e.video);
    for(const url of paths)await removeStoragePath(url);
    const {error}=await supabase.from('anime').delete().eq('id',req.params.id);
    if(error)throw error;
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});

// Creates a signed upload URL so large videos go straight from the browser to Supabase Storage.
app.post('/api/storage/upload-url',admin,requireSupabase,async(req,res)=>{
  try{
    const {kind,extension}=req.body;
    if(!['video','poster'].includes(kind))return res.status(400).json({error:'Invalid upload type'});
    const safeExt=String(extension||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10);
    const filePath=`${kind}s/${Date.now()}-${crypto.randomUUID()}${safeExt?'.'+safeExt:''}`;
    const {data,error}=await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(filePath,{upsert:false});
    if(error)throw error;
    res.json({path:filePath,token:data.token,publicUrl:publicUrl(filePath)});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post('/api/anime/:id/episodes',admin,requireSupabase,async(req,res)=>{
  try{
    const {number,title,video}=req.body;
    if(!video)return res.status(400).json({error:'Video upload is required'});
    const {data:a,error:ae}=await supabase.from('anime').select('id').eq('id',req.params.id).single();
    if(ae||!a)return res.status(404).json({error:'Anime not found'});
    const {count,error:ce}=await supabase.from('episodes').select('*',{count:'exact',head:true}).eq('anime_id',req.params.id);
    if(ce)throw ce;
    const ep={id:id(),anime_id:req.params.id,number:Number(number||((count||0)+1)),title:title||`Episode ${number||((count||0)+1)}`,video,created_at:new Date().toISOString()};
    const {data,error}=await supabase.from('episodes').insert(ep).select().single();
    if(error)throw error;
    res.json({...data,createdAt:data.created_at});
  }catch(e){res.status(500).json({error:e.message})}
});

app.delete('/api/anime/:aid/episodes/:eid',admin,requireSupabase,async(req,res)=>{
  try{
    const {data:e,error:ee}=await supabase.from('episodes').select('video').eq('id',req.params.eid).eq('anime_id',req.params.aid).single();
    if(ee||!e)return res.status(404).json({error:'Episode not found'});
    await removeStoragePath(e.video);
    const {error}=await supabase.from('episodes').delete().eq('id',req.params.eid).eq('anime_id',req.params.aid);
    if(error)throw error;
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(PORT,'0.0.0.0',()=>console.log(`Anime World PK running on port ${PORT}`));
