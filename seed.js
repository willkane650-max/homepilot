#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const DATA_FILE=path.join(__dirname,'homepilot-data.json');

function nowISO(){return new Date().toISOString();}
function hashPassword(p,s){return crypto.createHash('sha256').update(p+':'+s).digest('hex');}
function randHex(n){return crypto.randomBytes(n).toString('hex');}

let db={users:[],sessions:{},properties:[],propertyMembers:[],roles:[],permissions:[],agentInvitations:[],accessGrants:[],devices:[],devicePermissions:[],maintenanceRequests:[],tenants:[],documents:[],activityLog:[],notifications:[],emergencyContacts:[],handovers:[],nextId:{user:100,property:100,member:100,invitation:100,accessGrant:100,device:100,maintenance:100,tenant:100,document:100,activity:100,notification:100,emergency:100,handover:100}};
let idCounter=1;
function nid(k){return idCounter++;}

// Owner
const ownerSalt=randHex(16);
const owner={id:1,email:'owner@homepilot.com',name:'Sarah Smith',phone:'+1 555 0100',passwordHash:hashPassword('password123',ownerSalt),salt:ownerSalt,role:'owner',createdAt:nowISO(),avatar:null};
db.users.push(owner);

// Agent
const agentSalt=randHex(16);
const agent={id:2,email:'james@homepilot.com',name:'James Wilson',phone:'+1 555 0200',passwordHash:hashPassword('password123',agentSalt),salt:agentSalt,role:'owner',createdAt:nowISO(),avatar:null};
db.users.push(agent);

// Property
const prop={id:1,ownerId:1,name:'Smith Residence',address:'1247 Oak Valley Drive',city:'Austin',state:'Texas',country:'United States',zipCode:'78701',type:'residential',bedrooms:4,bathrooms:3,description:'Spacious family home in a quiet suburban neighborhood. Features a modern kitchen, large backyard, smart home system, and two-car garage. Built in 2018, recently renovated master suite.',createdAt:nowISO()};
db.properties.push(prop);

// Role for agent
const role={id:1,name:'Property Manager',ownerId:1,permissions:['property.view','maintenance.view','maintenance.create','device.view','device.control','document.view','access.view','tenant.view'],createdAt:nowISO()};
db.roles.push(role);

// Access grant
const grant={id:1,userId:2,propertyId:1,roleId:1,status:'active',createdAt:nowISO(),expiresAt:new Date(Date.now()+180*86400000).toISOString()};
db.accessGrants.push(grant);

// Property member
const member={id:1,userId:2,propertyId:1,roleId:1,invitedBy:1,createdAt:nowISO()};
db.propertyMembers.push(member);

// Devices
const devices=[
  {id:1,propertyId:1,name:'Front Door Smart Lock',type:'lock',location:'Main entrance',provider:'simulated',status:'locked',lastAction:'lock',lastActionAt:new Date(Date.now()-3600000).toISOString(),createdAt:nowISO()},
  {id:2,propertyId:1,name:'Back Door Lock',type:'lock',location:'Rear entrance',provider:'simulated',status:'locked',lastAction:'lock',lastActionAt:new Date(Date.now()-7200000).toISOString(),createdAt:nowISO()},
  {id:3,propertyId:1,name:'Electric Gate',type:'gate',location:'Driveway',provider:'simulated',status:'closed',lastAction:'close',lastActionAt:new Date(Date.now()-1800000).toISOString(),createdAt:nowISO()},
  {id:4,propertyId:1,name:'Garage Door',type:'garage',location:'Attached garage',provider:'simulated',status:'closed',lastAction:'close',lastActionAt:new Date(Date.now()-5400000).toISOString(),createdAt:nowISO()},
  {id:5,propertyId:1,name:'Front Door Camera',type:'camera',location:'Front entrance',provider:'simulated',status:'recording',lastAction:'on',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:6,propertyId:1,name:'Backyard Camera',type:'camera',location:'Backyard',provider:'simulated',status:'recording',lastAction:'on',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:7,propertyId:1,name:'Driveway Camera',type:'camera',location:'Driveway',provider:'simulated',status:'on',lastAction:'on',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:8,propertyId:1,name:'Hallway Motion Sensor',type:'sensor',location:'Main hallway',provider:'simulated',status:'active',lastAction:'arm',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:9,propertyId:1,name:'Backyard Motion Sensor',type:'sensor',location:'Backyard',provider:'simulated',status:'active',lastAction:'arm',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:10,propertyId:1,name:'Kitchen Smoke Detector',type:'sensor',location:'Kitchen',provider:'simulated',status:'normal',lastAction:null,lastActionAt:null,createdAt:nowISO()},
  {id:11,propertyId:1,name:'Living Room Smoke Detector',type:'sensor',location:'Living room',provider:'simulated',status:'normal',lastAction:null,lastActionAt:null,createdAt:nowISO()},
  {id:12,propertyId:1,name:'Master Bedroom Light',type:'light',location:'Master bedroom',provider:'simulated',status:'off',lastAction:'off',lastActionAt:new Date(Date.now()-3600000).toISOString(),createdAt:nowISO()},
  {id:13,propertyId:1,name:'Living Room Light',type:'light',location:'Living room',provider:'simulated',status:'on',lastAction:'on',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:14,propertyId:1,name:'Kitchen Light',type:'light',location:'Kitchen',provider:'simulated',status:'on',lastAction:'on',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:15,propertyId:1,name:'Thermostat',type:'thermostat',location:'Main hallway',provider:'simulated',status:'set:72',lastAction:'set',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:16,propertyId:1,name:'Security Alarm Panel',type:'alarm',location:'Front entrance',provider:'simulated',status:'armed',lastAction:'arm',lastActionAt:nowISO(),createdAt:nowISO()},
  {id:17,propertyId:1,name:'Kitchen Water Leak Sensor',type:'sensor',location:'Kitchen floor',provider:'simulated',status:'dry',lastAction:null,lastActionAt:null,createdAt:nowISO()},
  {id:18,propertyId:1,name:'Basement Water Leak Sensor',type:'sensor',location:'Basement',provider:'simulated',status:'dry',lastAction:null,lastActionAt:null,createdAt:nowISO()},
];
db.devices.push(...devices);

// Tenants
const tenant={id:1,propertyId:1,name:'Emily Chen',email:'emily@email.com',phone:'+1 555 0301',unit:'Master Suite',startDate:'2025-01-01',endDate:'2026-06-30',rent:2800,emergencyContact:'David Chen +1 555 0302',notes:'Long-term tenant. Renews annually.',createdAt:nowISO()};
db.tenants.push(tenant);

// Documents
const docs=[
  {id:1,propertyId:1,name:'Property Floor Plan',type:'pdf',category:'floor_plan',url:'',allowedUsers:[],uploadedBy:1,createdAt:nowISO()},
  {id:2,propertyId:1,name:'HVAC Maintenance Manual',type:'pdf',category:'manual',url:'',allowedUsers:[],uploadedBy:1,createdAt:nowISO()},
  {id:3,propertyId:1,name:'Smart Lock User Guide',type:'pdf',category:'manual',url:'',allowedUsers:[2],uploadedBy:1,createdAt:nowISO()},
  {id:4,propertyId:1,name:'Home Insurance Policy 2026',type:'pdf',category:'warranty',url:'',allowedUsers:[],uploadedBy:1,createdAt:nowISO()},
  {id:5,propertyId:1,name:'Lease Agreement — Emily Chen',type:'pdf',category:'tenancy',url:'',allowedUsers:[2],uploadedBy:1,createdAt:nowISO()},
  {id:6,propertyId:1,name:'Emergency Evacuation Plan',type:'pdf',category:'emergency',url:'',allowedUsers:[2],uploadedBy:1,createdAt:nowISO()},
];
db.documents.push(...docs);

// Emergency contacts
const contacts=[
  {id:1,propertyId:1,name:'Austin Fire Department',role:'Fire & Emergency',phone:'911',email:'',isDefault:true,createdAt:nowISO()},
  {id:2,propertyId:1,name:'Mike\'s Plumbing',role:'Plumber',phone:'+1 512 555 0199',email:'mike@mplumbing.com',isDefault:false,createdAt:nowISO()},
  {id:3,propertyId:1,name:'Apex Electric',role:'Electrician',phone:'+1 512 555 0288',email:'service@apexelec.com',isDefault:false,createdAt:nowISO()},
  {id:4,propertyId:1,name:'SecureHome Security',role:'Alarm Monitoring',phone:'+1 800 555 0147',email:'alerts@securehome.com',isDefault:true,createdAt:nowISO()},
];
db.emergencyContacts.push(...contacts);

// Maintenance requests
const maint=[
  {id:1,propertyId:1,title:'Kitchen AC not cooling properly',description:'The AC turns on but does not produce cold air. May need refrigerant recharge or filter replacement.',priority:'medium',status:'open',reportedById:2,assignedTo:null,notes:[],createdAt:new Date(Date.now()-2*86400000).toISOString(),updatedAt:new Date(Date.now()-2*86400000).toISOString()},
  {id:2,propertyId:1,title:'Backyard fence loose panel',description:'One of the fence panels near the back gate is loose and needs to be re-secured.',priority:'low',status:'open',reportedById:2,assignedTo:null,notes:[],createdAt:new Date(Date.now()-5*86400000).toISOString(),updatedAt:new Date(Date.now()-5*86400000).toISOString()},
  {id:3,propertyId:1,title:'Garage door sensor alignment',description:'The garage door sometimes stops mid-way. The safety sensors may need realignment.',priority:'high',status:'in_progress',reportedById:1,assignedTo:null,notes:[{text:'Scheduled a technician for Thursday.',by:1,at:new Date(Date.now()-86400000).toISOString()}],createdAt:new Date(Date.now()-3*86400000).toISOString(),updatedAt:new Date(Date.now()-86400000).toISOString()},
];
db.maintenanceRequests.push(...maint);

// Activity log
const activities=[
  {id:1,userId:1,action:'property.created',propertyId:1,detail:'Created property: Smith Residence',resourceType:'property',resourceId:1,createdAt:new Date(Date.now()-30*86400000).toISOString()},
  {id:2,userId:1,action:'device.added',propertyId:1,detail:'Added device: Front Door Smart Lock',resourceType:'device',resourceId:1,createdAt:new Date(Date.now()-29*86400000).toISOString()},
  {id:3,userId:1,action:'device.added',propertyId:1,detail:'Added 17 smart devices to Smith Residence',resourceType:'device',resourceId:1,createdAt:new Date(Date.now()-29*86400000).toISOString()},
  {id:4,userId:1,action:'handover.created',propertyId:1,detail:'Handed property to James Wilson (Property Manager)',resourceType:'handover',resourceId:1,createdAt:new Date(Date.now()-28*86400000).toISOString()},
  {id:5,userId:2,action:'device.lock',propertyId:1,detail:'Front Door Smart Lock → locked',resourceType:'device',resourceId:1,createdAt:new Date(Date.now()-1*3600000).toISOString()},
  {id:6,userId:2,action:'maintenance.created',propertyId:1,detail:'Maintenance: Kitchen AC not cooling properly',resourceType:'maintenance',resourceId:1,createdAt:new Date(Date.now()-2*86400000).toISOString()},
  {id:7,userId:2,action:'maintenance.created',propertyId:1,detail:'Maintenance: Backyard fence loose panel',resourceType:'maintenance',resourceId:2,createdAt:new Date(Date.now()-5*86400000).toISOString()},
  {id:8,userId:1,action:'maintenance.updated',propertyId:1,detail:'Maintenance "Garage door sensor alignment" → in_progress',resourceType:'maintenance',resourceId:3,createdAt:new Date(Date.now()-86400000).toISOString()},
  {id:9,userId:2,action:'device.arm',propertyId:1,detail:'Security Alarm Panel → armed',resourceType:'device',resourceId:16,createdAt:nowISO()},
  {id:10,userId:1,action:'device.lock',propertyId:1,detail:'Front Door Smart Lock → locked',resourceType:'device',resourceId:1,createdAt:new Date(Date.now()-3600000).toISOString()},
];
db.activityLog.push(...activities);

// Notifications
db.notifications=[
  {id:1,userId:1,type:'maintenance',title:'New Maintenance Request',body:'James reported: Kitchen AC not cooling properly',propertyId:1,read:false,createdAt:new Date(Date.now()-2*86400000).toISOString()},
  {id:2,userId:1,type:'handover',title:'Handover Complete',body:'James Wilson now has access to Smith Residence',propertyId:1,read:true,createdAt:new Date(Date.now()-28*86400000).toISOString()},
  {id:3,userId:2,type:'handover',title:'New Property Access',body:'You have been given access to Smith Residence as Property Manager',propertyId:1,read:true,createdAt:new Date(Date.now()-28*86400000).toISOString()},
];

fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2),'utf8');
console.log('✓ Database seeded with Smith Residence demo data.');
console.log('  Owner: owner@homepilot.com / password123');
console.log('  Agent: james@homepilot.com / password123');
console.log('  18 devices, 3 maintenance requests, 1 tenant, 6 documents, 4 emergency contacts');
