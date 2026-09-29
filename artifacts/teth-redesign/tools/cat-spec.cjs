// 20종의 행동 정의. 성과를 보기 전에 행동으로 정한 값이다(결과에 맞춰 다시 고르지 않는다).
const UNI={
 coin8:{label:'가상자산 8종',list:['비트코인','이더리움','솔라나','리플','도지코인','에이다','아발란체','비앤비']},
 tech8:{label:'미국 기술주 8종',list:['엔비디아','테슬라','애플','마이크로소프트','아마존','메타','알파벳','에이엠디']},
 macro6:{label:'지수, 금, 주식, 가상자산 6종',list:['나스닥','S&P 500','금','비트코인','이더리움','엔비디아']},
 big3:{label:'가상자산 대표 3종',list:['비트코인','이더리움','솔라나']},
 idx3:{label:'지수와 금 3종',list:['나스닥','S&P 500','금']}
};
const NEWPX={'에이다':[0.85,[2,4],.085],'아발란체':[30,[1.8,4],.09],'비앤비':[1000,[2.5,4.5],.055],'마이크로소프트':[510,[1.7,2.4],.032],'아마존':[225,[2,2.8],.04],'메타':[740,[4,6.5],.045],'알파벳':[245,[2.2,3],.038],'에이엠디':[160,[1.8,2.8],.065]};
const LIST=[
 {id:'d1',kind:'agent',uni:'coin8',c:{look:20,top:3,gate:.4,every:5,trail:12,volT:.03,minS:.4,startI:400},ex:'binance'},
 {id:'r1',kind:'rule',from:10,ex:'okx'},
 {id:'h1',kind:'mix',uni:'tech8',c:{every:20,look:40,rsiTh:50,tp:10,sl:-5,gate:.4,startI:300},ex:'bitget'},
 {id:'r2',kind:'rule',from:2,ex:'okx'},
 {id:'d2',kind:'agent',uni:'macro6',c:{look:60,top:2,gate:.5,every:20,trail:10,volT:.03,minS:.4,startI:200},ex:'bitget'},
 {id:'r3',kind:'rule',from:6,ex:'bitget'},
 {id:'h2',kind:'mix',uni:'coin8',c:{every:10,look:60,rsiTh:45,tp:15,sl:-8,gate:.4,startI:400},ex:'binance'},
 {id:'d3',kind:'agent',uni:'coin8',c:{look:10,top:1,gate:.5,every:1,trail:8,volT:.02,minS:.4,startI:600},ex:'okx'},
 {id:'r4',kind:'rule',from:4,ex:'okx'},
 {id:'d4',kind:'agent',uni:'tech8',c:{look:40,top:3,gate:.4,every:5,trail:12,volT:.02,minS:.4,startI:300},ex:'binance'},
 {id:'h3',kind:'mix',uni:'idx3',c:{every:20,look:60,rsiTh:50,tp:5,sl:-3,gate:.34,startI:61},ex:'binance'},
 {id:'r5',kind:'rule',from:5,ex:'binance'},
 {id:'r6',kind:'rule',from:3,ex:'bitget'},
 {id:'d5',kind:'agent',uni:'tech8',c:{look:20,top:2,gate:.7,every:5,trail:10,volT:.02,minS:.4,startI:500},ex:'okx'},
 {id:'h4',kind:'mix',uni:'macro6',c:{every:10,look:40,rsiTh:45,tp:8,sl:-5,gate:.5,startI:200},ex:'okx'},
 {id:'r7',kind:'rule',from:9,ex:'bitget'},
 {id:'d6',kind:'agent',uni:'big3',c:{look:40,top:1,gate:.34,every:10,trail:15,volT:.03,minS:.4,startI:300},ex:'bitget'},
 {id:'r8',kind:'rule',from:15,ex:'okx'},
 {id:'h5',kind:'mix',uni:'big3',c:{every:20,look:60,rsiTh:40,tp:12,sl:-5,gate:0,startI:600},ex:'binance'},
 {id:'r9',kind:'rule',from:20,ex:'binance'}
];
module.exports={UNI,NEWPX,LIST};
