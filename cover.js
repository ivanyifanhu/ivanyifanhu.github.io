(() => {
  'use strict';

  const start = () => {
    const entry = document.getElementById('entry');
    const canvas = document.getElementById('cover-canvas');
    if (!entry || !canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const fallback = entry.querySelector('.cover-fallback');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    const interval = 1000 / 30;
    const { min, max, hypot, pow, round, sin, cos, floor } = Math;
    const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    let base, still, frame, buffer, fields, objects = [], clouds = [];
    let width = 0, height = 0, ready = false, inView = true;
    let timer = 0, elapsed = 0, lastTime = 0;
    canvas.hidden = true;
    canvas.style.imageRendering = 'pixelated';
    const visible = () => ready && !document.hidden && !entry.hidden && inView && entry.getClientRects().length > 0;
    const clamp = (n, lo = 0, hi = 1) => n < lo ? lo : n > hi ? hi : n;
    const smooth = n => { n = clamp(n); return n*n*(3-2*n); };

    // Coordinates are manually traced against the 1774 × 887 source painting.
    // Cloth/boats/plants are transparent sprites, never rectangular image patches.
    // Flagpoles, ropes, architecture and exposed stone stay in the static plate.
    const flags = [
      { name:'summit-black', pin:[1501,191], reach:8.5, points:[[1505,194],[1530,214],[1565,235],[1598,249],[1627,256],[1642,260],[1648,270],[1655,283],[1651,298],[1658,314],[1671,339],[1683,359],[1696,374],[1710,373],[1721,368],[1735,363],[1745,358],[1753,351],[1764,350],[1773,351],[1773,360],[1759,360],[1744,363],[1736,371],[1721,382],[1696,390],[1667,396],[1644,391],[1623,379],[1603,372],[1585,371],[1560,382],[1531,392],[1504,403],[1487,416],[1497,349],[1503,280]], parts:[[[1645,278],[1661,280],[1668,289],[1673,301],[1685,305],[1692,315],[1702,315],[1710,312],[1720,313],[1730,319],[1742,320],[1751,315],[1757,310],[1766,307],[1773,307],[1773,312],[1760,313],[1752,319],[1750,326],[1742,332],[1730,329],[1719,323],[1705,322],[1690,329],[1676,328],[1664,320],[1653,306]],[[1680,353],[1695,355],[1702,352],[1712,355],[1721,362],[1732,363],[1731,369],[1720,370],[1709,365],[1701,363],[1689,370]]], holes:[[[1657,301],[1673,307],[1684,314],[1687,319],[1673,317],[1661,314]],[[1691,371],[1701,365],[1710,367],[1717,371],[1705,376],[1699,376]]] },
      { name:'middle-black', pin:[1279,432], reach:7.5, points:[[1283,435],[1302,447],[1321,458],[1345,467],[1364,475],[1374,485],[1382,503],[1389,529],[1396,556],[1407,582],[1421,586],[1432,594],[1441,603],[1447,615],[1450,625],[1438,619],[1424,615],[1406,613],[1387,613],[1368,605],[1351,599],[1338,600],[1321,607],[1297,615],[1275,622],[1251,629],[1242,635],[1250,609],[1259,575],[1268,535],[1275,487]], parts:[[[1377,489],[1390,494],[1404,500],[1411,510],[1418,515],[1430,521],[1441,520],[1449,525],[1454,534],[1464,540],[1451,537],[1441,531],[1430,529],[1420,529],[1408,520],[1396,514],[1388,512]],[[1389,531],[1403,542],[1418,544],[1430,543],[1439,548],[1445,558],[1453,563],[1463,563],[1463,570],[1452,567],[1443,565],[1444,574],[1451,581],[1454,590],[1464,595],[1464,606],[1454,601],[1447,593],[1441,583],[1435,575],[1429,568],[1418,566],[1406,565],[1395,560]]] },
      { name:'right-white', pin:[1484,444], reach:8.5, points:[[1489,447],[1519,475],[1554,501],[1591,528],[1610,541],[1628,548],[1645,557],[1655,570],[1663,592],[1673,617],[1683,635],[1689,654],[1693,676],[1704,694],[1715,696],[1733,693],[1745,699],[1753,711],[1759,725],[1773,737],[1773,743],[1756,733],[1745,719],[1733,713],[1718,716],[1706,714],[1691,709],[1680,701],[1660,691],[1638,687],[1605,684],[1575,681],[1544,673],[1514,677],[1486,687],[1464,698],[1472,668],[1480,629],[1485,583],[1488,531]], parts:[[[1643,557],[1667,573],[1677,581],[1685,593],[1700,598],[1715,598],[1728,603],[1736,615],[1745,622],[1756,623],[1765,627],[1773,640],[1773,646],[1765,633],[1756,628],[1749,628],[1751,641],[1761,648],[1773,652],[1773,660],[1758,657],[1746,651],[1736,645],[1732,632],[1726,623],[1710,620],[1694,620],[1680,617],[1669,606],[1655,586]]] },
      { name:'centre-white', pin:[958,523], reach:6.8, points:[[961,527],[981,542],[1003,552],[1024,567],[1044,572],[1057,578],[1065,589],[1067,608],[1075,629],[1086,649],[1098,660],[1109,673],[1105,676],[1092,674],[1080,675],[1064,673],[1049,663],[1034,658],[1017,661],[999,671],[980,678],[959,691],[963,653],[965,608],[964,565]], parts:[[[1064,584],[1074,587],[1080,600],[1089,603],[1100,604],[1110,610],[1120,613],[1134,612],[1134,616],[1119,615],[1108,613],[1097,611],[1087,610],[1077,606],[1069,601]],[[1070,619],[1082,625],[1095,632],[1108,635],[1120,635],[1133,633],[1143,637],[1151,650],[1162,662],[1172,666],[1172,671],[1159,666],[1147,657],[1136,650],[1128,649],[1116,652],[1103,653],[1091,648],[1080,638]]] },
      { name:'lower-black', pin:[840,570], reach:6.8, points:[[844,573],[859,591],[880,608],[898,620],[919,632],[934,646],[943,665],[951,676],[967,684],[978,693],[985,702],[979,706],[968,703],[958,696],[949,693],[958,711],[968,720],[975,734],[969,738],[958,729],[946,722],[930,716],[918,709],[902,708],[879,714],[858,719],[832,725],[817,731],[826,699],[832,660],[838,616]] },
      { name:'lower-white', pin:[659,664], reach:7, points:[[663,666],[680,688],[702,708],[718,727],[732,745],[743,763],[746,777],[757,786],[773,792],[786,806],[794,813],[809,817],[820,822],[822,830],[811,831],[799,826],[786,823],[773,817],[759,817],[750,807],[744,807],[728,800],[712,795],[700,795],[682,798],[663,806],[640,817],[630,822],[641,796],[649,761],[655,718]] },
      { name:'distant-black-one', pin:[964,252], reach:3.8, points:[[966,254],[981,262],[997,267],[1008,281],[1014,290],[1027,295],[1040,299],[1052,305],[1047,310],[1038,307],[1026,306],[1036,315],[1030,319],[1015,315],[1004,311],[991,315],[973,320],[968,322],[969,289]] },
      { name:'distant-black-two', pin:[1176,238], reach:3.6, points:[[1178,240],[1195,247],[1210,254],[1224,264],[1234,281],[1250,286],[1262,289],[1271,296],[1263,299],[1250,296],[1237,296],[1225,295],[1213,299],[1195,303],[1181,306],[1181,278]] },
      { name:'harbour-black', pin:[657,386], reach:3.8, points:[[658,388],[675,399],[690,404],[704,416],[711,428],[724,432],[738,438],[744,443],[737,446],[725,441],[715,440],[704,442],[690,444],[675,448],[661,453],[660,425]] },
      { name:'bottom-black', pin:[205,837], reach:5.5, points:[[209,840],[226,851],[244,859],[259,872],[269,884],[281,887],[211,887]] },
      { name:'bottom-white', pin:[308,810], reach:6, points:[[312,814],[330,832],[350,847],[364,866],[374,883],[391,887],[311,887]] }
    ];
    // Distant cloth is small but must obey the same attached-edge motion.
    flags.push(
      {name:'quay-portrait-black',pin:[561,771],reach:5.4,points:[[564,774],[576,782],[585,786],[594,791],[603,799],[607,807],[609,815],[604,819],[596,815],[587,812],[578,814],[568,820],[563,819]],parts:[[[591,787],[602,789],[610,796],[614,801],[611,803],[602,798],[597,797]],[[602,804],[611,809],[618,813],[618,817],[610,814]]] },
      {name:'foreground-west-black',pin:[94,875],reach:3.8,points:[[96,877],[109,881],[119,883],[132,887],[96,887]]},
      {name:'foreground-west-white',pin:[153,868],reach:2.2,points:[[155,869],[161,871],[164,873],[163,878],[158,876],[155,878]]},
      {name:'foreground-quay-black',pin:[396,784],reach:5.2,points:[[399,788],[408,793],[422,797],[433,801],[441,813],[449,823],[459,831],[464,845],[459,853],[452,852],[443,844],[436,837],[422,834],[411,836],[398,840]],parts:[[[440,813],[449,814],[457,817],[464,823],[468,826],[464,828],[455,823],[449,822]],[[448,834],[458,836],[468,842],[475,844],[473,847],[466,847],[456,841]]]},
      {name:'foreground-quay-white',pin:[397,844],reach:4,points:[[399,847],[409,849],[421,852],[431,858],[436,866],[441,875],[445,881],[453,887],[431,887],[417,879],[406,878],[400,881]]},
      {name:'foreground-quay-white-small',pin:[460,816],reach:2.2,points:[[462,818],[472,821],[480,823],[483,828],[481,832],[471,828],[463,831]]},
      {name:'harbour-white',pin:[489,504],reach:2.6,points:[[491,507],[501,512],[509,518],[511,527],[507,531],[501,527],[494,526],[490,531]]},
      {name:'ridge-black-west',pin:[797,357],reach:3.6,points:[[799,360],[814,369],[825,372],[832,381],[844,385],[853,392],[837,391],[827,395],[811,399],[798,401]]},
      {name:'ridge-black-east',pin:[1595,421],reach:4,points:[[1598,425],[1620,435],[1637,436],[1649,447],[1662,451],[1647,454],[1630,452],[1613,460],[1597,464]]},
      {name:'ridge-black-east-low',pin:[1544,449],reach:3.3,points:[[1547,452],[1563,458],[1574,459],[1581,465],[1591,468],[1582,472],[1569,473],[1557,480],[1545,483]]},
      {name:'ridge-black-east-high',pin:[1580,397],reach:3.2,points:[[1583,400],[1595,405],[1607,405],[1614,411],[1625,413],[1614,417],[1597,416],[1583,423]]},
      {name:'middle-low-black',pin:[1194,546],reach:3.2,points:[[1197,550],[1208,558],[1220,559],[1226,568],[1239,574],[1229,575],[1217,572],[1207,577],[1195,579]]},
      {name:'lower-shrine-black',pin:[1134,577],reach:2.8,points:[[1136,580],[1146,585],[1155,586],[1163,592],[1154,594],[1146,595],[1136,599]]},
      {name:'stair-black',pin:[1059,411],reach:2.7,points:[[1062,414],[1072,419],[1080,419],[1088,426],[1079,428],[1070,431],[1061,434]]},
      {name:'ridge-portrait-small',pin:[906,317],reach:2.8,points:[[908,321],[919,325],[924,331],[933,335],[924,338],[916,338],[908,342]]},
      {name:'ridge-black-small',pin:[907,338],reach:2.6,points:[[910,341],[920,345],[929,346],[936,352],[925,355],[916,357],[910,361]]},
      {name:'ridge-black-north',pin:[1051,262],reach:2.2,points:[[1053,265],[1061,267],[1066,274],[1075,277],[1065,280],[1054,281]]},
      {name:'harbour-black-low',pin:[637,414],reach:2.8,points:[[639,418],[649,423],[655,429],[661,434],[654,438],[645,440],[638,444]]},
      {name:'harbour-black-middle',pin:[661,462],reach:2.4,points:[[663,465],[672,469],[680,472],[685,478],[677,480],[669,484],[662,485]]},
      {name:'harbour-black-west',pin:[598,452],reach:2.2,points:[[601,455],[609,458],[614,461],[621,464],[613,466],[601,470]]},
      {name:'harbour-black-upper',pin:[746,394],reach:2.1,points:[[748,397],[754,401],[762,401],[768,406],[760,410],[749,412]]},
      {name:'far-east-black',pin:[1408,318],reach:2.1,points:[[1410,321],[1417,325],[1425,326],[1428,331],[1417,333],[1410,338]]},
      {name:'far-centre-black',pin:[1190,315],reach:1.8,points:[[1192,318],[1199,321],[1206,322],[1209,327],[1199,329],[1192,332]]},
      {name:'far-centre-black-two',pin:[1227,325],reach:1.9,points:[[1229,328],[1237,330],[1244,336],[1236,340],[1230,341]]}
    );
    const boats = [
      { name:'left-junk', reach:23, rate:.62, phase:.4, points:[[225,408],[232,405],[234,392],[236,390],[241,391],[241,387],[243,389],[246,391],[247,406],[252,407],[252,397],[255,398],[256,407],[273,407],[270,412],[264,414],[240,414],[231,412]] },
      { name:'right-junk', reach:17, rate:.72, phase:2, points:[[464,430],[471,426],[473,416],[476,413],[479,415],[479,409],[481,411],[482,416],[486,417],[487,429],[495,430],[491,434],[474,436],[467,433]] },
      { name:'small-junk', reach:20, rate:.67, phase:3.4, points:[[398,404],[404,401],[405,390],[408,388],[410,390],[410,386],[412,388],[413,392],[416,392],[416,401],[424,402],[419,406],[406,407]] }
    ];
    const waterShapes = [
      [[165,346],[215,346],[255,341],[311,342],[360,345],[415,344],[457,349],[493,351],[483,356],[448,360],[409,357],[367,361],[315,360],[271,355],[222,356],[187,353]],
      [[0,391],[61,380],[111,372],[161,368],[212,369],[252,362],[309,365],[354,368],[393,365],[440,371],[477,376],[508,385],[545,389],[583,391],[621,395],[653,411],[633,426],[600,430],[562,426],[528,434],[501,439],[469,439],[440,436],[405,433],[375,433],[344,430],[310,431],[278,429],[246,429],[216,432],[190,432],[159,426],[121,426],[91,420],[60,423],[40,416],[10,414],[0,409]],
      [[0,506],[37,513],[68,512],[102,516],[134,520],[163,520],[178,525],[190,534],[216,534],[227,542],[247,538],[259,543],[273,544],[280,552],[293,553],[294,562],[271,571],[246,573],[226,581],[207,587],[182,588],[161,595],[132,597],[110,599],[84,609],[47,611],[31,619],[0,619]],
      [[0,635],[39,641],[64,635],[83,643],[112,645],[144,647],[178,644],[205,640],[230,641],[256,641],[285,643],[313,641],[341,645],[362,648],[378,656],[388,669],[398,681],[417,690],[437,702],[474,712],[482,725],[448,735],[418,735],[396,732],[377,721],[360,712],[343,706],[315,701],[293,689],[270,680],[241,680],[221,690],[213,706],[204,721],[184,727],[166,735],[149,736],[140,743],[125,747],[108,757],[96,764],[84,775],[64,780],[32,779],[0,785]],
      [[0,788],[32,786],[67,788],[99,781],[118,777],[145,775],[167,775],[195,775],[214,780],[239,783],[260,782],[278,777],[302,775],[329,778],[350,781],[373,787],[391,794],[401,806],[393,818],[374,818],[354,815],[334,815],[306,815],[288,821],[268,823],[246,830],[228,832],[207,829],[190,826],[173,829],[158,836],[135,842],[115,844],[89,851],[72,859],[50,865],[31,864],[18,858],[0,855]],
      [[0,859],[26,870],[43,871],[61,876],[75,880],[83,887],[0,887]],
      [[104,855],[124,852],[141,845],[154,844],[166,847],[188,841],[196,847],[195,866],[195,887],[169,887],[158,881],[142,883],[136,873],[118,872],[108,865]]
    ];
    const waterHoles = [
      [[50,642],[65,636],[78,641],[85,650],[74,656],[58,655]],
      [[315,744],[328,738],[345,741],[359,750],[374,753],[364,761],[341,765],[324,761],[310,757]],
      [[112,755],[131,738],[150,728],[169,727],[180,735],[185,748],[181,758],[164,767],[147,769],[133,766]],
      [[386,409],[395,405],[402,407],[413,408],[420,413],[411,416],[396,416]],
      [[327,426],[341,424],[353,425],[361,429],[348,432],[334,431]]
    ];
    // Land exclusions are geometric, not colour tests. Teal island rocks and
    // their warm mineral veins are not water or grass and never enter a warp.
    const terrainShapes = [
      [[166,735],[177,706],[190,691],[201,678],[216,669],[235,670],[242,652],[256,644],[271,650],[278,659],[295,665],[305,686],[319,687],[337,688],[356,685],[373,690],[384,701],[400,704],[414,714],[398,725],[379,727],[369,739],[390,739],[406,750],[388,760],[367,759],[350,766],[325,761],[303,759],[288,752],[267,754],[244,752],[219,754],[196,756],[172,759],[156,761]],
      [[170,717],[183,695],[205,679],[212,665],[232,658],[254,668],[277,686],[302,694],[322,696],[340,693],[360,703],[375,714],[396,719],[414,731],[391,744],[370,745],[350,750],[326,746],[306,748],[288,751],[273,748],[259,751],[236,751],[217,746],[200,749],[176,759],[153,763],[132,766],[117,762],[125,748],[146,735]],
      [[832,887],[855,844],[890,824],[936,824],[982,798],[1010,763],[1031,726],[1064,703],[1105,697],[1129,708],[1141,728],[1165,743],[1173,769],[1191,797],[1174,826],[1170,887]],
      [[0,618],[22,612],[43,609],[59,602],[79,601],[97,604],[108,611],[112,626],[94,636],[76,644],[48,640],[28,638],[0,643]],
      [[107,754],[127,738],[148,726],[170,725],[183,735],[189,751],[181,764],[162,773],[139,774],[120,768]],
      [[310,742],[326,733],[343,735],[362,744],[377,751],[380,760],[364,768],[339,769],[319,764],[305,757]]
    ];
    // Separate atmospheric layers: actual warm cloud pixels become alpha
    // silhouettes. Their edges travel through the scene instead of a fixed
    // polygon containing a moving rectangular texture.
    const cloudStonework = [[[1014,460],[1054,460],[1067,485],[1055,516],[1036,538],[1018,545],[999,548],[990,542]]];
    const cloudBanks = [
      {name:'portrait-valley-west',speed:8,travel:42,phase:1.2,points:[[846,556],[855,546],[868,542],[883,548],[898,552],[912,550],[928,546],[946,547],[951,559],[950,579],[946,598],[929,610],[907,600],[886,591],[866,580],[848,572]]},
      {name:'portrait-valley-east',speed:8.4,travel:48,phase:3.8,points:[[1005,541],[1018,536],[1032,538],[1048,536],[1063,528],[1077,536],[1090,542],[1104,542],[1119,536],[1133,535],[1148,543],[1161,542],[1175,533],[1186,526],[1199,532],[1211,536],[1225,538],[1238,530],[1248,534],[1254,550],[1247,567],[1230,577],[1214,582],[1197,577],[1186,583],[1171,579],[1152,580],[1134,585],[1118,581],[1104,591],[1085,590],[1069,579],[1055,574],[1043,564],[1026,560],[1008,553]]},
      {name:'upper-west',speed:9.5,travel:88,phase:0,points:[[54,163],[66,125],[103,112],[120,92],[148,100],[170,89],[186,73],[214,76],[219,51],[245,31],[280,42],[296,65],[304,84],[331,99],[360,110],[386,109],[412,128],[439,131],[466,150],[456,174],[418,176],[388,190],[364,210],[333,224],[299,222],[265,214],[235,194],[211,180],[192,179],[179,191],[169,184],[156,169],[134,164],[117,167],[105,188],[87,210],[70,213],[62,194]]},
      {name:'upper-west-tail',speed:8.8,travel:80,phase:.8,points:[[169,191],[200,191],[231,208],[264,217],[303,223],[332,217],[361,208],[388,206],[414,213],[445,212],[473,216],[491,229],[472,237],[444,230],[412,225],[383,226],[354,232],[322,237],[286,239],[252,233],[227,222],[204,218],[182,209]]},
      {name:'high-east',speed:8.2,travel:75,phase:1.4,points:[[1184,28],[1205,25],[1226,32],[1236,51],[1251,57],[1272,52],[1293,62],[1306,73],[1330,67],[1350,80],[1370,78],[1384,91],[1369,103],[1342,102],[1318,97],[1297,91],[1274,94],[1255,87],[1235,83],[1221,73],[1208,58],[1192,48]]},
      {name:'east-ridge-mist',speed:10,travel:92,phase:2.1,points:[[1439,118],[1462,131],[1470,150],[1464,174],[1448,191],[1440,210],[1423,222],[1397,231],[1378,225],[1368,219],[1345,217],[1323,228],[1298,228],[1271,225],[1245,211],[1238,199],[1254,183],[1281,172],[1301,180],[1324,190],[1348,190],[1376,182],[1402,171],[1419,155],[1422,136]]},
      {name:'north-centre',speed:6.8,travel:60,phase:2.7,points:[[777,107],[794,91],[813,92],[833,106],[855,106],[879,109],[891,123],[911,130],[934,143],[953,146],[979,154],[1002,153],[1022,161],[1048,162],[1067,173],[1047,183],[1019,179],[991,175],[968,174],[946,161],[919,158],[893,148],[867,143],[844,138],[819,138],[795,132],[781,123]]},
      {name:'middle-valley',speed:7.5,travel:62,phase:3.2,points:[[722,343],[745,328],[773,325],[791,307],[818,303],[841,287],[861,288],[882,275],[907,275],[922,281],[932,293],[954,295],[964,307],[948,322],[922,326],[898,327],[877,336],[854,344],[832,350],[810,353],[785,357],[764,367],[741,368],[721,359]]},
      {name:'eastern-low-mist',speed:8.4,travel:66,phase:4,points:[[1384,403],[1404,398],[1425,408],[1446,410],[1462,419],[1478,418],[1501,415],[1528,422],[1558,424],[1579,416],[1601,408],[1626,409],[1654,405],[1678,413],[1703,417],[1726,411],[1750,414],[1773,426],[1773,457],[1746,454],[1725,451],[1705,456],[1681,458],[1661,451],[1639,448],[1615,458],[1597,469],[1575,473],[1551,470],[1528,461],[1505,461],[1485,471],[1466,482],[1445,486],[1428,480],[1409,469],[1395,453],[1388,434]]},
      {name:'lower-east-valley',speed:8.1,travel:57,phase:4.7,points:[[1377,457],[1398,462],[1418,477],[1435,492],[1451,513],[1456,541],[1468,558],[1482,578],[1481,601],[1466,609],[1451,596],[1438,575],[1428,551],[1413,535],[1395,522],[1381,503],[1372,480]]},
      {name:'foreground-mist',speed:8.6,travel:68,phase:5.3,points:[[975,659],[997,655],[1014,666],[1035,672],[1059,674],[1080,683],[1099,682],[1120,691],[1141,710],[1151,733],[1173,739],[1197,729],[1215,732],[1221,753],[1209,776],[1191,787],[1173,782],[1159,765],[1141,757],[1121,747],[1104,729],[1082,723],[1056,730],[1035,744],[1016,750],[997,741],[981,727],[967,707],[958,681]]},
      {name:'foreground-west-mist',speed:7.8,travel:55,phase:6,points:[[819,763],[837,749],[854,750],[872,763],[892,768],[910,763],[929,771],[949,784],[957,805],[942,824],[921,838],[902,837],[883,826],[864,818],[841,819],[824,807],[812,788]]},
      {name:'central-harbour-mist',speed:7.4,travel:38,phase:1.7,points:[[585,376],[604,365],[619,361],[632,352],[646,350],[660,351],[673,359],[690,362],[705,356],[720,358],[736,351],[747,355],[761,363],[778,368],[789,376],[783,388],[767,390],[748,383],[733,386],[716,380],[698,388],[682,388],[670,383],[656,379],[639,378],[626,383],[611,382],[600,387],[585,386]]},
      {name:'western-valley-mist',speed:6.6,travel:36,phase:3.6,points:[[399,266],[411,253],[429,248],[441,249],[458,241],[476,240],[489,232],[506,234],[516,226],[530,226],[541,218],[551,214],[553,223],[544,234],[535,241],[529,253],[517,261],[505,266],[492,276],[476,280],[461,280],[447,290],[430,294],[412,288],[399,279]]}
    ];
    const plants = [
      {name:'central-ridge-west-crown',anchor:235,amount:1.4,mode:'crown',points:[[552,227],[555,223],[562,221],[568,221],[574,219],[580,220],[583,224],[589,225],[587,229],[577,230],[566,231],[556,232]]},
      {name:'central-ridge-crown',anchor:230,amount:1.4,mode:'crown',points:[[603,225],[608,222],[612,218],[620,219],[626,222],[634,225],[631,229],[620,228],[613,230],[606,228]]},
      {name:'central-summit-crown',anchor:161,amount:1.2,mode:'crown',points:[[724,153],[727,149],[734,149],[739,152],[744,152],[748,156],[744,159],[735,157],[728,159]]},
      {name:'central-ridge-north-crown',anchor:164,amount:1.4,mode:'crown',points:[[699,157],[701,151],[706,150],[710,153],[716,155],[716,160],[709,161],[703,161]]},
      {name:'central-ridge-east-crown',anchor:170,amount:1.5,mode:'crown',points:[[781,159],[786,153],[791,153],[797,155],[801,155],[807,160],[801,163],[795,166],[789,165],[786,169]]},
      {name:'central-ridge-far-crown',anchor:191,amount:1.5,mode:'crown',points:[[837,180],[842,174],[848,173],[850,167],[856,166],[862,170],[867,171],[873,176],[871,180],[862,182],[854,181],[849,188],[841,189]]},
      {name:'east-ridge-crown',anchor:171,amount:1.3,mode:'crown',points:[[900,162],[904,158],[913,157],[918,161],[926,161],[932,165],[928,169],[920,168],[910,169],[903,168]]},
      {name:'middle-hillside-crown',anchor:553,amount:1.9,mode:'crown',points:[[718,536],[723,530],[728,528],[730,521],[735,518],[739,523],[742,528],[748,529],[750,536],[743,540],[736,539],[732,546],[726,546],[721,542]]},
      {name:'middle-west-crown',anchor:552,amount:1.7,mode:'crown',points:[[657,540],[661,533],[668,530],[673,531],[678,535],[680,541],[676,546],[668,547],[663,544]]},
      {name:'middle-low-crown',anchor:583,amount:2,mode:'crown',points:[[690,567],[694,560],[702,557],[706,561],[711,561],[717,565],[721,571],[716,576],[708,578],[701,575],[695,578],[690,575]]},
      {name:'left-tree',anchor:313,amount:3.6,mode:'tree',points:[[8,257],[25,249],[39,246],[48,251],[62,249],[71,258],[81,268],[71,276],[81,284],[65,291],[48,288],[38,302],[20,305],[4,293],[0,284]]},
      {name:'island-tree',anchor:699,amount:2.2,mode:'crown',points:[[322,677],[327,672],[331,672],[332,667],[338,665],[343,669],[350,670],[353,676],[349,680],[342,678],[336,681],[330,679],[325,681]]},
      {name:'left-bank-tree',anchor:633,amount:3.6,mode:'tree',points:[[93,613],[108,600],[125,599],[135,601],[146,613],[144,625],[127,630],[112,627],[101,630]]},
      {name:'grass-centre',anchor:886,amount:6.2,mode:'grass',points:[[982,849],[1009,819],[1030,789],[1056,774],[1085,772],[1110,760],[1132,763],[1155,779],[1179,777],[1202,786],[1225,805],[1246,812],[1267,840],[1283,878],[1286,887],[974,887]]},
      {name:'grass-right',anchor:887,amount:7.2,mode:'grass',points:[[1172,856],[1194,827],[1206,796],[1230,755],[1251,737],[1284,721],[1310,710],[1346,705],[1374,700],[1398,685],[1420,685],[1440,707],[1452,737],[1477,758],[1501,767],[1514,796],[1539,804],[1565,827],[1577,858],[1595,887],[1165,887]]},
      {name:'grass-far-right',anchor:887,amount:7.4,mode:'grass',points:[[1537,880],[1540,841],[1549,796],[1572,751],[1592,728],[1617,711],[1641,700],[1662,710],[1680,736],[1702,741],[1720,729],[1742,723],[1773,746],[1773,887]]},
      {name:'grass-lower-middle',anchor:887,amount:5.5,mode:'grass',points:[[798,884],[810,855],[820,827],[839,804],[853,797],[874,797],[891,811],[911,832],[926,851],[945,873],[950,887]]}
    ];

    const inside = (x,y,poly) => {
      let yes=false;
      for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
        const a=poly[i],b=poly[j];
        if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
      }
      return yes;
    };
    const maskFor = points => {
      const surface=document.createElement('canvas');surface.width=width;surface.height=height;
      const ctx=surface.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();
      points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x*width/1774,y*height/887));ctx.closePath();ctx.fill();
      const rgba=ctx.getImageData(0,0,width,height).data,mask=new Uint8Array(width*height);
      for(let p=0;p<mask.length;p++) mask[p]=rgba[p*4+3];
      return mask;
    };
    const makeFields = original => {
      const water=new Uint8Array(width*height),cloud=new Uint8Array(width*height),active=[];
      for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
        const p=y*width+x,o=p*4,px=(x+.5)*1774/width,py=(y+.5)*887/height;
        const r=original[o],g=original[o+1],b=original[o+2];
        // Both membership and source sampling must stay in the same material.
        // Cool shoreline rocks are excluded by traced holes, not a colour guess.
        if(waterShapes.some(poly=>inside(px,py,poly)) && !waterHoles.some(poly=>inside(px,py,poly)) && !terrainShapes.some(poly=>inside(px,py,poly)) && g>r*1.005 && b>r*.86) water[p]=255;
        if(water[p])active.push(p);
      }
      return {water,cloud,active:Uint32Array.from(active)};
    };
    const makeObjects = original => {
      const specs=[...flags.map((v,i)=>({...v,type:'flag',phase:i*.73})),...boats.map(v=>({...v,type:'boat'})),...plants.map((v,i)=>({...v,type:'plant',phase:i*.81}))];
      const union=new Uint8Array(width*height);
      objects=specs.map(spec=>{
        const mask=maskFor(spec.points);
        for(const part of spec.parts||[]){const extra=maskFor(part);for(let p=0;p<mask.length;p++)mask[p]=max(mask[p],extra[p]);}
        for(const hole of spec.holes||[]){const cut=maskFor(hole);for(let p=0;p<mask.length;p++)mask[p]=round(mask[p]*(1-cut[p]/255));}
        const outline=mask.slice();
        let x0=width,y0=height,x1=0,y1=0;
        for(let p=0;p<mask.length;p++) {
          if(spec.type==='flag'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Refine the traced silhouette against cloth colour: the cutout
            // must not carry teal mountain pixels through ribbon gaps.
            const black=spec.name.includes('black')||spec.name.includes('portrait');
            const cloth=black ? r>=g*.86 && b<=g*1.10 : r>=g*.975 && g>=b*1.035;
            const x=p%width,y=floor(p/width);
            const interior=x>0&&x<width-1&&y>0&&y<height-1 &&
              outline[p-1]>240&&outline[p+1]>240&&outline[p-width]>240&&outline[p+width]>240;
            // The printed portrait/map and cool folds inside the cloth travel
            // with it; colour refinement applies only at the contour edge.
            if(!cloth&&!interior)mask[p]=0;
          }
          if(spec.type==='boat'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Water between mast, sail and hull is transparent, too.
            if(r<g*.97 || g<b*1.035)mask[p]=0;
          }
          if(spec.type==='plant'&&mask[p]) {
            const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
            // Plant colours inside manually delimited crowns/blade clusters.
            // Teal rocks are explicitly rejected by the grass selector.
            const px=(p%width+.5)*1774/width,py=(floor(p/width)+.5)*887/height;
            const allowed=spec.mode==='grass' ? r>b*1.28 && g>b*1.14 && r>100 && !terrainShapes.some(poly=>inside(px,py,poly)) : spec.mode==='crown' ? r<145 && g<151 && g>r*.99 && g<r*1.24 && b<g*1.01 : g>r*1.05 && g>b*.94 && r<150;
            if(!allowed||union[p])mask[p]=0;
          }
          if(mask[p]){const x=p%width,y=floor(p/width);x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y);union[p]=max(union[p],mask[p]);}
        }
        const w=x1-x0+1,h=y1-y0+1;
        const sprite=document.createElement('canvas');sprite.width=w;sprite.height=h;
        const painter=sprite.getContext('2d'),pixels=painter.createImageData(w,h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const p=(y0+y)*width+x0+x,o=p*4,d=(y*w+x)*4;
          pixels.data[d]=still[o];pixels.data[d+1]=still[o+1];pixels.data[d+2]=still[o+2];pixels.data[d+3]=mask[p];
        }
        painter.putImageData(pixels,0,0);
        return {...spec,mask,sprite,x0,y0,w,h};
      });
      clouds=cloudBanks.map((spec,index)=>{
        let mask=maskFor(spec.points);const traced=mask.slice();
        const highCloud=['upper-west','upper-west-tail','high-east','east-ridge-mist','north-centre'].includes(spec.name);
        if(highCloud){
          // Include the small bright lobes at the edge of a painted cloud. The
          // tracing is a spatial guard, not a hard crop through its outer edge.
          const radius=max(1,round(18*width/1774));
          for(let pass=0;pass<radius;pass++){
            const expanded=mask.slice();
            for(let p=0;p<mask.length;p++)if(mask[p]){
              const x=p%width,y=floor(p/width);
              if(x)expanded[p-1]=max(expanded[p-1],mask[p]);if(x<width-1)expanded[p+1]=max(expanded[p+1],mask[p]);
              if(y)expanded[p-width]=max(expanded[p-width],mask[p]);if(y<height-1)expanded[p+width]=max(expanded[p+width],mask[p]);
            }
            mask=expanded;
          }
        }
        let x0=width,y0=height,x1=0,y1=0,count=0;
        for(let p=0;p<mask.length;p++)if(mask[p]){
          const o=p*4,r=original[o],g=original[o+1],b=original[o+2];
          const px=(p%width+.5)*1774/width,py=(floor(p/width)+.5)*887/height;
          // Cool mountain pigment, poles, cloth and dark vegetation are never
          // copied into a cloud. Warm light, not a rectangular crop, is its alpha.
          const warmth=smooth((r-g+(highCloud?3:9))/(highCloud?12:15))*smooth((g-b-5)/15);
          const luminance=smooth((r-(highCloud?155:132))/40);
          mask[p]=union[p]||(!traced[p]&&r<200)||terrainShapes.some(poly=>inside(px,py,poly))||cloudStonework.some(poly=>inside(px,py,poly))?0:round(mask[p]*warmth*luminance);
          if(mask[p]){const x=p%width,y=floor(p/width);x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y);count++;}
        }
        const w=max(1,x1-x0+1),h=max(1,y1-y0+1),sprite=document.createElement('canvas');sprite.width=w;sprite.height=h;
        const painter=sprite.getContext('2d'),pixels=painter.createImageData(w,h);
        if(count)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const p=(y0+y)*width+x0+x,o=p*4,d=(y*w+x)*4;
          pixels.data[d]=still[o];pixels.data[d+1]=still[o+1];pixels.data[d+2]=still[o+2];pixels.data[d+3]=mask[p];
          // A soft alpha belongs on the travelling silhouette only. Keeping
          // the inverse alpha in its old footprint leaves a stationary cloud
          // outline underneath, so remove the old cloud completely here.
          if(mask[p]>7)union[p]=255;
        }
        painter.putImageData(pixels,0,0);
        return {...spec,mask,sprite,x0,y0,w,h,count};
      });
      // Recover only newly exposed sprite footprints. The surrounding painting
      // is immutable. A nearest-background field is prepared once, never warped.
      const nearest=new Int32Array(width*height);nearest.fill(-1);
      const queue=new Int32Array(width*height);let read=0,write=0;
      for(let p=0;p<union.length;p++) if(!union[p]){nearest[p]=p;queue[write++]=p;}
      while(read<write){
        const p=queue[read++],x=p%width,y=floor(p/width);
        for(const n of [x?p-1:-1,x<width-1?p+1:-1,y?p-width:-1,y<height-1?p+width:-1]) if(n>=0&&nearest[n]<0){nearest[n]=nearest[p];queue[write++]=n;}
      }
      const recover=[];
      for(let p=0;p<union.length;p++)if(union[p]){
        const a=union[p]/255,o=p*4,n=nearest[p]*4;
        for(let c=0;c<3;c++)base[o+c]=still[o+c]*(1-a)+still[n+c]*a;
        if(p%width>0&&p%width<width-1&&p>=width&&p<width*(height-1))recover.push(p);
      }
      // Diffuse the one-time uncovered plate inside the alpha footprints only.
      // Nearest-edge extension on its own makes long vertical streaks whenever
      // a large cloud or flag reveals its former location.
      let diffusion=Float32Array.from(base),next=diffusion.slice();
      for(let pass=0;pass<72;pass++){
        for(const p of recover){
          const o=p*4,a=union[p]/255;
          for(let c=0;c<3;c++)next[o+c]=((diffusion[o-4+c]+diffusion[o+4+c]+diffusion[o-width*4+c]+diffusion[o+width*4+c])*.25)*a+base[o+c]*(1-a);
        }
        const swap=diffusion;diffusion=next;next=swap;
      }
      for(const p of recover)for(let c=0;c<3;c++)base[p*4+c]=diffusion[p*4+c];
      // Keep a data-only inspection hook in offline tests; absent in the site.
      if(typeof window.__coverAudit==='function')window.__coverAudit({width,height,fields,objects,clouds,union,base:base.slice(),still:still.slice(),render(seconds){elapsed=seconds*1000;draw();},renderObject(name,seconds){context.fillStyle='#000';context.fillRect(0,0,width,height);drawObjects(seconds,name);},renderWater(seconds){const pixels=frame.data;pixels.set(base);drawWater(pixels,seconds);context.putImageData(frame,0,0);},renderClouds(seconds){const plate=context.createImageData(width,height);plate.data.set(base);context.putImageData(plate,0,0);drawClouds(seconds);},pause:stop});
    };
    const materialPixel = (data,p,mask,sx,sy) => {
      if(sx<0||sy<0||sx>=width-1||sy>=height-1)return;
      const ix=floor(sx),iy=floor(sy),q=iy*width+ix;
      if(!mask[q]||!mask[q+1]||!mask[q+width]||!mask[q+width+1])return;
      const fx=sx-ix,fy=sy-iy,o=p*4,a=q*4,b=a+4,c=a+width*4,d=c+4;
      for(let channel=0;channel<3;channel++)data[o+channel]=(base[a+channel]*(1-fx)+base[b+channel]*fx)*(1-fy)+(base[c+channel]*(1-fx)+base[d+channel]*fx)*fy;
    };
    const drawClouds = t => {
      context.imageSmoothingEnabled=true;
      // Two phase-shifted silhouettes crossfade at zero alpha. The wind always
      // travels in one direction; no visible reset, reversal or stationary edge.
      for(const cloud of clouds){
        if(!cloud.count)continue;
        const travel=cloud.travel*width/1774,speed=cloud.speed*width/1774;
        for(let copy=0;copy<2;copy++){
          const phase=((t*speed/(2*travel)+cloud.phase*.12+copy*.5)%1+1)%1;
          context.globalAlpha=pow(sin(phase*Math.PI),2);
          const dx=(phase-.5)*2*travel,dy=sin(phase*Math.PI*2+cloud.phase)*height/887*2.8;
          context.drawImage(cloud.sprite,cloud.x0+dx,cloud.y0+dy);
        }
      }
      context.globalAlpha=1;context.imageSmoothingEnabled=false;
    };
    const drawObjects = (t,onlyName) => {
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='low';
      const scale=width/640;
      for(const object of objects){
        if(onlyName&&object.name!==onlyName)continue;
        // The same travelling gust reaches flags and vegetation, with slower,
        // damped branches and faster cloth ripples; roots and hoists stay fixed.
        const gust=.93+.19*sin(t*1.19-object.x0*.006)+.11*sin(t*2.31-object.x0*.004);
        if(object.type==='flag'){
          const pin=object.pin[0]*width/1774-object.x0;
          // Attached edge remains anchored. The cloth is sliced from an alpha
          // silhouette; no source image/background can enter these wave strips.
          for(let x=0;x<object.w;x++){
            const free=clamp((x-pin)/max(1,object.w-pin)),weight=pow(free,.86);
            const wave=sin(t*6.1-free*5.8+object.phase),ripple=sin(t*10.9-free*9+object.phase);
            const dy=weight*object.reach*scale*gust*(wave+.23*ripple);
            const dx=weight*1.1*scale*sin(t*4.7-free*4+object.phase);
            context.drawImage(object.sprite,x,0,1,object.h,object.x0+x+dx,object.y0+dy,1.12,object.h);
          }
        }else if(object.type==='boat'){
          const phase=t*object.rate+object.phase,x=object.x0+object.reach*scale*sin(phase),y=object.y0+scale*(1.4*sin(phase*2)+.48*sin(t*5.1+object.phase));
          context.drawImage(object.sprite,x,y);
        }else{
          const anchor=object.anchor*height/887-object.y0;
          for(let y=0;y<object.h;y++){
            const weight=pow(clamp((anchor-y)/max(1,anchor)),1.18);
            const branch=object.mode!=='grass';
            const dx=weight*object.amount*scale*gust*(.48+.62*sin(t*(branch?1.8:3.4)-y*.035+object.phase)+.17*sin(t*(branch?3.1:7.3)+object.phase));
            context.drawImage(object.sprite,0,y,object.w,1,object.x0+dx,object.y0+y,object.w,1.12);
          }
        }
      }
      context.imageSmoothingEnabled=false;
    };
    const drawWalkers = seconds => {
      const walkers=[
        {from:[.611,.525],to:[.59,.579],duration:5.5,offset:0},
        {from:[.207,.795],to:[.249,.812],duration:7,offset:.52},
        {from:[.284,.826],to:[.303,.862],duration:6.5,offset:1.4},
        {from:[.453,.72],to:[.477,.74],duration:7.8,offset:2.2}
      ];
      for(const walker of walkers){
        const phase=seconds/walker.duration*Math.PI+walker.offset,progress=(1-cos(phase))/2,direction=sin(phase)<0?-1:1;
        const x=round((walker.from[0]+(walker.to[0]-walker.from[0])*progress)*width),y=round((walker.from[1]+(walker.to[1]-walker.from[1])*progress)*height),stride=floor(seconds*7.4+walker.offset)%2;
        context.fillStyle='#a5aaa0';context.fillRect(x,y-3,1,1);
        context.fillStyle='#343d3d';context.fillRect(x,y-2,1,2);
        context.fillStyle='#434c4a';context.fillRect(x-direction*stride,y,1,1);context.fillRect(x+direction*stride,y-1,1,1);
      }
    };
    const drawWater = (data,t) => {
        for(const p of fields.active){
          const x=p%width,y=floor(p/width);
          if(fields.water[p]){
            materialPixel(data,p,fields.water,x+3.5*sin(t*4.3+y*.49),y+.82*sin(t*3.1+x*.08));
            // Fast current is confined per pixel to water, including its glints.
            const glint=pow(max(0,sin(x*.24-y*.9-t*5.8)),18)*3.4;
            for(let c=0;c<3;c++)data[p*4+c]+=glint;
          }
        }
    };
    const draw = () => {
      if(!ready)return;
      if(!base){context.filter='grayscale(20%) saturate(75%) brightness(82%)';context.drawImage(buffer,0,0);context.filter='none';return;}
      const data=frame.data;data.set(reducedMotion.matches?still:base);
      if(!reducedMotion.matches){
        const t=elapsed/1000;
        drawWater(data,t);
      }
      context.putImageData(frame,0,0);
      if(!reducedMotion.matches){drawClouds(elapsed/1000);drawObjects(elapsed/1000);drawWalkers(elapsed/1000);}
    };
    const stop=()=>{if(timer)window.clearTimeout(timer);timer=0;lastTime=0;};
    const tick=()=>{
      timer=0;if(!visible()||reducedMotion.matches||!base){lastTime=0;return;}
      const now=performance.now();if(lastTime)elapsed+=min(200,now-lastTime);lastTime=now;
      draw();timer=window.setTimeout(tick,interval);
    };
    const sync=()=>{stop();if(!visible())return;if(context.isContextLost?.()){canvas.hidden=true;return;}try{draw();canvas.hidden=false;}catch{canvas.hidden=true;return;}if(!reducedMotion.matches&&base){lastTime=performance.now();timer=window.setTimeout(tick,interval);}};
    image.addEventListener('load',async()=>{
      // Safari may dispatch load before a usable decoded surface is available.
      // Keep the original image visible until actual pixels have been checked.
      try{if(image.decode)await image.decode();}catch{canvas.hidden=true;entry.dataset.coverReady='fallback';return;}
      const scale=min(800/image.naturalWidth,400/image.naturalHeight,1);
      width=canvas.width=max(1,round(image.naturalWidth*scale));height=canvas.height=max(1,round(image.naturalHeight*scale));
      buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;
      const source=buffer.getContext('2d',{willReadFrequently:true});if(!source)return;
      source.imageSmoothingEnabled=true;source.imageSmoothingQuality='high';source.drawImage(image,0,0,width,height);
      try{
        frame=source.getImageData(0,0,width,height);const original=frame.data.slice();
        let lit=0,opaque=0,samples=0;
        for(let p=0;p<original.length;p+=256){samples++;if(original[p+3]>128)opaque++;if(original[p]+original[p+1]+original[p+2]>90)lit++;}
        if(opaque<samples*.9||lit<samples*.8)throw new Error('Cover image has no decoded painting');
        fields=makeFields(original);base=new Uint8ClampedArray(frame.data.length);const data=frame.data;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const o=(y*width+x)*4,light=.2126*data[o]+.7152*data[o+1]+.0722*data[o+2],grain=(bayer[(y&3)*4+(x&3)]-7.5)*.9;
          const nx=(x/width-.5)*2,ny=(y/height-.5)*2,vignette=1-.12*(nx*nx+ny*ny)/2,tone=round((pow(light/255,1.08)*218+grain)/8)*8;
          base[o]=(tone*.94+(data[o]-light)*.65)*vignette;base[o+1]=(tone*.98+(data[o+1]-light)*.65)*vignette;base[o+2]=(tone*1.025+(data[o+2]-light)*.65)*vignette;base[o+3]=255;
        }
        still=base.slice();makeObjects(original);
      }catch{base=null;ready=false;canvas.hidden=true;entry.dataset.coverReady='fallback';return;}
      ready=true;sync();entry.dataset.coverReady='true';
    },{once:true});
    image.addEventListener('error',()=>{stop();canvas.hidden=true;if(fallback)fallback.hidden=false;},{once:true});
    // A transparent canvas leaves the decoded original underneath if the GPU
    // surface is discarded. Restore the complete frame before revealing it.
    if(fallback)fallback.hidden=false;
    canvas.addEventListener('contextlost',event=>{event.preventDefault();stop();canvas.hidden=true;});
    canvas.addEventListener('contextrestored',()=>{sync();});
    new MutationObserver(sync).observe(entry,{attributes:true,attributeFilter:['hidden','class','style']});
    if('IntersectionObserver'in window)new IntersectionObserver(([o])=>{inView=o.isIntersecting;sync();}).observe(entry);
    document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',sync);
    if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',sync);else reducedMotion.addListener(sync);
    image.src=fallback?.getAttribute('src')||'assets/media/cover.png';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
