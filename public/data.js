// 坐标为景点中心附近的展示点，不用于导航。时长/费用为可编辑的演示假设。
// cost: 每人每次活动的人民币预算占位值，并非门票、套餐或实时价格。
const place = (id,name,lat,lng,minutes,cost,indoor,url,note='') => ({id,name,lat,lng,minutes,cost,indoor,url,note});
export const DESTINATIONS = {
  paris: {name:'巴黎',english:'Paris',country:'法国',center:[48.858,2.32],zoom:12,defaultDays:2,defaultIds:['arc','champs','eiffel','louvre'],dailyFood:220,dailyHotel:900,points:[
    place('arc','凯旋门',48.8738,2.295,90,150,false,'https://www.paris-arc-de-triomphe.fr/en','登顶预约与门票另行确认'),
    place('champs','香榭丽舍大道',48.8698,2.3078,90,0,false,'https://parisjetaime.com/eng/','购物消费未计入'),
    place('eiffel','埃菲尔铁塔',48.8584,2.2945,120,250,false,'https://www.toureiffel.paris/en','外观或登塔请自行选择，费用为预算占位'),
    place('louvre','卢浮宫',48.8606,2.3376,180,250,true,'https://www.louvre.fr/en','闭馆日、预约和票价请查官网'),
    place('orsay','奥赛博物馆',48.86,2.3266,150,170,true,'https://www.musee-orsay.fr/en','闭馆日、预约和票价请查官网'),
    place('notredame','巴黎圣母院',48.853,2.3499,90,0,true,'https://www.notredamedeparis.fr/en/','参观区域和预约请查官网'),
    place('luxembourg','卢森堡公园',48.8462,2.3372,90,0,false,'https://www.senat.fr/visite/jardin/index.html'),
    place('montmartre','蒙马特圣心大教堂',48.8867,2.3431,120,0,false,'https://www.sacre-coeur-montmartre.com/english/','坡道较多，步行能力需考虑')
  ]},
  singapore: {name:'新加坡',english:'Singapore',country:'新加坡',center:[1.325,103.87],zoom:11,defaultDays:2,defaultIds:['jewel','merlion','gardens','museum'],dailyFood:160,dailyHotel:800,points:[
    place('jewel','星耀樟宜瀑布',1.3602,103.9898,120,0,true,'https://www.jewelchangiairport.com/en/getting-to-jewel.html','位于公共区；转机旅客需核实入境条件和衔接时间'),
    place('merlion','鱼尾狮公园',1.2868,103.8545,60,0,false,'https://www.visitsingapore.com/see-do-singapore/recreation-leisure/viewpoints/merlion-park/'),
    place('gardens','滨海湾花园',1.2816,103.8636,180,300,false,'https://www.gardensbythebay.com.sg/','温室与户外区域不同，票种、开放时间请查官网'),
    place('museum','新加坡国家博物馆',1.2966,103.8485,120,150,true,'https://www.nhb.gov.sg/nationalmuseum/'),
    place('gallery','新加坡国家美术馆',1.29,103.8516,120,170,true,'https://www.nationalgallery.sg/'),
    place('botanic','新加坡植物园',1.3138,103.8159,120,0,false,'https://www.nparks.gov.sg/sbg','兰花园等收费区域另计'),
    place('chinatown','牛车水',1.2838,103.8432,120,0,false,'https://www.visitsingapore.com/')
  ]},
  maldives: {name:'马尔代夫',english:'Maldives',country:'马尔代夫',center:[4.18,73.52],zoom:10,defaultDays:4,defaultIds:['water-villa','snorkel','dolphin','rest'],dailyFood:350,dailyHotel:2400,points:[
    place('water-villa','水屋休憩',null,null,180,0,false,'https://visitmaldives.com/','活动模板，具体酒店位置与房费另行确认'),
    place('snorkel','浮潜体验',null,null,120,600,false,'https://visitmaldives.com/','位置、资质、天气与报价由运营方确认'),
    place('dolphin','海豚巡游',null,null,120,500,false,'https://visitmaldives.com/','野生动物出现无法保证，位置和报价待确认'),
    place('rest','酒店自由活动',null,null,180,0,true,'https://visitmaldives.com/','仅活动模板，酒店位置待填写'),
    place('sunset','海边日落',null,null,90,0,false,'https://visitmaldives.com/','天气与观景点由酒店确认'),
    place('male','马累共和国广场',4.1781,73.5108,60,0,false,'https://visitmaldives.com/','跨岛交通必须单独确认，不按步行计算'),
    place('hulhumale','胡鲁马累海滩',4.2121,73.5445,90,0,false,'https://visitmaldives.com/','仅为真实地理展示点，不代表用户入住岛屿')
  ]}
};
export const PACE = {relaxed:'轻松',balanced:'适中',packed:'充实'};
export const SOURCES_DATE = '2026-10-21';
