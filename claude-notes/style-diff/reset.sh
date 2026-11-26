#!/bin/bash
# Restart the test server with a fresh database and the same sample boards
SP=/private/tmp/claude-501/-Users-ulises-Documents-picolove-focalboard/79fa0b03-0ddc-46de-8f00-60362a242416/scratchpad
PID=$(ps -eo pid,comm | grep 'bin/focalboard-server' | grep -v grep | awk '{print $1}')
[ -n "$PID" ] && kill $PID && sleep 2
rm -rf $SP/srv/test.db* $SP/srv/files
cd $SP/srv && (nohup /Users/ulises/Documents/picolove/focalboard/bin/focalboard-server --config $SP/srv/config.json > server.log 2>&1 &)
sleep 4
python3 - <<'PY'
import sys,json,uuid,time; sys.path.insert(0,'/tmp')
from vis_api import *
call('POST','/register',{'username':'visuser','email':'vis@example.com','password':'Passw0rd!x'})
s,t=call('POST','/login',{'type':'normal','username':'visuser','password':'Passw0rd!x'}); tok=t['token']
s,tpls=call('GET','/teams/0/templates',token=tok)
by={x['title'].strip():x['id'] for x in tpls}
out={}
for name in ['Project Tasks','Content Calendar','Roadmap','Meeting Agenda','Sales Pipeline CRM']:
    s,r=call('POST',f"/boards/{by[name]}/duplicate?asTemplate=false&toTeam=0",{},token=tok)
    b=r['boards'][0]
    out[name]={'board':b['id']}
bid=out['Project Tasks']['board']
s,blocks=call('GET',f'/boards/{bid}/blocks',token=tok)
v=[b for b in blocks if b['type']=='view' and b['fields']['viewType']=='board'][0]
nv=json.loads(json.dumps(v)); nv['id']='vgallery'+uuid.uuid4().hex[:16]; nv['title']='Gallery view'; nv['fields']['viewType']='gallery'
nv['createAt']=nv['updateAt']=int(time.time()*1000)
call('POST',f'/boards/{bid}/blocks',[nv],token=tok)
for name,o in out.items():
    s,blocks=call('GET',f"/boards/{o['board']}/blocks",token=tok)
    o['views']=[(b['id'],b['fields']['viewType'],b['title']) for b in blocks if b['type']=='view']
    o['cards']=sorted([b['id'] for b in blocks if b['type']=='card'])[:3]
json.dump({'token':tok,'boards':out},open('/tmp/vis_data.json','w'))
print('ready',{k:len(v['views']) for k,v in out.items()})
PY
