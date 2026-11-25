// Code-drawn local icons share the original candy palette and dark pink outline.
const ITEMS = [
  {id:'slow',kind:'active',price:450,name:'时间糖果',description:'减速 30% 并冻住倒计时 10 秒',hint:'缓速+冻时 10 秒',icon:'assets/item-slow.png'},
  {id:'magnet',kind:'active',price:500,name:'甜蜜磁铁',description:'吸取 3 格内食物 10 秒，非目标不增体长',hint:'3 格磁吸 10 秒',icon:'assets/item-magnet.png'},
  {id:'time',kind:'active',price:550,name:'时光沙漏',description:'倒计时立刻 +25 秒',hint:'倒计时 +25 秒',icon:'assets/item-time.png'},
  {id:'doubleCoin',kind:'passive',price:600,name:'双倍金币',description:'开局生效：本局拾取与结算金币翻倍',hint:'本局金币 ×2',icon:'assets/item-double.png'},
  {id:'revive',kind:'passive',price:950,name:'复活卡',description:'未触发不消耗：撞击给 3 秒护盾，超时 +20 秒',hint:'自动救命 1 次',icon:'assets/item-revive.png'}
];
function getItem(id) { return ITEMS.find(item=>item.id===id); }
export { ITEMS, getItem };
