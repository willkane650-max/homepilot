#!/usr/bin/env node
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'homepilot-data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 5000);

const CYAN='\x1b[36m',GREEN='\x1b[32m',RED='\x1b[31m',AMBER='\x1b[33m',BOLD='\x1b[1m',DIM='\x1b[2m',RST='\x1b[0m';
function log(l,m){const t=new Date().toISOString().slice(11,19);const c=l==='ok'?GREEN:l==='err'?RED:l==='warn'?AMBER:CYAN;console.log(`${DIM}[${t}]${RST} ${c}${BOLD}${l.toUpperCase()}${RST} ${m}`);}

/* ============ helpers ============ */
function nowISO(){return new Date().toISOString();}
function hashPassword(p,s){return crypto.createHash('sha256').update(p+':'+s).digest('hex');}
function randHex(n){return crypto.randomBytes(n).toString('hex');}
function uuid(){return randHex(4)+'-'+randHex(2)+'-'+randHex(2)+'-'+randHex(2)+'-'+randHex(6);}

/* ============ database ============ */
function freshDB(){
  return {
    users:[],sessions:{},properties:[],propertyMembers:[],roles:[],permissions:[],
    agentInvitations:[],accessGrants:[],devices:[],devicePermissions:[],
    maintenanceRequests:[],tenants:[],documents:[],activityLog:[],notifications:[],
    emergencyContacts:[],handovers:[],
    nextId:{user:1,property:1,member:1,invitation:1,accessGrant:1,device:1,maintenance:1,tenant:1,document:1,activity:1,notification:1,emergency:1,handover:1}
  };
}

let db=null;
function load(){
  if(db)return db;
  if(!fs.existsSync(DATA_FILE)){db=freshDB();save();log('ok','Created empty database');}
  else{try{db=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));}catch(e){log('err','Corrupt data: '+e.message);process.exit(1);}
    if(!db.nextId)db.nextId={user:1,property:1,member:1,invitation:1,accessGrant:1,device:1,maintenance:1,tenant:1,document:1,activity:1,notification:1,emergency:1,handover:1};}
  return db;
}
function save(){const t=DATA_FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(db,null,2),'utf8');fs.renameSync(t,DATA_FILE);}
function nid(k){const d=load();const id=d.nextId[k]||1;d.nextId[k]=id+1;return id;}

/* ============ permissions ============ */
const ALL_PERMISSIONS = [
  'property.view','property.edit',
  'access.view','access.request','access.manage',
  'device.view','device.control','device.manage',
  'maintenance.view','maintenance.create','maintenance.manage',
  'tenant.view','tenant.manage',
  'document.view','document.upload',
  'agent.invite','agent.remove','property.manage'
];

function defaultAgentPermissions(){
  return ['property.view','maintenance.view','maintenance.create','device.view','document.view','access.view'];
}

/* ============ auth ============ */
function createSession(userId){
  const token=randHex(32);
  db.sessions[token]={userId,createdAt:nowISO(),expiresAt:new Date(Date.now()+7*86400000).toISOString()};
  save();return token;
}
function getUser(req){
  const c=(req.headers.cookie||'').match(/hp_session=([a-f0-9]+)/);
  if(!c)return null;
  const s=db.sessions[c[1]];
  if(!s)return null;
  if(new Date(s.expiresAt)<new Date()){delete db.sessions[c[1]];save();return null;}
  return db.users.find(u=>u.id===s.userId)||null;
}

/* ============ api helpers ============ */
function parseBody(req){return new Promise((res,rej)=>{let d='';req.on('data',c=>{d+=c;if(d.length>5e6)req.destroy();});req.on('end',()=>{try{res(d?JSON.parse(d):{});}catch(e){rej(e);}});req.on('error',rej);});}
function json(res,data,code=200){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}
function fail(res,code,msg){json(res,{error:msg},code);}
function ok(res,data){json(res,data||{ok:true});}

function logActivity(d,userId,action,propertyId,detail,resourceType,resourceId){
  db.activityLog.push({id:nid('activity'),userId,action,propertyId:propertyId||null,detail,resourceType:resourceType||null,resourceId:resourceId||null,createdAt:nowISO()});
}
function addNotification(d,userId,type,title,body,propertyId){
  db.notifications.push({id:nid('notification'),userId,type,title,body,propertyId:propertyId||null,read:false,createdAt:nowISO()});
}
function hasPermission(user,propertyId,perm){
  if(user.role==='owner')return true;
  const member=db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===propertyId);
  if(!member)return false;
  const role=db.roles.find(r=>r.id===member.roleId);
  if(!role)return false;
  if(role.permissions.includes(perm))return true;
  return false;
}
function checkAccess(user,propertyId){
  if(user.role==='owner')return true;
  const grant=db.accessGrants.find(g=>g.userId===user.id&&g.propertyId===propertyId&&g.status==='active');
  if(!grant)return false;
  if(grant.expiresAt&&new Date(grant.expiresAt)<new Date()){
    grant.status='expired';save();return false;
  }
  return true;
}

/* ============ static files ============ */
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function serveFile(res,fp){
  fs.readFile(fp,(e,d)=>{
    if(e){res.writeHead(404);res.end('Not found');return;}
    const ext=path.extname(fp);
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});
    res.end(d);
  });
}

/* ============ router ============ */
async function handleAPI(req,res){
  const url=new URL(req.url,'http://'+req.headers.host);
  const p=url.pathname;
  const method=req.method;

  try{
    // Auth
    if(p==='/api/auth/register'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.email||!b.password||!b.name)return fail(res,400,'Name, email, password required');
      if(db.users.find(u=>u.email===b.email.toLowerCase()))return fail(res,400,'Email already registered');
      const salt=randHex(16);
      const user={id:nid('user'),email:b.email.toLowerCase(),name:b.name,phone:b.phone||'',passwordHash:hashPassword(b.password,salt),salt,role:'owner',createdAt:nowISO(),avatar:null};
      db.users.push(user);save();
      const token=createSession(user.id);
      res.setHeader('Set-Cookie',`hp_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
      return ok(res,{user:{id:user.id,email:user.email,name:user.name,role:user.role}});
    }
    if(p==='/api/auth/login'&&method==='POST'){
      const b=await parseBody(req);
      const user=db.users.find(u=>u.email===(b.email||'').toLowerCase());
      if(!user||user.passwordHash!==hashPassword(b.password,user.salt))return fail(res,401,'Invalid credentials');
      const token=createSession(user.id);
      res.setHeader('Set-Cookie',`hp_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
      return ok(res,{user:{id:user.id,email:user.email,name:user.name,role:user.role}});
    }
    if(p==='/api/auth/logout'&&method==='POST'){
      const c=(req.headers.cookie||'').match(/hp_session=([a-f0-9]+)/);
      if(c)delete db.sessions[c[1]];save();
      res.setHeader('Set-Cookie','hp_session=; Path=/; HttpOnly; Max-Age=0');
      return ok(res);
    }
    if(p==='/api/auth/me'){
      const user=getUser(req);
      if(!user)return fail(res,401,'Not authenticated');
      return ok(res,{user:{id:user.id,email:user.email,name:user.name,role:user.role,phone:user.phone}});
    }

    // All other routes need auth
    const user=getUser(req);
    if(!user)return fail(res,401,'Not authenticated');

    // Users
    if(p==='/api/users'&&method==='GET'){
      return ok(res,{users:db.users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role}))});
    }

    // Properties
    if(p==='/api/properties'&&method==='GET'){
      const owned=db.properties.filter(pr=>pr.ownerId===user.id);
      const memberOf=db.propertyMembers.filter(m=>m.userId===user.id).map(m=>db.properties.find(p2=>p2.id===m.propertyId)).filter(Boolean);
      const all=[...owned,...memberOf.filter(m=>!owned.find(o=>o.id===m.id))];
      const enriched=all.map(p2=>{
        const devCount=db.devices.filter(d2=>d2.propertyId===p2.id).length;
        const agentCount=db.propertyMembers.filter(m=>m.propertyId===p2.id).length;
        const openMaint=db.maintenanceRequests.filter(m=>m.propertyId===p2.id&&m.status==='open').length;
        return {...p2,deviceCount:devCount,agentCount:agentCount,openMaintenance:openMaint};
      });
      return ok(res,{properties:enriched});
    }
    if(p==='/api/properties'&&method==='POST'){
      if(user.role!=='owner')return fail(res,403,'Only owners can create properties');
      const b=await parseBody(req);
      if(!b.name)return fail(res,400,'Property name required');
      const prop={id:nid('property'),ownerId:user.id,name:b.name,address:b.address||'',city:b.city||'',state:b.state||'',country:b.country||'',zipCode:b.zipCode||'',type:b.type||'residential',bedrooms:b.bedrooms||0,bathrooms:b.bathrooms||0,description:b.description||'',createdAt:nowISO()};
      db.properties.push(prop);save();
      logActivity(db,user.id,'property.created',prop.id,'Created property: '+prop.name);
      return ok(res,{property:prop});
    }

    // Property by id
    const propMatch=p.match(/^\/api\/properties\/(\d+)$/);
    if(propMatch&&method==='GET'){
      const prop=db.properties.find(pr=>pr.id===Number(propMatch[1]));
      if(!prop)return fail(res,404,'Property not found');
      if(prop.ownerId!==user.id&&!db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===prop.id))return fail(res,403,'Access denied');
      const devices=db.devices.filter(d2=>d2.propertyId===prop.id);
      const members=db.propertyMembers.filter(m=>m.propertyId===prop.id).map(m=>{const u=db.users.find(u2=>u2.id===m.userId);const r=db.roles.find(r2=>r2.id===m.roleId);return{user:u?{id:u.id,name:u.name,email:u.email}:null,role:r?r.name:'Unknown',permissions:r?r.permissions:[]};});
      const maintenance=db.maintenanceRequests.filter(m=>m.propertyId===prop.id);
      const tenants=db.tenants.filter(t=>t.propertyId===prop.id);
      const docs=db.documents.filter(d2=>d2.propertyId===prop.id);
      const grants=db.accessGrants.filter(g=>g.propertyId===prop.id&&g.status==='active');
      const contacts=db.emergencyContacts.filter(c2=>c2.propertyId===prop.id);
      return ok(res,{property:prop,devices,members,maintenance,tenants,documents:docs,accessGrants:grants.map(g=>{const u=db.users.find(u2=>u2.id===g.userId);return{...g,user:u?{name:u.name,email:u.email}:null};}),emergencyContacts:contacts});
    }
    if(propMatch&&method==='PUT'){
      const prop=db.properties.find(pr=>pr.id===Number(propMatch[1]));
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const b=await parseBody(req);
      Object.assign(prop,{name:b.name||prop.name,address:b.address||prop.address,city:b.city||prop.city,state:b.state||prop.state,country:b.country||prop.country,zipCode:b.zipCode||prop.zipCode,type:b.type||prop.type,bedrooms:b.bedrooms!=null?b.bedrooms:prop.bedrooms,bathrooms:b.bathrooms!=null?b.bathrooms:prop.bathrooms,description:b.description!=null?b.description:prop.description});
      save();return ok(res,{property:prop});
    }

    // Devices
    if(p==='/api/devices'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      const devs=propId?db.devices.filter(d2=>d2.propertyId===propId):db.devices;
      return ok(res,{devices:devs});
    }
    if(p==='/api/devices'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.propertyId||!b.name||!b.type)return fail(res,400,'propertyId, name, type required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const dev={id:nid('device'),propertyId:b.propertyId,name:b.name,type:b.type,location:b.location||'',provider:'simulated',status:b.type==='lock'?'locked':b.type==='alarm'?'armed':'on',lastAction:null,lastActionAt:null,createdAt:nowISO()};
      db.devices.push(dev);save();
      logActivity(db,user.id,'device.added',prop.id,'Added device: '+dev.name,'device',dev.id);
      return ok(res,{device:dev});
    }
    const devMatch=p.match(/^\/api\/devices\/(\d+)\/action$/);
    if(devMatch&&method==='POST'){
      const b=await parseBody(req);
      const dev=db.devices.find(d2=>d2.id===Number(devMatch[1]));
      if(!dev)return fail(res,404,'Device not found');
      const prop=db.properties.find(pr=>pr.id===dev.propertyId);
      if(prop.ownerId!==user.id&&!db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===prop.id))return fail(res,403,'Access denied');
      if(prop.ownerId!==user.id&&!hasPermission(user,prop.id,'device.control'))return fail(res,403,'No permission to control devices');
      const action=b.action;
      if(dev.type==='lock'){
        dev.status=action==='lock'?'locked':'unlocked';
      }else if(dev.type==='alarm'){
        dev.status=action==='arm'?'armed':action==='disarm'?'disarmed':'triggered';
      }else if(dev.type==='camera'){
        dev.status=action==='on'?'on':action==='off'?'off':'recording';
      }else if(dev.type==='light'){
        dev.status=action==='on'?'on':'off';
      }else if(dev.type==='thermostat'){
        dev.status='set:'+b.temperature;
      }else{
        dev.status=action;
      }
      dev.lastAction=action;dev.lastActionAt=nowISO();save();
      logActivity(db,user.id,dev.type+'.'+action,prop.id,dev.name+' → '+dev.status,'device',dev.id);
      return ok(res,{device:dev});
    }

    // Handover
    if(p==='/api/handover'&&method==='POST'){
      if(user.role!=='owner')return fail(res,403,'Only owners can create handovers');
      const b=await parseBody(req);
      if(!b.propertyId||!b.agentEmail||!b.roleName)return fail(res,400,'Missing required fields');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const agent=db.users.find(u=>u.email===b.agentEmail.toLowerCase());
      if(!agent)return fail(res,404,'Agent not found. They must register first.');
      if(agent.id===user.id)return fail(res,400,'Cannot handover to yourself');
      const existingMember=db.propertyMembers.find(m=>m.userId===agent.id&&m.propertyId===prop.id);
      if(existingMember)return fail(res,400,'Agent already has access');
      const roleName=b.roleName||'Property Manager';
      const perms=b.permissions||defaultAgentPermissions();
      let role=db.roles.find(r=>r.name===roleName&&r.ownerId===user.id);
      if(!role){
        role={id:nid('role'),name:roleName,ownerId:user.id,permissions:perms,createdAt:nowISO()};
        db.roles.push(role);
      }
      const grant={id:nid('accessGrant'),userId:agent.id,propertyId:prop.id,roleId:role.id,status:'active',createdAt:nowISO(),expiresAt:b.expiresAt||null};
      db.accessGrants.push(grant);
      const member={id:nid('member'),userId:agent.id,propertyId:prop.id,roleId:role.id,invitedBy:user.id,createdAt:nowISO()};
      db.propertyMembers.push(member);
      logActivity(db,user.id,'handover.created',prop.id,`Handed property to ${agent.name} (${roleName})`);
      addNotification(db,agent.id,'handover','New Property Access',`You have been given access to ${prop.name} as ${roleName}`,prop.id);
      addNotification(db,user.id,'handover','Handover Complete',`${agent.name} now has access to ${prop.name}`,prop.id);
      save();
      return ok(res,{handover:grant,role});
    }

    // Revoke access
    if(p.match(/^\/api\/access\/revoke$/)&&method==='POST'){
      if(user.role!=='owner')return fail(res,403,'Not authorized');
      const b=await parseBody(req);
      if(!b.userId||!b.propertyId)return fail(res,400,'userId and propertyId required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const grant=db.accessGrants.find(g=>g.userId===b.userId&&g.propertyId===b.propertyId&&g.status==='active');
      if(grant){grant.status='revoked';}
      db.propertyMembers=db.propertyMembers.filter(m=>!(m.userId===b.userId&&m.propertyId===b.propertyId));
      const agent=db.users.find(u=>u.id===b.userId);
      if(agent){
        addNotification(db,agent.id,'access_revoked','Access Revoked',`Your access to ${prop.name} has been revoked`,prop.id);
        logActivity(db,user.id,'access.revoked',prop.id,`Revoked access for ${agent.name}`);
      }
      save();return ok(res);
    }

    // Suspend access
    if(p.match(/^\/api\/access\/suspend$/)&&method==='POST'){
      if(user.role!=='owner')return fail(res,403,'Not authorized');
      const b=await parseBody(req);
      const grant=db.accessGrants.find(g=>g.userId===b.userId&&g.propertyId===b.propertyId&&g.status==='active');
      if(grant){grant.status='suspended';save();}
      return ok(res);
    }

    // Maintenance
    if(p==='/api/maintenance'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      let reqs=propId?db.maintenanceRequests.filter(m=>m.propertyId===propId):db.maintenanceRequests;
      if(user.role!=='owner'){
        reqs=reqs.filter(m=>db.propertyMembers.find(pm=>pm.userId===user.id&&pm.propertyId===m.propertyId));
      }
      return ok(res,{requests:reqs.map(m=>{const u=db.users.find(u2=>u2.id===m.reportedById);return{...m,reportedBy:u?{name:u.name,email:u.email}:null};})});
    }
    if(p==='/api/maintenance'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.propertyId||!b.title)return fail(res,400,'propertyId and title required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop)return fail(res,404,'Property not found');
      const req2={id:nid('maintenance'),propertyId:b.propertyId,title:b.title,description:b.description||'',priority:b.priority||'medium',status:'open',reportedById:user.id,assignedTo:null,notes:[],createdAt:nowISO(),updatedAt:nowISO()};
      db.maintenanceRequests.push(req2);save();
      logActivity(db,user.id,'maintenance.created',prop.id,'Maintenance: '+b.title,'maintenance',req2.id);
      if(prop.ownerId!==user.id){
        addNotification(db,prop.ownerId,'maintenance','New Maintenance Request',`${user.name} reported: ${b.title}`,prop.id);
      }
      return ok(res,{request:req2});
    }
    const maintMatch=p.match(/^\/api\/maintenance\/(\d+)$/);
    if(maintMatch&&method==='PUT'){
      const b=await parseBody(req);
      const req2=db.maintenanceRequests.find(m=>m.id===Number(maintMatch[1]));
      if(!req2)return fail(res,404,'Not found');
      const prop=db.properties.find(pr=>pr.id===req2.propertyId);
      if(prop.ownerId!==user.id&&!db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===prop.id))return fail(res,403,'Not authorized');
      if(b.status)req2.status=b.status;
      if(b.priority)req2.priority=b.priority;
      if(b.assignedTo!=null)req2.assignedTo=b.assignedTo;
      if(b.note){req2.notes.push({text:b.note,by:user.id,at:nowISO()});}
      req2.updatedAt=nowISO();save();
      logActivity(db,user.id,'maintenance.updated',prop.id,`Maintenance "${req2.title}" → ${req2.status}`);
      return ok(res,{request:req2});
    }

    // Tenants
    if(p==='/api/tenants'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      const tenants=propId?db.tenants.filter(t=>t.propertyId===propId):db.tenants;
      return ok(res,{tenants});
    }
    if(p==='/api/tenants'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.propertyId||!b.name)return fail(res,400,'propertyId and name required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const tenant={id:nid('tenant'),propertyId:b.propertyId,name:b.name,email:b.email||'',phone:b.phone||'',unit:b.unit||'',startDate:b.startDate||null,endDate:b.endDate||null,rent:b.rent||0,emergencyContact:b.emergencyContact||'',notes:b.notes||'',createdAt:nowISO()};
      db.tenants.push(tenant);save();
      logActivity(db,user.id,'tenant.added',prop.id,'Added tenant: '+b.name);
      return ok(res,{tenant});
    }

    // Documents
    if(p==='/api/documents'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      let docs=propId?db.documents.filter(d2=>d2.propertyId===propId):db.documents;
      if(user.role!=='owner'){
        docs=docs.filter(d2=>{
          if(d2.allowedUsers&&d2.allowedUsers.length>0)return d2.allowedUsers.includes(user.id);
          return db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===d2.propertyId);
        });
      }
      return ok(res,{documents:docs});
    }
    if(p==='/api/documents'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.propertyId||!b.name)return fail(res,400,'propertyId and name required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const doc={id:nid('document'),propertyId:b.propertyId,name:b.name,type:b.type||'other',category:b.category||'general',url:b.url||'',allowedUsers:b.allowedUsers||[],uploadedBy:user.id,createdAt:nowISO()};
      db.documents.push(doc);save();
      return ok(res,{document:doc});
    }

    // Emergency contacts
    if(p==='/api/emergency-contacts'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      const contacts=propId?db.emergencyContacts.filter(c2=>c2.propertyId===propId):db.emergencyContacts;
      return ok(res,{contacts});
    }
    if(p==='/api/emergency-contacts'&&method==='POST'){
      const b=await parseBody(req);
      if(!b.propertyId||!b.name)return fail(res,400,'propertyId and name required');
      const prop=db.properties.find(pr=>pr.id===b.propertyId);
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      const contact={id:nid('emergency'),propertyId:b.propertyId,name:b.name,role:b.role||'',phone:b.phone||'',email:b.email||'',isDefault:b.isDefault||false,createdAt:nowISO()};
      db.emergencyContacts.push(contact);save();
      return ok(res,{contact});
    }

    // Notifications
    if(p==='/api/notifications'&&method==='GET'){
      const notes=db.notifications.filter(n=>n.userId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return ok(res,{notifications:notes,unread:notes.filter(n=>!n.read).length});
    }
    if(p==='/api/notifications/read'&&method==='POST'){
      const b=await parseBody(req);
      if(b.id){
        const n=db.notifications.find(n2=>n2.id===b.id&&n2.userId===user.id);
        if(n)n.read=true;
      }else{
        db.notifications.filter(n=>n.userId===user.id).forEach(n=>n.read=true);
      }
      save();return ok(res);
    }

    // Activity log
    if(p==='/api/activity'&&method==='GET'){
      const propId=Number(url.searchParams.get('propertyId'));
      let logs=propId?db.activityLog.filter(l=>l.propertyId===propId):db.activityLog;
      if(user.role!=='owner'){
        logs=logs.filter(l=>db.propertyMembers.find(m=>m.userId===user.id&&m.propertyId===l.propertyId));
      }
      logs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      const enriched=logs.map(l=>{const u=db.users.find(u2=>u2.id===l.userId);return{...l,user:u?{name:u.name}:null};});
      return ok(res,{activities:enriched.slice(0,Number(url.searchParams.get('limit'))||100)});
    }

    // AI Assistant
    if(p==='/api/ai'&&method==='POST'){
      const b=await parseBody(req);
      const q=(b.message||'').toLowerCase().trim();
      let response='';
      let actions=[];

      if(q.includes('access')&&(q.includes('who')||q.includes('have'))){
        const propId=b.propertyId;
        if(propId){
          const grants=db.accessGrants.filter(g=>g.propertyId===propId&&g.status==='active');
          const names=grants.map(g=>{const u=db.users.find(u2=>u2.id===g.userId);return u?u.name:'Unknown';});
          response=names.length?`Currently ${names.length} people have access: ${names.join(', ')}.`:'No one currently has active access to this property.';
        }else{
          const total=db.accessGrants.filter(g=>g.status==='active').length;
          response=`You have ${total} active access grant${total!==1?'s':''} across all properties.`;
        }
      }else if(q.includes('maintenance')&&(q.includes('open')||q.includes('issue')||q.includes('problem'))){
        const propId=b.propertyId;
        const reqs=propId?db.maintenanceRequests.filter(m=>m.propertyId===propId&&m.status==='open'):db.maintenanceRequests.filter(m=>m.status==='open');
        response=reqs.length?`There ${reqs.length===1?'is':'are'} ${reqs.length} open maintenance request${reqs.length!==1?'s':''}. ${reqs.map(r=>`• "${r.title}" (${r.priority})`).join(' ')}`:'No open maintenance requests.';
      }else if(q.includes('unlock')){
        response='To unlock a door, go to the Devices section and use the unlock action. This will be logged in the activity feed. Do you want me to unlock a specific device?';
        actions.push({type:'navigate',target:'devices'});
      }else if(q.includes('report')&&q.includes('issue')){
        response='You can report an issue from the Maintenance section. Click "Create Request" to submit a new maintenance issue.';
        actions.push({type:'navigate',target:'maintenance'});
      }else if(q.includes('task')||q.includes('outstanding')){
        const myMaint=db.maintenanceRequests.filter(m=>m.reportedById===user.id&&m.status!=='completed');
        response=myMaint.length?`You have ${myMaint.length} outstanding task${myMaint.length!==1?'s':''}. ${myMaint.map(r=>`• "${r.title}" (${r.status})`).join(' ')}`:'No outstanding tasks.';
      }else if(q.includes('emergency')||q.includes('plumber')||q.includes('electrician')){
        const propId=b.propertyId;
        const contacts=propId?db.emergencyContacts.filter(c2=>c2.propertyId===propId):db.emergencyContacts;
        response=contacts.length?`Emergency contacts: ${contacts.map(c2=>`${c2.name} (${c2.role}) — ${c2.phone}`).join('. ')}`:'No emergency contacts configured for this property.';
      }else if(q.includes('today')&&(q.includes('happened')||q.includes('activity')||q.includes('log'))){
        const today=new Date().toISOString().slice(0,10);
        const logs=propId?db.activityLog.filter(l=>l.propertyId===propId&&l.createdAt.startsWith(today)):db.activityLog.filter(l=>l.createdAt.startsWith(today));
        response=logs.length?`Today: ${logs.length} event${logs.length!==1?'s':''}. Recent: ${logs.slice(-5).map(l=>`${l.action} by ${db.users.find(u=>u.id===l.userId)?.name||'System'}`).join('. ')}`:'No activity logged today.';
      }else if(q.includes('hello')||q.includes('hi')||q.includes('hey')){
        response=`Hello ${user.name}! I'm your HomePilot assistant. I can help you with property information, access management, maintenance, and more. What would you like to know?`;
      }else if(q.includes('help')){
        response='I can help with:\n• Viewing who has access to your properties\n• Checking maintenance issues\n• Guiding you to device controls\n• Finding emergency contacts\n• Viewing activity logs\n\nJust ask a question or tell me what you need!';
      }else{
        response=`I understand you're asking about: "${b.message}". I can help with access management, maintenance, device control, emergency contacts, and activity logs. Could you be more specific about what you need?`;
      }

      logActivity(db,user.id,'ai.interaction',b.propertyId||null,'AI: '+b.message.slice(0,50));
      return ok(res,{response,actions});
    }

    // Roles
    if(p==='/api/roles'&&method==='GET'){
      const roles=db.roles.filter(r=>r.ownerId===user.id);
      return ok(res,{roles});
    }

    // Dashboard stats
    if(p==='/api/dashboard'&&method==='GET'){
      const ownedProps=db.properties.filter(pr=>pr.ownerId===user.id);
      const agentProps=db.propertyMembers.filter(m=>m.userId===user.id).map(m=>db.properties.find(pr=>pr.id===m.propertyId)).filter(Boolean);
      const allProps=[...ownedProps,...agentProps.filter(a=>!ownedProps.find(o=>o.id===a.id))];
      const activeGrants=ownedProps.reduce((sum,pr)=>sum+db.accessGrants.filter(g=>g.propertyId===pr.id&&g.status==='active').length,0);
      const openMaint=ownedProps.reduce((sum,pr)=>sum+db.maintenanceRequests.filter(m=>m.propertyId===pr.id&&m.status==='open').length,0);
      const totalDevices=ownedProps.reduce((sum,pr)=>sum+db.devices.filter(d2=>d2.propertyId===pr.id).length,0);
      const recentActivity=db.activityLog.filter(l=>ownedProps.some(pr=>pr.id===l.propertyId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10).map(l=>{const u=db.users.find(u2=>u2.id===l.userId);return{...l,user:u?{name:u.name}:null};});
      return ok(res,{properties:allProps.length,activeAgents:activeGrants,openMaintenance:openMaint,totalDevices,activeGrants,recentActivity,propertiesList:ownedProps.map(pr=>({id:pr.id,name:pr.name,city:pr.city,state:pr.state,country:pr.country}))});
    }

    // Delete property
    if(propMatch&&method==='DELETE'){
      const prop=db.properties.find(pr=>pr.id===Number(propMatch[1]));
      if(!prop||prop.ownerId!==user.id)return fail(res,403,'Not authorized');
      db.properties=db.properties.filter(pr=>pr.id!==prop.id);
      db.devices=db.devices.filter(d2=>d2.propertyId!==prop.id);
      db.propertyMembers=db.propertyMembers.filter(m=>m.propertyId!==prop.id);
      db.maintenanceRequests=db.maintenanceRequests.filter(m=>m.propertyId!==prop.id);
      db.tenants=db.tenants.filter(t=>t.propertyId!==prop.id);
      db.documents=db.documents.filter(d2=>d2.propertyId!==prop.id);
      db.accessGrants=db.accessGrants.filter(g=>g.propertyId!==prop.id);
      db.emergencyContacts=db.emergencyContacts.filter(c2=>c2.propertyId!==prop.id);
      save();
      logActivity(db,user.id,'property.deleted',null,'Deleted property: '+prop.name);
      return ok(res);
    }

    return fail(res,404,'API endpoint not found');
  }catch(e){
    log('err',e.stack||e.message);
    return fail(res,500,'Server error');
  }
}

/* ============ server ============ */
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://'+req.headers.host);
  if(url.pathname.startsWith('/api/'))return handleAPI(req,res);
  let fp=path.join(PUBLIC_DIR,url.pathname==='/'?'index.html':url.pathname);
  if(!fs.existsSync(fp)&&!path.extname(fp))fp=path.join(PUBLIC_DIR,'index.html');
  serveFile(res,fp);
});

if(require.main===module){
  load();
  log('ok',`HomePilot running at ${BOLD}http://localhost:${PORT}${RST}`);
  server.listen(PORT);
}
