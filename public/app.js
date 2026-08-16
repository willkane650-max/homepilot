'use strict';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
function esc(s){return String(s==null?'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function timeAgo(iso){const s=(Date.now()-new Date(iso).getTime())/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';if(s<604800)return Math.floor(s/86400)+'d ago';return new Date(iso).toLocaleDateString();}
function fmtDate(iso){if(!iso)return '—';return new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function shortDate(iso){if(!iso)return '—';return new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'});}
function countdown(iso){if(!iso)return'';const d=new Date(iso)-Date.now();if(d<=0)return'<span class="countdown expired">Expired</span>';const days=Math.floor(d/86400000);const hrs=Math.floor((d%86400000)/3600000);return'<span class="countdown"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'+(days>0?days+'d '+hrs+'h':hrs+'h remaining')+'</span>';}
function skeleton(n=3){return Array.from({length:n},()=>'').map(()=>'<div class="skeleton skeleton-card"></div>').join('');}
function deviceStatusDot(status){const s=['locked','armed','on','recording','active','dry','normal'].includes(status)?'green':['unlocked','disarmed','off'].includes(status)?'amber':'red';return`<span class="dot ${s}"></span>`;}

/* ============ state ============ */
const state={user:null,properties:[],currentProperty:null,current:'dashboard',notifCount:0};

/* ============ api ============ */
async function api(path,opts={}){
  const res=await fetch(path,{method:opts.method||'GET',headers:opts.body?{'Content-Type':'application/json'}:undefined,credentials:'include',body:opts.body?JSON.stringify(opts.body):undefined});
  let data={};try{data=await res.json();}catch(e){}
  if(!res.ok){const err=new Error(data.error||'Request failed ('+res.status+')');err.status=res.status;throw err;}
  return data;
}

/* ============ toasts ============ */
function toast(msg,type='ok'){
  const el=document.createElement('div');el.className='toast '+type;el.textContent=msg;
  $('#toasts').appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},3600);
}

/* ============ icons ============ */
const ICONS={
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
  unlock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>',
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>',
  alarm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
  thermostat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z"/></svg>',
  gate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V3h18v18M3 12h18M3 7h18M3 17h18M7 3v18M17 3v18"/></svg>',
  garage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-7 9 7v12"/><path d="M9 21v-6h6v6"/></svg>',
  sensor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M16.36 7.64l1.42-1.42"/></svg>',
};

/* ============ auth ============ */
function showAuth(){$('#auth-screen').style.display='';$('#shell').classList.remove('show');}
function showApp(){$('#auth-screen').style.display='none';$('#shell').classList.add('show');}

function bindAuth(){
  const setMode=m=>{const login=m==='login';$('#tab-login').classList.toggle('active',login);$('#tab-register').classList.toggle('active',!login);$('#form-login').style.display=login?'':'none';$('#form-register').style.display=login?'none':'';$('#auth-title').textContent=login?'Sign in':'Create account';$('#auth-sub').textContent=login?'The operating system for your property.':'Manage properties, agents, and smart devices.';};
  $('#tab-login').onclick=()=>setMode('login');$('#tab-register').onclick=()=>setMode('register');
  $('#form-login').onsubmit=async e=>{e.preventDefault();const btn=$('#li-btn');btn.disabled=true;btn.textContent='Signing in…';try{await api('/api/auth/login',{method:'POST',body:{email:$('#li-email').value,password:$('#li-pass').value}});await enter();}catch(err){errBox(err.message);}finally{btn.disabled=false;btn.textContent='Sign in';}};
  $('#form-register').onsubmit=async e=>{e.preventDefault();const btn=$('#rg-btn');btn.disabled=true;btn.textContent='Creating…';try{await api('/api/auth/register',{method:'POST',body:{name:$('#rg-name').value,email:$('#rg-email').value,password:$('#rg-pass').value}});await enter();}catch(err){errBox(err.message);}finally{btn.disabled=false;btn.textContent='Create account';}};
}
function errBox(m){const e=$('#auth-err');e.textContent=m;e.classList.add('show');}

/* ============ navigation ============ */
const _views={};const _binders={};
function reg(name,fn){_views[name]=fn;}
function goto(view,state2){state.current=view;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$$('.mnav a').forEach(a=>a.classList.toggle('active',a.dataset.view===view));renderView();}
function renderView(){const fn=_views[state.current];if(fn){$('#main').innerHTML=fn();$('#main').className='main fade-in';if(_binders[state.current])_binders[state.current]();}}

async function enter(){
  showApp();
  const me=await api('/api/auth/me');state.user=me.user;
  $('#me-name').textContent=state.user.name;
  $('#me-role').textContent=state.user.role==='owner'?'Property Owner':'Agent';
  $('#me-avatar').textContent=state.user.name.charAt(0).toUpperCase();
  goto('dashboard');
}

/* ============ VIEW: dashboard ============ */
reg('dashboard',async()=>{
  try{
    const d=await api('/api/dashboard');
    const greeting=state.user.role==='owner'?'Welcome back, '+state.user.name.split(' ')[0]:'Hello, '+state.user.name.split(' ')[0];
    let html=`<div class="view-head"><div><h2>${esc(greeting)}</h2><div class="sub">${state.user.role==='owner'?'Manage your properties, agents, and smart devices.':'Your assigned properties and tasks.'}</div></div></div>`;

    if(state.user.role==='owner'){
      if(!d.properties){
        html+=`<div class="onboarding"><div class="onb-icon">👋</div><div class="onb-text"><h4>Welcome to HomePilot!</h4><p>Get started by adding your first property. You can then invite agents, connect smart devices, and manage everything from one place.</p></div><button class="btn btn-primary btn-sm" onclick="showAddProperty()">+ Add Property</button></div>`;
      }
      html+=`<div class="stat-grid">
        <div class="stat-card"><div class="label">Properties</div><div class="value">${d.properties||0}</div></div>
        <div class="stat-card"><div class="label">Active Agents</div><div class="value blue">${d.activeAgents||0}</div></div>
        <div class="stat-card"><div class="label">Open Maintenance</div><div class="value" style="color:var(--amber)">${d.openMaintenance||0}</div></div>
        <div class="stat-card"><div class="label">Smart Devices</div><div class="value green">${d.totalDevices||0}</div></div>
      </div>`;

      if(d.propertiesList&&d.propertiesList.length){
        html+=`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0">My Properties</h3><button class="btn btn-ghost btn-sm" onclick="goto('properties')">View all →</button></div><div class="panel-grid">`;
        d.propertiesList.forEach(p=>{
          html+=`<div class="prop-card" onclick="viewProperty(${p.id})" style="padding-top:0;overflow:hidden">
            <div class="prop-cover cover-residential"></div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="prop-name">${esc(p.name)}</div></div>
            <div class="prop-loc">📍 ${esc([p.city,p.state,p.country].filter(Boolean).join(', ')||'Location not set')}</div>
          </div>`;
        });
        html+=`</div></div>`;
      }else{
        html+=`<div class="panel"><div class="empty-enhanced"><div class="empty-icon">🏠</div><h3>No properties yet</h3><p>Add your first property to start managing it with HomePilot.</p><button class="btn btn-primary" onclick="showAddProperty()">+ Add Property</button></div></div>`;
      }
    }else{
      html+=`<div class="panel"><div class="empty-enhanced"><div class="empty-icon">📋</div><h3>Waiting for assignment</h3><p>You will see properties here once an owner assigns you access.</p></div></div>`;
    }

    if(d.recentActivity&&d.recentActivity.length){
      html+=`<div class="panel"><h3>Recent Activity</h3><div class="timeline">`;
      d.recentActivity.slice(0,8).forEach(l=>{
        html+=`<div class="tl-item"><div class="tl-time">${fmtDate(l.createdAt)}</div><div class="tl-text"><b>${esc(l.user?.name||'System')}</b> — ${esc(l.detail)}</div></div>`;
      });
      html+=`</div></div>`;
    }

    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: properties ============ */
reg('properties',async()=>{
  try{
    const d=await api('/api/properties');
    state.properties=d.properties||[];
    let html=`<div class="view-head"><div><h2>Properties</h2><div class="sub">Manage your real estate portfolio.</div></div>`;
    if(state.user.role==='owner')html+=`<button class="btn btn-primary" onclick="showAddProperty()">+ Add Property</button>`;
    html+=`</div>`;
    if(!d.properties.length){html+=`<div class="panel"><div class="empty-enhanced"><div class="empty-icon">🏠</div><h3>No properties yet</h3><p>Add your first property to start managing it with HomePilot.</p><button class="btn btn-primary" onclick="showAddProperty()">+ Add Property</button></div></div>`;return html;}
    html+=`<div class="panel-grid">`;
    d.properties.forEach(p=>{
      const coverClass=p.type==='commercial'?'cover-commercial':p.type==='mixed'?'cover-mixed':'cover-residential';
      html+=`<div class="prop-card" onclick="viewProperty(${p.id})" style="padding-top:0;overflow:hidden">
        <div class="prop-cover ${coverClass}"></div>
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div><div class="prop-name">${esc(p.name)}</div><div class="prop-loc">📍 ${esc([p.city,p.state,p.country].filter(Boolean).join(', ')||'No address')}</div></div>
          <span class="badge green">Active</span>
        </div>
        <div class="prop-stats">
          <span>🛏 ${p.bedrooms||0} bed</span><span>🚿 ${p.bathrooms||0} bath</span>
          <span>🔧 ${p.deviceCount||0} devices</span><span>👥 ${p.agentCount||0} agents</span>
          <span>🛠 ${p.openMaintenance||0} open</span>
        </div>
      </div>`;
    });
    html+=`</div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

function showAddProperty(){
  openModal(`
    <h3>Add Property</h3>
    <div class="form-grid">
      <div class="field"><label>Property name</label><input id="mp-name" placeholder="Smith Residence" required></div>
      <div class="field"><label>Type</label><select id="mp-type"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="mixed">Mixed Use</option></select></div>
      <div class="field" style="grid-column:span 2"><label>Address</label><input id="mp-addr" placeholder="123 Main Street"></div>
      <div class="field"><label>City</label><input id="mp-city" placeholder="New York"></div>
      <div class="field"><label>State / Region</label><input id="mp-state" placeholder="NY"></div>
      <div class="field"><label>Country</label><input id="mp-country" placeholder="United States"></div>
      <div class="field"><label>Zip / Postal Code</label><input id="mp-zip" placeholder="10001"></div>
      <div class="field"><label>Bedrooms</label><input id="mp-bed" type="number" min="0" value="3"></div>
      <div class="field"><label>Bathrooms</label><input id="mp-bath" type="number" min="0" value="2"></div>
    </div>
    <div class="field"><label>Description</label><textarea id="mp-desc" rows="3" placeholder="Describe the property..."></textarea></div>
    <div class="errbox" id="mp-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="mp-go">Create Property</button>
    </div>`);
  $('#mp-go').onclick=async()=>{
    const btn=$('#mp-go');btn.disabled=true;btn.textContent='Creating…';
    try{
      await api('/api/properties',{method:'POST',body:{name:$('#mp-name').value,type:$('#mp-type').value,address:$('#mp-addr').value,city:$('#mp-city').value,state:$('#mp-state').value,country:$('#mp-country').value,zipCode:$('#mp-zip').value,bedrooms:Number($('#mp-bed').value),bathrooms:Number($('#mp-bath').value),description:$('#mp-desc').value}});
      closeModal();toast('Property created!','ok');goto('properties');
    }catch(e){$('#mp-err').textContent=e.message;$('#mp-err').classList.add('show');}
    finally{btn.disabled=false;btn.textContent='Create Property';}
  };
}

async function viewProperty(id){
  try{
    const d=await api('/api/properties/'+id);
    const p=d.property;
    state.currentProperty=p;
    let html=`<div class="view-head"><div>
      <button class="btn btn-ghost btn-sm" onclick="goto('properties')" style="margin-bottom:8px">← Back to Properties</button>
      <h2>${esc(p.name)}</h2>
      <div class="sub">📍 ${esc([p.address,p.city,p.state,p.country].filter(Boolean).join(', '))} · ${esc(p.type)}</div>
    </div>`;
    if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showHandover(${p.id})">Handover Property</button>`;
    html+=`</div>`;

    html+=`<div class="sub-tabs" id="prop-tabs">
      <button class="active" data-tab="overview">Overview</button>
      <button data-tab="people">People</button>
      <button data-tab="devices">Devices</button>
      <button data-tab="maintenance">Maintenance</button>
      <button data-tab="tenants">Tenants</button>
      <button data-tab="documents">Documents</button>
      <button data-tab="activity">Activity</button>
      ${state.user.role==='owner'?'<button data-tab="settings">Settings</button>':''}
    </div>`;

    html+=`<div id="prop-tab-content"></div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
}

_binders.properties=undefined;

async function renderPropertyTab(tab,pid){
  const el=$('#prop-tab-content');if(!el)return;
  el.innerHTML=skeleton(3);
  try{
    if(tab==='overview'){
      const d=await api('/api/properties/'+pid);const p=d.property;
      const coverClass=p.type==='commercial'?'cover-commercial':p.type==='mixed'?'cover-mixed':'cover-residential';
      const onlineDevices=d.devices.filter(dev=>['locked','armed','on','recording','active','dry','normal'].includes(dev.status)).length;
      el.innerHTML=`
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Bedrooms</div><div class="value">${p.bedrooms||0}</div></div>
          <div class="stat-card"><div class="label">Bathrooms</div><div class="value">${p.bathrooms||0}</div></div>
          <div class="stat-card"><div class="label">Devices Online</div><div class="value green">${onlineDevices}/${d.devices.length}</div></div>
          <div class="stat-card"><div class="label">Agents</div><div class="value">${d.members.length}</div></div>
        </div>
        <div class="panel"><h3>Property Details</h3>
          <p style="font-size:14px;color:var(--text-sub);margin-bottom:16px">${esc(p.description||'No description.')}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;font-size:13px"><span>📍</span>${esc([p.address,p.city,p.state,p.country].filter(Boolean).join(', '))}</div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px"><span>🏠</span>${esc(p.type.charAt(0).toUpperCase()+p.type.slice(1))} property</div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px"><span>🔑</span>Zip: ${esc(p.zipCode||'N/A')}</div>
          </div>
          <div class="panel-grid">
            <div><h3>Emergency Contacts</h3>
              ${d.emergencyContacts.length?d.emergencyContacts.map(c=>`<div class="access-card"><div class="access-info"><div class="access-name">${esc(c.name)}</div><div class="access-detail">${esc(c.role)} · ${esc(c.phone)}</div></div></div>`).join(''):'<p class="sub">No emergency contacts configured.</p>'}
              ${state.user.role==='owner'?`<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="showAddEmergency(${pid})">+ Add Contact</button>`:''}
            </div>
            <div><h3>Access Grants</h3>
              ${d.accessGrants.length?d.accessGrants.map(g=>`<div class="access-card"><div class="access-info"><div class="access-name">${esc(g.user?.name||'Unknown')}</div><div class="access-detail">${g.expiresAt?countdown(g.expiresAt):'<span class="badge green">Permanent</span>'}</div></div><span class="badge ${g.status==='active'?'green':g.status==='suspended'?'amber':'red'}">${g.status}</span></div>`).join(''):'<p class="sub">No active access grants.</p>'}
            </div>
          </div>
        </div>`;
    }else if(tab==='people'){
      const d=await api('/api/properties/'+pid);
      el.innerHTML=`<div class="panel"><h3>Assigned Agents</h3>
        ${d.members.length?`<table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Permissions</th>${state.user.role==='owner'?'<th>Action</th>':''}</tr></thead><tbody>`+d.members.map(m=>`<tr>
          <td><b>${esc(m.user?.name||'Unknown')}</b></td><td>${esc(m.user?.email||'')}</td><td><span class="badge blue">${esc(m.role)}</span></td>
          <td>${m.permissions.slice(0,3).map(p=>'<span class="badge neutral">'+esc(p)+'</span>').join(' ')}${m.permissions.length>3?' <span class="badge neutral">+'+(m.permissions.length-3)+'</span>':''}</td>
          ${state.user.role==='owner'?`<td><button class="btn btn-danger btn-sm" onclick="revokeAccess(${m.user?.id},${pid})">Revoke</button></td>`:''}
        </tr>`).join('')+'</tbody></table>':'<p class="sub">No agents assigned yet.</p>'}
        ${state.user.role==='owner'?`<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showHandover(${pid})">+ Add Agent</button>`:''}
      </div>`;
    }else if(tab==='devices'){
      const d=await api('/api/devices?propertyId='+pid);
      const dAct=await api('/api/activity?propertyId='+pid+'&limit=30');
      let html=`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0">Smart Devices</h3>`;
      if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showAddDevice(${pid})">+ Add Device</button>`;
      html+=`</div>`;
      if(!d.devices.length){html+=`<div class="empty-enhanced"><div class="empty-icon">📡</div><h3>No devices yet</h3><p>Add smart locks, cameras, sensors, and more to control your property.</p></div>`;}
      else{
        html+=`<div class="panel-grid">`;
        d.devices.forEach(dev=>{
          const typeIcon=dev.type==='lock'?'🔒':dev.type==='camera'?'📹':dev.type==='light'?'💡':dev.type==='alarm'?'🚨':dev.type==='thermostat'?'🌡️':dev.type==='gate'?'🚪':dev.type==='garage'?'🏠':dev.type==='sensor'?'📡':'🔧';
          const statusColor=dev.status==='locked'||dev.status==='armed'||dev.status==='on'||dev.status==='recording'||dev.status==='active'||dev.status==='dry'||dev.status==='normal'?'green':dev.status==='unlocked'||dev.status==='disarmed'||dev.status==='off'?'amber':'red';
          const devActions=dAct.activities.filter(a=>a.resourceType==='device'&&a.resourceId===dev.id).slice(0,2);
          html+=`<div class="dev-card">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div style="display:flex;align-items:center;gap:10px">
                <div class="section-icon" style="background:var(--bg3);font-size:20px">${typeIcon}</div>
                <div><div class="dev-name">${esc(dev.name)}</div><div class="dev-type">${esc(dev.type)} · ${esc(dev.location||'Unassigned')} <span class="badge demol">DEMO</span></div></div>
              </div>
              <span class="badge ${statusColor==='green'?'green':statusColor==='amber'?'amber':'red'}">${esc(dev.status)}</span>
            </div>
            <div class="dev-status">${deviceStatusDot(dev.status)}<span style="color:var(--text-sub)">${esc(dev.status)}</span>${dev.lastActionAt?' · <span style="color:var(--text-muted)">'+timeAgo(dev.lastActionAt)+'</span>':''}</div>`;
          if(devActions.length){
            html+=`<div class="dev-history">`;
            devActions.forEach(a=>{
              html+=`<div class="dev-history-item">${deviceStatusDot(a.detail.includes('lock')||a.detail.includes('arm')||a.detail.includes('on')?'green':'red')}<span>${esc(a.user?.name||'System')}: ${esc(a.action)} · ${timeAgo(a.createdAt)}</span></div>`;
            });
            html+=`</div>`;
          }
          html+=`<div class="dev-actions">`;
          if(dev.type==='lock'){
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'lock',${pid})">🔒 Lock</button>`;
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'unlock',${pid})">🔓 Unlock</button>`;
          }else if(dev.type==='alarm'){
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'arm',${pid})">🚨 Arm</button>`;
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'disarm',${pid})">🔕 Disarm</button>`;
          }else if(dev.type==='camera'){
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'on',${pid})">📹 On</button>`;
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'off',${pid})">⬜ Off</button>`;
          }else if(dev.type==='light'){
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'on',${pid})">💡 On</button>`;
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'off',${pid})">🌙 Off</button>`;
          }else{
            html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'toggle',${pid})">Toggle</button>`;
          }
          html+=`</div></div>`;
        });
        html+=`</div>`;
      }
      html+=`</div>`;el.innerHTML=html;
    }else if(tab==='maintenance'){
      const d=await api('/api/maintenance?propertyId='+pid);
      let html=`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0">Maintenance Requests</h3>`;
      html+=`<button class="btn btn-primary btn-sm" onclick="showNewMaint(${pid})">+ New Request</button>`;
      html+=`</div>`;
      if(!d.requests.length){html+=`<div class="empty"><p>No maintenance requests.</p></div>`;}
      else{
        d.requests.forEach(r=>{
          html+=`<div class="maint-card">
            <div style="display:flex;justify-content:space-between;align-items:start">
              <div class="maint-title">${esc(r.title)}</div>
              <span class="badge ${r.status==='open'?'amber':r.status==='completed'?'green':'blue'}">${r.status}</span>
            </div>
            <div class="maint-desc">${esc(r.description)}</div>
            <div class="maint-meta">
              <span class="badge ${r.priority==='high'?'red':r.priority==='medium'?'amber':'neutral'}">${r.priority}</span>
              <span>Reported by ${esc(r.reportedBy?.name||'Unknown')}</span>
              <span>${fmtDate(r.createdAt)}</span>
            </div>
            ${state.user.role==='owner'&&r.status!=='completed'?`<div style="margin-top:8px;display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" onclick="updateMaint(${r.id},'completed','${pid}')">Mark Complete</button>
              <button class="btn btn-ghost btn-sm" onclick="updateMaint(${r.id},'in_progress','${pid}')">In Progress</button>
            </div>`:''}
          </div>`;
        });
      }
      html+=`</div>`;el.innerHTML=html;
    }else if(tab==='tenants'){
      const d=await api('/api/tenants?propertyId='+pid);
      let html=`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0">Tenants</h3>`;
      if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showAddTenant(${pid})">+ Add Tenant</button>`;
      html+=`</div>`;
      if(!d.tenants.length){html+=`<div class="empty"><p>No tenants recorded.</p></div>`;}
      else{
        html+=`<table class="tbl"><thead><tr><th>Name</th><th>Unit</th><th>Contact</th><th>Rent</th><th>Tenancy</th></tr></thead><tbody>`;
        d.tenants.forEach(t=>{
          html+=`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.unit)}</td><td>${esc(t.email||t.phone||'—')}</td><td>${t.rent?'$'+t.rent.toLocaleString():'—'}</td><td>${shortDate(t.startDate)} — ${shortDate(t.endDate)||'Ongoing'}</td></tr>`;
        });
        html+=`</tbody></table>`;
      }
      html+=`</div>`;el.innerHTML=html;
    }else if(tab==='documents'){
      const d=await api('/api/documents?propertyId='+pid);
      let html=`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0">Documents</h3>`;
      if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showAddDoc(${pid})">+ Upload Document</button>`;
      html+=`</div>`;
      if(!d.documents.length){html+=`<div class="empty"><p>No documents uploaded.</p></div>`;}
      else{
        d.documents.forEach(doc=>{
          html+=`<div class="access-card"><div style="font-size:20px;margin-right:10px">📄</div><div class="access-info"><div class="access-name">${esc(doc.name)}</div><div class="access-detail">${esc(doc.category)} · ${fmtDate(doc.createdAt)}</div></div></div>`;
        });
      }
      html+=`</div>`;el.innerHTML=html;
    }else if(tab==='activity'){
      const d=await api('/api/activity?propertyId='+pid);
      let html=`<div class="panel"><h3>Activity Log</h3>`;
      if(!d.activities.length){html+=`<div class="empty"><p>No activity recorded.</p></div>`;}
      else{
        html+=`<div class="timeline">`;
        d.activities.slice(0,50).forEach(l=>{
          html+=`<div class="tl-item"><div class="tl-time">${fmtDate(l.createdAt)}</div><div class="tl-text"><b>${esc(l.user?.name||'System')}</b> — ${esc(l.detail)}</div></div>`;
        });
        html+=`</div>`;
      }
      html+=`</div>`;el.innerHTML=html;
    }else if(tab==='settings'){
      const d=await api('/api/properties/'+pid);const p=d.property;
      el.innerHTML=`
        <div class="panel">
          <h3>Property Settings</h3>
          <div class="settings-section">
            <div class="settings-row"><div><div class="settings-label">Property Name</div><div class="settings-desc">${esc(p.name)}</div></div><button class="btn btn-ghost btn-sm" onclick="showEditProperty(${pid},'name')">Edit</button></div>
          </div>
          <div class="settings-section">
            <div class="settings-row"><div><div class="settings-label">Address</div><div class="settings-desc">${esc([p.address,p.city,p.state,p.country].filter(Boolean).join(', ')||'Not set')}</div></div><button class="btn btn-ghost btn-sm" onclick="showEditProperty(${pid},'address')">Edit</button></div>
          </div>
          <div class="settings-section">
            <div class="settings-row"><div><div class="settings-label">Property Type</div><div class="settings-desc">${esc(p.type)}</div></div></div>
          </div>
          <div class="settings-section">
            <div class="settings-row"><div><div class="settings-label">Description</div><div class="settings-desc" style="max-width:400px">${esc(p.description||'No description')}</div></div><button class="btn btn-ghost btn-sm" onclick="showEditProperty(${pid},'desc')">Edit</button></div>
          </div>
        </div>
        <div class="panel" style="border-color:var(--red-light)">
          <h3 style="color:var(--red)">Danger Zone</h3>
          <div class="settings-row">
            <div><div class="settings-label">Delete Property</div><div class="settings-desc">This will permanently remove the property, all devices, tenants, and documents. This action cannot be undone.</div></div>
            <button class="btn btn-danger btn-sm" onclick="deleteProperty(${pid})">Delete Property</button>
          </div>
        </div>`;
    }
  }catch(e){el.innerHTML='<div class="empty"><p>'+esc(e.message)+'</p></div>';}
}

/* ============ VIEW: agents ============ */
reg('agents',async()=>{
  try{
    const props=await api('/api/properties');
    let html=`<div class="view-head"><div><h2>Agents & Handovers</h2><div class="sub">Manage who has access to your properties.</div></div>`;
    if(state.user.role==='owner'&&props.properties.length)html+=`<button class="btn btn-primary" onclick="showHandover(${props.properties[0]?.id})">+ New Handover</button>`;
    html+=`</div>`;
    const d=await api('/api/activity?limit=30');
    const handoverLogs=d.activities.filter(a=>a.action.includes('handover')||a.action.includes('access'));
    if(handoverLogs.length){
      html+=`<div class="panel"><h3>Recent Handover Activity</h3><div class="timeline">`;
      handoverLogs.slice(0,15).forEach(l=>{
        html+=`<div class="tl-item"><div class="tl-time">${fmtDate(l.createdAt)}</div><div class="tl-text">${esc(l.detail)}</div></div>`;
      });
      html+=`</div></div>`;
    }else{
      html+=`<div class="panel"><div class="empty"><p>No handover activity yet. Invite an agent to get started.</p></div></div>`;
    }
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: devices ============ */
reg('devices',async()=>{
  try{
    const props=await api('/api/properties');
    let html=`<div class="view-head"><div><h2>Smart Devices</h2><div class="sub">Control all connected devices across your properties.</div></div></div>`;
    for(const p of props.properties){
      const d=await api('/api/devices?propertyId='+p.id);
      if(!d.devices.length)continue;
      html+=`<div class="panel"><h3>${esc(p.name)}</h3><div class="panel-grid">`;
      d.devices.forEach(dev=>{
        const statusColor=dev.status==='locked'||dev.status==='armed'||dev.status==='on'||dev.status==='recording'?'green':dev.status==='unlocked'||dev.status==='disarmed'?'amber':'red';
        html+=`<div class="dev-card">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div><div class="dev-name">${esc(dev.name)}</div><div class="dev-type">${esc(dev.type)} <span class="badge demol">DEMO</span></div></div>
            <span class="badge ${statusColor==='green'?'green':statusColor==='amber'?'amber':'red'}">${esc(dev.status)}</span>
          </div>
          <div class="dev-status"><span class="dot ${statusColor}"></span>${esc(dev.status)}</div>
          <div class="dev-actions">`;
        if(dev.type==='lock'){
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'lock',${p.id})">Lock</button>`;
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'unlock',${p.id})">Unlock</button>`;
        }else if(dev.type==='alarm'){
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'arm',${p.id})">Arm</button>`;
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'disarm',${p.id})">Disarm</button>`;
        }else{
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'on',${p.id})">On</button>`;
          html+=`<button class="btn btn-ghost btn-sm" onclick="deviceAction(${dev.id},'off',${p.id})">Off</button>`;
        }
        html+=`</div></div>`;
      });
      html+=`</div></div>`;
    }
    if(!html.includes('dev-card'))html+=`<div class="panel"><div class="empty"><p>No devices configured yet. Add devices to your properties.</p></div></div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: maintenance ============ */
reg('maintenance',async()=>{
  try{
    const d=await api('/api/maintenance');
    let html=`<div class="view-head"><div><h2>Maintenance</h2><div class="sub">Track and manage property maintenance.</div></div>`;
    html+=`<button class="btn btn-primary btn-sm" onclick="showNewMaint()">+ New Request</button></div>`;
    if(!d.requests.length){html+=`<div class="panel"><div class="empty"><p>No maintenance requests.</p></div></div>`;return html;}
    d.requests.forEach(r=>{
      html+=`<div class="maint-card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div class="maint-title">${esc(r.title)}</div>
          <span class="badge ${r.status==='open'?'amber':r.status==='completed'?'green':'blue'}">${r.status}</span>
        </div>
        <div class="maint-desc">${esc(r.description)}</div>
        <div class="maint-meta">
          <span class="badge ${r.priority==='high'?'red':r.priority==='medium'?'amber':'neutral'}">${r.priority}</span>
          <span>By ${esc(r.reportedBy?.name||'Unknown')}</span>
          <span>${fmtDate(r.createdAt)}</span>
        </div>
        ${state.user.role==='owner'&&r.status!=='completed'?`<div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="updateMaint(${r.id},'completed')">Mark Complete</button>
          <button class="btn btn-ghost btn-sm" onclick="updateMaint(${r.id},'in_progress')">In Progress</button>
        </div>`:''}
      </div>`;
    });
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: tenants ============ */
reg('tenants',async()=>{
  try{
    const props=await api('/api/properties');
    let html=`<div class="view-head"><div><h2>Tenants</h2><div class="sub">Manage tenant information.</div></div>`;
    if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showAddTenant()">+ Add Tenant</button>`;
    html+=`</div>`;
    let hasAny=false;
    for(const p of props.properties){
      const d=await api('/api/tenants?propertyId='+p.id);
      if(!d.tenants.length)continue;
      hasAny=true;
      html+=`<div class="panel"><h3>${esc(p.name)}</h3><table class="tbl"><thead><tr><th>Name</th><th>Unit</th><th>Contact</th><th>Rent</th><th>Tenancy</th></tr></thead><tbody>`;
      d.tenants.forEach(t=>{
        html+=`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.unit)}</td><td>${esc(t.email||t.phone||'—')}</td><td>${t.rent?'$'+t.rent.toLocaleString():'—'}</td><td>${shortDate(t.startDate)} — ${shortDate(t.endDate)||'Ongoing'}</td></tr>`;
      });
      html+=`</tbody></table></div>`;
    }
    if(!hasAny)html+=`<div class="panel"><div class="empty"><p>No tenants recorded.</p></div></div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: documents ============ */
reg('documents',async()=>{
  try{
    const props=await api('/api/properties');
    let html=`<div class="view-head"><div><h2>Documents</h2><div class="sub">Property documents, manuals, and records.</div></div>`;
    if(state.user.role==='owner')html+=`<button class="btn btn-primary btn-sm" onclick="showAddDoc()">+ Upload Document</button>`;
    html+=`</div>`;
    let hasAny=false;
    for(const p of props.properties){
      const d=await api('/api/documents?propertyId='+p.id);
      if(!d.documents.length)continue;
      hasAny=true;
      html+=`<div class="panel"><h3>${esc(p.name)}</h3>`;
      d.documents.forEach(doc=>{
        html+=`<div class="access-card"><div style="font-size:20px;margin-right:10px">📄</div><div class="access-info"><div class="access-name">${esc(doc.name)}</div><div class="access-detail">${esc(doc.category)} · ${fmtDate(doc.createdAt)}</div></div></div>`;
      });
      html+=`</div>`;
    }
    if(!hasAny)html+=`<div class="panel"><div class="empty"><p>No documents uploaded.</p></div></div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: activity ============ */
reg('activity',async()=>{
  try{
    const d=await api('/api/activity?limit=50');
    let html=`<div class="view-head"><div><h2>Activity Log</h2><div class="sub">Complete audit trail of all actions.</div></div></div>`;
    if(!d.activities.length){html+=`<div class="panel"><div class="empty"><p>No activity recorded yet.</p></div></div>`;return html;}
    html+=`<div class="panel"><div class="timeline">`;
    d.activities.forEach(l=>{
      html+=`<div class="tl-item"><div class="tl-time">${fmtDate(l.createdAt)}</div><div class="tl-text"><b>${esc(l.user?.name||'System')}</b> — ${esc(l.detail)}</div></div>`;
    });
    html+=`</div></div>`;
    return html;
  }catch(e){return '<div class="empty"><p>'+esc(e.message)+'</p></div>';}
});

/* ============ VIEW: assistant ============ */
reg('assistant',()=>{
  return `<div class="view-head"><div><h2>AI Assistant</h2><div class="sub">Ask questions about your properties, access, maintenance, and more.</div></div></div>
    <div class="chat-wrap"><div class="chat-messages" id="chat-msgs">
      <div class="chat-msg ai">Hello ${esc(state.user.name.split(' ')[0])}! I'm your HomePilot assistant. I can help you with property information, access management, maintenance, and more. What would you like to know?</div>
    </div>
    <div class="chat-input"><input id="chat-in" placeholder="Ask a question..." autocomplete="off"><button class="btn btn-primary" id="chat-send">Send</button></div></div>`;
});
_binders.assistant=function(){
  const input=$('#chat-in');const send=$('#chat-send');const msgs=$('#chat-msgs');
  async function ask(){
    const q=input.value.trim();if(!q)return;
    input.value='';
    msgs.innerHTML+=`<div class="chat-msg user">${esc(q)}</div>`;
    msgs.scrollTop=msgs.scrollHeight;
    send.disabled=true;
    try{
      const d=await api('/api/ai',{method:'POST',body:{message:q,propertyId:state.currentProperty?.id||null}});
      msgs.innerHTML+=`<div class="chat-msg ai">${esc(d.response).replace(/\n/g,'<br>')}</div>`;
      if(d.actions&&d.actions.length){
        d.actions.forEach(a=>{
          if(a.type==='navigate')msgs.innerHTML+=`<div class="chat-msg ai" style="cursor:pointer;color:var(--accent2)" onclick="goto('${a.target}')">→ Go to ${a.target}</div>`;
        });
      }
      msgs.scrollTop=msgs.scrollHeight;
    }catch(e){msgs.innerHTML+=`<div class="chat-msg ai" style="color:var(--red)">Error: ${esc(e.message)}</div>`;}
    send.disabled=false;input.focus();
  };
  send.onclick=ask;input.onkeydown=e=>{if(e.key==='Enter')ask();};
};

/* ============ actions ============ */
window.viewProperty=async function(id){
  state.current='property_detail';
  state.currentProperty={id};
  const html=await viewProperty(id);
  $('#main').innerHTML=html;$('#main').className='main fade-in';
  $$('.nav-item').forEach(b=>b.classList.remove('active'));
  $$('.mnav a').forEach(a=>a.classList.remove('active'));

  $$('#prop-tabs button').forEach(b=>b.onclick=()=>{
    $$('#prop-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
    renderPropertyTab(b.dataset.tab,id);
  });
  renderPropertyTab('overview',id);
};

window.deleteProperty=async function(id){
  if(!confirm('Are you absolutely sure? This will delete the property and ALL associated data permanently.'))return;
  if(!confirm('This is your LAST CHANCE. Delete?'))return;
  try{await api('/api/properties/'+id,{method:'DELETE'});toast('Property deleted.','ok');goto('properties');}catch(e){toast(e.message,'err');}
};

window.showEditProperty=function(id,field){
  const labels={name:'Property Name',address:'Address',desc:'Description'};
  const isTextarea=field==='desc';
  const inputHtml=isTextarea?`<textarea id="ep-val" rows="3"></textarea>`:`<input id="ep-val" type="text">`;
  openModal(`
    <h3>Edit ${labels[field]||field}</h3>
    <div class="field"><label>${labels[field]}</label>${inputHtml}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="ep-go">Save</button>
    </div>`);
  $('#ep-go').onclick=async()=>{
    const val=$('#ep-val').value;
    const body={};body[field==='desc'?'description':field]=val;
    try{await api('/api/properties/'+id,{method:'PUT',body});closeModal();toast('Updated.','ok');viewProperty(id);}catch(e){toast(e.message,'err');}
  };
};

window.showHandover=function(propId){
  openModal(`
    <h3>Handover Property</h3>
    <div class="field"><label>Property</label><select id="ho-prop">${state.properties.map(p=>`<option value="${p.id}" ${p.id===propId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Agent email</label><input id="ho-email" placeholder="agent@email.com"></div>
    <div class="field"><label>Role name</label><input id="ho-role" value="Property Manager" placeholder="e.g. Caretaker, Manager"></div>
    <div class="field"><label>Access expires (optional)</label><input id="ho-exp" type="datetime-local"></div>
    <div class="field"><label>Permissions</label>
      <div class="perm-grid">
        ${ALL_PERMISSIONS.map(p=>`<label class="perm-check"><input type="checkbox" value="${p}" ${['property.view','maintenance.view','maintenance.create','device.view','document.view','access.view'].includes(p)?'checked':''}>${p}</label>`).join('')}
      </div>
    </div>
    <div class="errbox" id="ho-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="ho-go">Create Handover</button>
    </div>`);
  $('#ho-go').onclick=async()=>{
    const btn=$('#ho-go');btn.disabled=true;btn.textContent='Creating…';
    try{
      const perms=[];$$('#ho-err').parentElement.querySelectorAll('.perm-check input:checked').forEach(cb=>perms.push(cb.value));
      const expires=$('#ho-exp').value?new Date($('#ho-exp').value).toISOString():null;
      await api('/api/handover',{method:'POST',body:{propertyId:Number($('#ho-prop').value),agentEmail:$('#ho-email').value,roleName:$('#ho-role').value,permissions:perms,expiresAt:expires}});
      closeModal();toast('Handover created!','ok');
    }catch(e){$('#ho-err').textContent=e.message;$('#ho-err').classList.add('show');}
    finally{btn.disabled=false;btn.textContent='Create Handover';}
  };
};
const ALL_PERMISSIONS=['property.view','property.edit','access.view','access.request','access.manage','device.view','device.control','device.manage','maintenance.view','maintenance.create','maintenance.manage','tenant.view','tenant.manage','document.view','document.upload','agent.invite','agent.remove','property.manage'];

window.revokeAccess=async function(userId,propId){
  if(!confirm('Revoke this agent\'s access immediately?'))return;
  try{await api('/api/access/revoke',{method:'POST',body:{userId,propertyId:propId}});toast('Access revoked.','ok');viewProperty(propId);}catch(e){toast(e.message,'err');}
};

window.deviceAction=async function(devId,action,propId){
  try{await api('/api/devices/'+devId+'/action',{method:'POST',body:{action}});toast(action+' executed','ok');
    if(propId){renderPropertyTab('devices',propId);}
    else{goto('devices');}
  }catch(e){toast(e.message,'err');}
};

window.showNewMaint=function(propId){
  openModal(`
    <h3>New Maintenance Request</h3>
    ${!propId?`<div class="field"><label>Property</label><select id="nm-prop">${state.properties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
    <div class="field"><label>Title</label><input id="nm-title" placeholder="e.g. Kitchen AC not cooling"></div>
    <div class="field"><label>Description</label><textarea id="nm-desc" rows="3" placeholder="Describe the issue..."></textarea></div>
    <div class="field"><label>Priority</label><select id="nm-pri"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
    <div class="errbox" id="nm-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="nm-go">Submit</button>
    </div>`);
  $('#nm-go').onclick=async()=>{
    const btn=$('#nm-go');btn.disabled=true;
    try{
      const pid=propId||Number($('#nm-prop').value);
      await api('/api/maintenance',{method:'POST',body:{propertyId:pid,title:$('#nm-title').value,description:$('#nm-desc').value,priority:$('#nm-pri').value}});
      closeModal();toast('Maintenance request submitted.','ok');goto('maintenance');
    }catch(e){$('#nm-err').textContent=e.message;$('#nm-err').classList.add('show');}
    finally{btn.disabled=false;}
  };
};

window.updateMaint=async function(id,status,propId){
  try{await api('/api/maintenance/'+id,{method:'PUT',body:{status}});toast('Updated.','ok');
    if(propId){renderPropertyTab('maintenance',propId);}else{goto('maintenance');}
  }catch(e){toast(e.message,'err');}
};

window.showAddDevice=function(propId){
  openModal(`
    <h3>Add Device</h3>
    <div class="field"><label>Device name</label><input id="ad-name" placeholder="Front Door Lock"></div>
    <div class="field"><label>Type</label><select id="ad-type"><option value="lock">Smart Lock</option><option value="camera">Camera</option><option value="light">Light</option><option value="alarm">Alarm</option><option value="thermostat">Thermostat</option><option value="gate">Gate</option><option value="garage">Garage</option><option value="sensor">Sensor</option></select></div>
    <div class="field"><label>Location</label><input id="ad-loc" placeholder="e.g. Front entrance"></div>
    <div class="errbox" id="ad-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="ad-go">Add Device</button>
    </div>`);
  $('#ad-go').onclick=async()=>{
    try{
      await api('/api/devices',{method:'POST',body:{propertyId:propId,name:$('#ad-name').value,type:$('#ad-type').value,location:$('#ad-loc').value}});
      closeModal();toast('Device added.','ok');renderPropertyTab('devices',propId);
    }catch(e){$('#ad-err').textContent=e.message;$('#ad-err').classList.add('show');}
  };
};

window.showAddTenant=function(propId){
  openModal(`
    <h3>Add Tenant</h3>
    ${!propId?`<div class="field"><label>Property</label><select id="at-prop">${state.properties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
    <div class="form-grid">
      <div class="field"><label>Name</label><input id="at-name" required></div>
      <div class="field"><label>Unit</label><input id="at-unit" placeholder="e.g. Apt 4B"></div>
      <div class="field"><label>Email</label><input id="at-email" type="email"></div>
      <div class="field"><label>Phone</label><input id="at-phone"></div>
      <div class="field"><label>Monthly rent</label><input id="at-rent" type="number" min="0"></div>
      <div class="field"><label>Lease end</label><input id="at-end" type="date"></div>
    </div>
    <div class="field"><label>Emergency contact</label><input id="at-emerg" placeholder="Name and phone"></div>
    <div class="errbox" id="at-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="at-go">Add Tenant</button>
    </div>`);
  $('#at-go').onclick=async()=>{
    try{
      const pid=propId||Number($('#at-prop').value);
      await api('/api/tenants',{method:'POST',body:{propertyId:pid,name:$('#at-name').value,unit:$('#at-unit').value,email:$('#at-email').value,phone:$('#at-phone').value,rent:Number($('#at-rent').value||0),endDate:$('#at-end').value||null,emergencyContact:$('#at-emerg').value}});
      closeModal();toast('Tenant added.','ok');
      if(propId){viewProperty(propId);}else{goto('tenants');}
    }catch(e){$('#at-err').textContent=e.message;$('#at-err').classList.add('show');}
  };
};

window.showAddDoc=function(propId){
  openModal(`
    <h3>Upload Document</h3>
    ${!propId?`<div class="field"><label>Property</label><select id="ad2-prop">${state.properties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>`:''}
    <div class="field"><label>Document name</label><input id="ad2-name" placeholder="Floor plan"></div>
    <div class="field"><label>Category</label><select id="ad2-cat"><option value="general">General</option><option value="floor_plan">Floor Plan</option><option value="manual">Appliance Manual</option><option value="warranty">Warranty</option><option value="maintenance">Maintenance Record</option><option value="tenancy">Tenancy Agreement</option><option value="emergency">Emergency Instructions</option></select></div>
    <div class="field"><label>URL or file reference</label><input id="ad2-url" placeholder="https://..."></div>
    <div class="errbox" id="ad2-err"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="ad2-go">Upload</button>
    </div>`);
  $('#ad2-go').onclick=async()=>{
    try{
      const pid=propId||Number($('#ad2-prop').value);
      await api('/api/documents',{method:'POST',body:{propertyId:pid,name:$('#ad2-name').value,category:$('#ad2-cat').value,url:$('#ad2-url').value}});
      closeModal();toast('Document uploaded.','ok');
      if(propId){renderPropertyTab('documents',propId);}else{goto('documents');}
    }catch(e){$('#ad2-err').textContent=e.message;$('#ad2-err').classList.add('show');}
  };
};

window.showAddEmergency=function(propId){
  openModal(`
    <h3>Add Emergency Contact</h3>
    <div class="form-grid">
      <div class="field"><label>Name</label><input id="aec-name" required></div>
      <div class="field"><label>Role</label><input id="aec-role" placeholder="Plumber, Electrician..."></div>
      <div class="field"><label>Phone</label><input id="aec-phone"></div>
      <div class="field"><label>Email</label><input id="aec-email" type="email"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="aec-go">Add Contact</button>
    </div>`);
  $('#aec-go').onclick=async()=>{
    try{
      await api('/api/emergency-contacts',{method:'POST',body:{propertyId:propId,name:$('#aec-name').value,role:$('#aec-role').value,phone:$('#aec-phone').value,email:$('#aec-email').value}});
      closeModal();toast('Contact added.','ok');viewProperty(propId);
    }catch(e){toast(e.message,'err');}
  };
};

/* ============ modal & global ============ */
function openModal(html){$('#modal').innerHTML=html;$('#modal-back').classList.add('show');}
function closeModal(){$('#modal-back').classList.remove('show');$('#modal').innerHTML='';}

function bindGlobal(){
  $$('.nav-item[data-view]').forEach(b=>b.onclick=()=>goto(b.dataset.view));
  $$('.mnav a[data-view]').forEach(a=>{a.onclick=e=>{e.preventDefault();goto(a.dataset.view);}});
  $('#logout-btn').onclick=async()=>{await api('/api/auth/logout',{method:'POST'}).catch(()=>{});state.user=null;showAuth();$('#form-login').reset();$('#form-register').reset();};
  $('#modal-back').addEventListener('click',e=>{if(e.target===$('#modal-back'))closeModal();});
  // Notification bell
  const bell=$('#notif-bell');
  if(bell)bell.onclick=()=>{openModal(`<h3>Notifications</h3><div id="notif-list" style="max-height:400px;overflow-y:auto"><div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div></div>`);loadNotificationsModal();};
}

/* ============ notifications ============ */
async function pollNotifications(){
  if(!state.user)return;
  try{const d=await api('/api/notifications');state.notifCount=d.unread;updateNotifBadge();}catch(e){}
}
function updateNotifBadge(){
  const badge=$('#notif-count');if(!badge)return;
  if(state.notifCount>0){badge.textContent=state.notifCount>99?'99+':state.notifCount;badge.style.display='';}
  else{badge.style.display='none';}
}
async function loadNotificationsModal(){
  const el=$('#notif-list');if(!el)return;
  try{
    const d=await api('/api/notifications');
    if(!d.notifications.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text-muted)">No notifications yet.</div>';return;}
    el.innerHTML=d.notifications.map(n=>`
      <div style="padding:12px 0;border-bottom:1px solid var(--border-light);${n.read?'opacity:0.6':''}">
        <div style="font-size:13px;font-weight:${n.read?'400':'600'}">${esc(n.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(n.body)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${timeAgo(n.createdAt)}</div>
      </div>`).join('');
    await api('/api/notifications/read',{method:'POST',body:{}});state.notifCount=0;updateNotifBadge();
  }catch(e){el.innerHTML='<div style="color:var(--red);padding:12px">'+esc(e.message)+'</div>';}
}

/* ============ keyboard shortcuts ============ */
function bindKeyboard(){
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeModal();}
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.key==='d')goto('dashboard');
    if(e.key==='p')goto('properties');
    if(e.key==='g')goto('devices');
    if(e.key==='m')goto('maintenance');
    if(e.key==='a')goto('assistant');
    if(e.key==='n'){const bell=$('#notif-bell');if(bell)bell.click();}
  });
}

/* ============ bg canvas ============ */
function initBg(){
  const cv=$('#bg-canvas');const ctx=cv.getContext('2d');let w,h;
  const resize=()=>{w=cv.width=innerWidth;h=cv.height=innerHeight;};resize();addEventListener('resize',resize);
  const pts=Array.from({length:30},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-0.5)*0.0003,vy:(Math.random()-0.5)*0.0003,r:Math.random()*1.5+0.5}));
  function draw(){ctx.clearRect(0,0,w,h);for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>1)p.vx*=-1;if(p.y<0||p.y>1)p.vy*=-1;const a=0.08+0.06*Math.sin(Date.now()/2000+p.x*10);ctx.fillStyle='rgba(26,26,46,'+a+')';ctx.beginPath();ctx.arc(p.x*w,p.y*h,p.r,0,Math.PI*2);ctx.fill();}requestAnimationFrame(draw);}
  draw();
}

/* ============ boot ============ */
(async function boot(){
  initBg();bindAuth();bindGlobal();bindKeyboard();
  try{await enter();pollNotifications();setInterval(pollNotifications,30000);}
  catch(e){if(e.status===401){showAuth();}else{showAuth();toast(e.message,'err');}}
})();
