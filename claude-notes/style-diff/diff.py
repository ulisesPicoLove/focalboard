import json,sys,collections
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
ignore=set(sys.argv[3].split(',')) if len(sys.argv)>3 and sys.argv[3] else set()
diffs=collections.defaultdict(lambda: collections.defaultdict(set))
shape=[]
for screen in sorted(set(a)|set(b)):
    sa,sb=a.get(screen),b.get(screen)
    if sa is None or sb is None: shape.append((screen,'missing in '+('after' if sb is None else 'before'))); continue
    if 'error' in sa or 'error' in sb: shape.append((screen,'error')); continue
    ka,kb=set(sa),set(sb)
    if ka!=kb: shape.append((screen,f'elements only before: {len(ka-kb)}, only after: {len(kb-ka)}'))
    for k in ka&kb:
        for p,v in sa[k].items():
            if p in ignore: continue
            w=sb[k].get(p)
            if v!=w:
                sig=k.split('>')[-1].split('#')[0]
                diffs[(screen,sig)][p].add((v[:50],(w or '')[:50]))
print('shape differences:',len(shape))
for s in shape[:15]: print('  ',s)
n=sum(len(p) for p in diffs.values())
print('style differences:',len(diffs),'(screen,element) pairs;',n,'property diffs')
by=collections.Counter()
for (screen,sig),props in diffs.items():
    for p in props: by[p]+=1
print('by property:',by.most_common(12))
for (screen,sig),props in list(diffs.items())[:int(sys.argv[4]) if len(sys.argv)>4 else 12]:
    print(' ',screen[:34],'|',sig[:46],'|',{p:sorted(v)[0] for p,v in list(props.items())[:3]})
