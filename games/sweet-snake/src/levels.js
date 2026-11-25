// Each level couples a named scene to its mission, food palette, spawn region and layout.
// Coordinates are on the 12 × 18 board (layouts centered with +2 vertical offset). Row 9 and outside lanes stay open.
const FOODS={strawberry:['草莓','🍓','#b97882','#ffd1d7'],cherries:['樱桃','🍒','#ba6381','#ffbed0'],heart:['爱心','💗','#be79a4','#ffcee9'],candy:['糖果','🍬','#9977be','#e4caff'],star:['星星','⭐','#bd945b','#ffe4a1']};
const line=(x,y,dx,dy,n)=>Array.from({length:n},(_,i)=>[x+dx*i,y+dy*i]);
const layouts={
 field:[],
 sprouts:[[3,3],[8,3],[3,10],[8,10]],
 twins:[...line(3,2,0,1,4),...line(8,9,0,1,3)],
 heart:[[3,3],[4,2],[7,2],[8,3],[4,5],[7,5],[5,6],[6,6]],
 wrappers:[[2,3],[3,4],[2,5],[9,3],[8,4],[9,5],[2,9],[3,10],[2,11],[9,9],[8,10],[9,11]],
 stars:[[5,2],[4,3],[5,3],[6,3],[5,4],[6,9],[5,10],[6,10],[7,10],[6,11]],
 rows:[...line(2,3,1,0,3),...line(7,3,1,0,3),...line(2,10,1,0,3),...line(7,10,1,0,3)],
 alleys:[...line(3,2,0,1,4),...line(8,2,0,1,4),...line(3,9,0,1,3),...line(8,9,0,1,3)],
 petals:[[3,3],[4,2],[7,2],[8,3],[8,4],[4,5],[7,5],[3,10],[4,9],[7,9],[8,10],[4,11],[7,11]],
 stairs:[[2,2],[3,3],[4,4],[5,5],[6,9],[7,10],[8,11],[9,12]],
 crown:[[2,2],[2,4],[4,4],[5,2],[6,2],[7,4],[9,2],[9,4],[4,10],[7,10]],
 gates:[...line(2,3,1,0,3),...line(7,3,1,0,3),[2,4],[9,4],...line(2,10,1,0,3),...line(7,10,1,0,3),[2,9],[9,9]],
 islands:[[3,3],[4,3],[3,4],[4,4],[7,9],[8,9],[7,10],[8,10]],
 zigzag:[...line(2,3,1,0,5),...line(5,5,1,0,5),...line(2,9,1,0,5),...line(5,11,1,0,5)],
 windows:[[2,2],[3,2],[4,2],[2,3],[4,3],[2,4],[4,4],[7,9],[8,9],[9,9],[7,10],[9,10],[7,11],[9,11]],
 ribbons:[...line(2,2,1,1,4),...line(6,2,1,1,4),...line(2,9,1,1,3),...line(7,9,1,1,3)],
 orbit:[[4,2],[5,2],[6,2],[7,2],[3,3],[8,3],[3,5],[8,5],[4,6],[7,6],[4,9],[7,9],[3,10],[8,10],[4,11],[5,11],[6,11],[7,11]],
 bridge:[...line(2,4,1,0,3),...line(7,4,1,0,3),...line(2,9,1,0,3),...line(7,9,1,0,3),[2,3],[9,3],[2,10],[9,10]],
 diamonds:[[4,2],[3,3],[4,3],[5,3],[4,4],[7,9],[6,10],[7,10],[8,10],[7,11]],
 weave:[[2,2],[4,2],[6,2],[8,2],[3,4],[5,4],[7,4],[9,4],[2,9],[4,9],[6,9],[8,9],[3,11],[5,11],[7,11],[9,11]],
 bays:[[2,2],[2,3],[2,4],[3,4],[4,4],[9,9],[9,10],[9,11],[8,9],[7,9]]
};
const zones={
 meadow:{label:'中央草地',match:(x,y)=>x>=3&&x<=8&&y>=5&&y<=12},
 pairs:{label:'左右果丛',match:(x,y)=>(x===2||x===3||x===8||x===9)&&y>=2&&y<=15},
 corners:{label:'四角花圃',match:(x,y)=>(x<=3||x>=8)&&(y<=5||y>=12)},
 top:{label:'上方花园',match:(x,y)=>y>=1&&y<=7},
 bottom:{label:'下方果园',match:(x,y)=>y>=11&&y<=16},
 lanes:{label:'两侧通道',match:x=>x===1||x===10},
 cross:{label:'十字走廊',match:(x,y)=>x===5||x===6||y===9||y===10},
 ring:{label:'外圈小径',match:(x,y)=>x===1||x===10||y===1||y===16},
 diagonal:{label:'斜向花带',match:(x,y)=>Math.abs(x-(y-2))<2||Math.abs(x+(y-2)-12)<2},
 rows:{label:'上下种植带',match:(x,y)=>y===3||y===7||y===11||y===15}
};
// name, mission food, companion food, obstacle motif, target spawn region, scene hint, mirrored
const designs=[
 ['草莓初晴','strawberry','heart','field','meadow','空旷草地练转向，草莓偏爱中央。'],
 ['双樱相逢','cherries','strawberry','field','pairs','樱桃常在左右两丛出现，练习横向往返。'],
 ['心花初绽','heart','cherries','field','corners','四角花圃藏着爱心，记得提前转弯。'],
 ['糖纸蝴蝶结','candy','heart','sprouts','cross','四株新芽点缀中央，从十字走廊轻松收糖。'],
 ['星星许愿池','star','heart','stars','ring','绕开上下星形石台，沿外圈寻找星星。'],
 ['莓田四季','strawberry','cherries','rows','rows','四段田垄分隔果园，草莓沿种植带刷新。'],
 ['樱桃双巷','cherries','strawberry','alleys','lanes','双排树篱形成巷道，樱桃偏爱两侧通道。'],
 ['心形花坛','heart','strawberry','heart','top','上方心形花坛旁寻找爱心，留意花坛转角。'],
 ['糖果小阶梯','candy','cherries','stairs','diagonal','阶梯路障沿斜线排列，追着糖果练转弯。'],
 ['星冠花园','star','candy','crown','top','皇冠形花墙守着上方花园，收集散落星光。'],
 ['双樱新芽','cherries','heart','wrappers','pairs','蝴蝶结路障分列两边，在两侧果丛采樱桃。'],
 ['莓香双岛','strawberry','cherries','islands','corners','两座方形小岛错落分布，四角藏着草莓。'],
 ['心花瓣雨','heart','cherries','petals','top','花瓣形路障围着上方爱心，找准花瓣间隙。'],
 ['樱桃迎宾门','cherries','strawberry','gates','cross','上下花门留出中央入口，樱桃沿十字走廊出现。'],
 ['糖丝斜廊','candy','heart','ribbons','diagonal','斜向糖丝排成两束，沿花带收集糖果。'],
 ['莓田回廊','strawberry','cherries','zigzag','lanes','交错田垄挡住直路，绕两侧采草莓。'],
 ['樱桃小木桥','cherries','star','bridge','cross','两岸桥栏留出中路，穿桥收集樱桃。'],
 ['心愿花窗','heart','strawberry','windows','corners','两扇开口花窗错落摆放，去四角收集爱心。'],
 ['星落菱花','star','cherries','diamonds','diagonal','菱形花架点缀斜线，沿花带追逐星星。'],
 ['樱桃花环','cherries','heart','orbit','ring','断开的花环留出出口，绕外圈采樱桃。'],
 ['糖果编织坊','candy','star','weave','rows','糖块交错织成花纹，在上下种植带收糖。'],
 ['奶油莓湾','strawberry','candy','bays','corners','两处奶油弯岸朝向相反，四角散落草莓。'],
 ['爱心糖纸','heart','candy','wrappers','pairs','蝴蝶结糖纸夹着两侧果丛，爱心偏向左右刷新。'],
 ['双樱糖门','cherries','candy','gates','top','糖门守着上方樱桃园，从门口转入采集。',true],
 ['星糖旋环','star','candy','orbit','ring','糖环有缺口，沿外圈收星星再安全绕出。',true],
 ['莓果千层','strawberry','candy','zigzag','rows','奶油层层交错，草莓沿上下果带刷新。',true],
 ['糖果双塔','candy','star','twins','lanes','两座细长糖塔错位排列，在侧边通道收糖。'],
 ['心愿糖梯','heart','candy','stairs','diagonal','心愿沿糖梯斜向散落，连续转弯收集爱心。',true],
 ['樱桃棋盘','cherries','candy','weave','pairs','棋子般的糖块交错排列，樱桃常落在左右果丛。',true],
 ['糖霜王冠','candy','star','crown','top','皇冠糖墙围着上方糖果，绕过冠尖再入园。',true],
 ['莓林长巷','strawberry','heart','alleys','lanes','长树篱分隔森林，沿两侧小巷寻找草莓。',true],
 ['樱桃双溪','cherries','strawberry','bridge','cross','溪岸桥栏夹着中央走廊，横穿收集樱桃。',true],
 ['心叶藤窗','heart','cherries','windows','top','藤窗开口朝向内侧，爱心集中在上方林地。',true],
 ['莓香菱径','strawberry','heart','diamonds','diagonal','菱形树丛点出斜向路线，追着莓香绕行。',true],
 ['星萤树阵','star','strawberry','weave','corners','交错树阵中转向，四角更容易找到星萤。'],
 ['樱桃双湾','cherries','heart','bays','pairs','相向弯岸留下回旋空间，左右果丛藏樱桃。',true],
 ['心叶花环','heart','strawberry','orbit','bottom','树叶围成开口环，下方林地常出现爱心。'],
 ['莓林花瓣','strawberry','heart','petals','corners','花瓣树篱错落展开，在四角花圃采草莓。',true],
 ['樱桃藤带','cherries','strawberry','ribbons','diagonal','两束斜藤形成绕行线，沿斜向花带采樱桃。',true],
 ['星光林门','star','heart','gates','cross','林门两侧留出入口，星光沿十字走廊出现。'],
 ['星轨双岛','star','candy','islands','ring','双岛之间留足回旋空间，沿外圈追星。',true],
 ['莓色流星','strawberry','star','stairs','diagonal','流星般的阶梯斜落，草莓跟着斜线刷新。'],
 ['樱桃星窗','cherries','star','windows','bottom','上下星窗错位，下方更容易遇见樱桃。'],
 ['心愿星桥','heart','star','bridge','cross','星桥两岸围住走廊，从中间穿行收爱心。'],
 ['星河回旋','star','heart','zigzag','lanes','星河横栏交错，绕两侧追逐星光。'],
 ['糖果星芒','candy','star','stars','diagonal','上下星芒挡住直线，沿斜向花带寻找糖果。'],
 ['莓香星环','strawberry','star','orbit','ring','莓果沿星环外圈出现，留意花环缺口。',true],
 ['樱桃天阶','cherries','star','ribbons','rows','斜向天阶划过上下果带，转弯采集樱桃。'],
 ['心愿皇冠','heart','star','crown','top','皇冠守着最后的心愿，在上方收集爱心。'],
 ['星冠终曲','star','heart','crown','ring','绕皇冠花墙巡游外圈，收齐最后的星光。',true]
];
const FOOD_KEYS=['strawberry','cherries','heart','candy','star'];
const introTargets=[3,3,4,4,5,5,5,6,6,6];
const speeds=[340,330,320,310,300,292,284,276,268,260];
const LEVELS=designs.map(([name,targetType,companion,layout,zone,themeHint,mirror=false],i)=>{
 const obstacles=layouts[layout].map(([x,y])=>({x:mirror?11-x:x,y:y+2}));
 const blocked=new Set(obstacles.map(p=>`${p.x},${p.y}`));
 const spawnCells=[];
 for(let y=0;y<18;y++)for(let x=0;x<12;x++)if(zones[zone].match(x,y)&&!blocked.has(`${x},${y}`))spawnCells.push({x,y});
 const extra=Math.max(0,i-9),food=FOODS[targetType],compFood=FOODS[companion];
 const totalTarget=i<10?introTargets[i]:6+Math.floor((extra+3)/4);
 const timeLimit=i<10?95:i<30?90:85;
 let missions;
 let foodWeights;
 if(i<3) {
  missions=[{type:targetType,name:food[0],icon:food[1],target:totalTarget}];
  foodWeights={[targetType]:70,[companion]:30};
 } else if(i>=20 && i%3===0) {
  const thirdType=FOOD_KEYS.find(k=>k!==targetType && k!==companion) || 'star';
  const thirdFood=FOODS[thirdType];
  const t3=Math.max(2,Math.floor(totalTarget*0.22));
  const t2=Math.max(2,Math.floor(totalTarget*0.32));
  const t1=Math.max(2,totalTarget-t2-t3);
  missions=[
   {type:targetType,name:food[0],icon:food[1],target:t1},
   {type:companion,name:compFood[0],icon:compFood[1],target:t2},
   {type:thirdType,name:thirdFood[0],icon:thirdFood[1],target:t3}
  ];
  foodWeights={[targetType]:44,[companion]:32,[thirdType]:24};
 } else {
  const t2=Math.max(2,Math.floor(totalTarget*0.35));
  const t1=Math.max(2,totalTarget-t2);
  missions=[
   {type:targetType,name:food[0],icon:food[1],target:t1},
   {type:companion,name:compFood[0],icon:compFood[1],target:t2}
  ];
  foodWeights={[targetType]:60,[companion]:40};
 }
 return {number:i+1,name,targetType,targetName:food[0],targetIcon:food[1],themeHint,
  layout,spawnZone:zone,spawnLabel:zones[zone].label,spawnCells,foodWeights,missions,
  obstacleColor:food[2],obstacleHighlight:food[3],
  target:totalTarget,timeLimit,
  stepMs:i<10?speeds[i]:Math.max(175,Math.round(260-extra*2.1)),obstacles};
});
function getLevel(number) {return LEVELS[Math.max(0,Math.min(LEVELS.length-1,Math.floor(Number(number)||1)-1))];}
export { LEVELS, getLevel };
