import json,urllib.request,sys
B='http://localhost:8123/api/v2'
def call(method,path,body=None,token=None):
    req=urllib.request.Request(B+path,method=method,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',**({'Authorization':'Bearer '+token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status,json.loads(r.read().decode() or 'null')
    except urllib.error.HTTPError as e: return e.code,e.read().decode()
