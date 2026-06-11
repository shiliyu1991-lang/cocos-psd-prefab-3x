'use strict';
// Verify a converted 3.8.x prefab: structure, ascii names, prefix/suffix rules,
// pixel alignment, MD5 dedup, and per-type components. Mirrors the 2.x verify
// but adapted to the 3.x format (_lpos, size on cc.UITransform, components by type).
const fs=require('fs'),path=require('path');
const proj=process.argv[2],PSD_W=960,PSD_H=640;
const pdir=path.join(proj,'assets/PSD/prefabs');
const pf=fs.readdirSync(pdir).find(f=>f.endsWith('.prefab'));
const arr=JSON.parse(fs.readFileSync(path.join(pdir,pf),'utf8'));
let pass=0,fail=0;const ok=(c,m)=>c?pass++:(fail++,console.log('  FAIL:',m));

let refErr=0;JSON.stringify(arr,(k,v)=>{if(k==='__id__'&&(typeof v!=='number'||v<0||v>=arr.length))refErr++;return v;});
ok(refErr===0,'__id__ refs');

const nodes=arr.map((o,i)=>({o,i})).filter(x=>x.o&&x.o.__type__==='cc.Node');
ok(nodes.length===12,'node count 12; got '+nodes.length);
ok(nodes.every(n=>/^[\x00-\x7F]+$/.test(n.o._name)),'ascii names');
const nonRoot=nodes.slice(1);
ok(nonRoot.every(n=>/^(Node_|Img_|Label_|Btn_)/.test(n.o._name)),'all children prefixed');
const suffixAlnum=n=>n.replace(/^(Node_|Img_|Label_|Btn_)/,'').replace(/[^A-Za-z0-9]/g,'').length;
const tooLong=nonRoot.filter(n=>suffixAlnum(n.o._name)>8).map(n=>n.o._name);
ok(tooLong.length===0,'suffix<=8 alnum; offenders: '+tooLong.join(','));

// every node has exactly one cc.UITransform; every node points to a PrefabInfo
const comp=(n,type)=>{for(const ref of n.o._components){const c=arr[ref.__id__];if(c&&c.__type__===type)return c;}return null;};
ok(nodes.every(n=>comp(n,'cc.UITransform')),'every node has UITransform');
ok(nodes.every(n=>arr[n.o._prefab.__id__]&&arr[n.o._prefab.__id__].__type__==='cc.PrefabInfo'),'every node _prefab -> PrefabInfo');
ok(nodes.every(n=>n.o._layer===33554432),'every node _layer = UI_2D');

const byName={};nodes.forEach(n=>byName[n.o._name]=n);
function wp(i){let x=0,y=0,c=arr[i];while(c&&c.__type__==='cc.Node'){x+=c._lpos.x;y+=c._lpos.y;c=c._parent?arr[c._parent.__id__]:null;}return{x,y};}
function ec(l,t,w,h){return{x:l+w/2-PSD_W/2,y:PSD_H/2-(t+h/2)};}
const exp={Img_BeiJing:[240,120,480,400],Label_BiaoTi:[380,150,200,40],Img_icon_Zhua:[640,140,64,64]};
for(const n in exp){const nd=byName[n];if(!nd){ok(false,'missing '+n);continue;}const w=wp(nd.i),e=ec.apply(null,exp[n]);ok(Math.abs(w.x-e.x)<0.5&&Math.abs(w.y-e.y)<0.5,'align '+n);}

// dedup: two star nodes share the same spriteFrame uuid
const stars=nodes.filter(n=>n.o._name==='Img_icon_star'||n.o._name==='Img_icon_sta2');
ok(stars.length===2,'two star nodes; got '+stars.length);
const su=n=>{const c=comp(n,'cc.Sprite');return c&&c._spriteFrame&&c._spriteFrame.__uuid__;};
ok(stars.length===2 && su(stars[0])===su(stars[1]),'dedup star uuid shared');

ok(comp(byName['Img_BeiJing'],'cc.Sprite')._type===1,'BeiJing sliced (_type=1)');
ok(comp(byName['Btn_QueDing'],'cc.Button'),'btn Btn_QueDing has cc.Button');
ok(comp(byName['Node_LieBiao'],'cc.Layout')._layoutType===2,'layout vertical (_layoutType=2)');
ok(comp(byName['Img_icon_Zhua'],'cc.UITransform')._contentSize.width===32,'@2x 32 (UITransform size)');
ok(comp(byName['Label_BiaoTi'],'cc.Label')._string==='标题','Label keeps 标题');

console.log('VERIFY:',pass,'passed,',fail,'failed');process.exit(fail?1:0);
