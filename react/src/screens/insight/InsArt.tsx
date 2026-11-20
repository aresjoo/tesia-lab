// 인사이트 그림: 글 머리 그림(tfInsArt), 본문 개념도(tfInsFig), 저자 얼굴(tfInsAvatar), 자산 표시(tfAssetIcon), 공유 글리프.
// 원본의 SVG 문자열을 같은 좌표와 색 그대로 옮겼다. defs 의 id 는 그리는 자리마다 다르게 낸다.
import { Fragment, useId, type ReactNode } from 'react';
import { tfIns2AuOf } from '../../core/insight/insight';

const uid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** tfInsArt(k,ratio) */
export function InsArt({ k, ratio }: { k: string; ratio: 'hero' | 'wide' | 'tall' }) {
  const u = 'za' + uid(useId());
  const W = 800;
  const H = ratio === 'hero' ? 440 : ratio === 'wide' ? 356 : 494;
  const cy = H / 2;
  const grid = (col: string, op: number) => {
    const g: ReactNode[] = [];
    for (let i = 40; i < W; i += 76) g.push(<line key={'g' + i} x1={i} y1="0" x2={i} y2={H} stroke={col} strokeOpacity={op} strokeWidth="1" />);
    return g;
  };
  let body: ReactNode;
  if (k === 'btc') {
    const rings: ReactNode[] = [];
    for (let r = 210; r >= 60; r -= 38) rings.push(<ellipse key={r} cx="560" cy={cy} rx={r} ry={r * 0.82} fill="none" stroke="#2952E8" strokeOpacity={0.16 + ((210 - r) / 210) * 0.5} strokeWidth="1.5" />);
    const tiles = [
      [60, 60, 26],
      [130, 120, 18],
      [90, 220, 22],
      [170, 300, 15],
      [60, 360, 20],
      [230, 80, 13],
      [250, 210, 17],
      [300, 330, 12],
      [330, 150, 11],
    ];
    body = (
      <>
        <rect width={W} height={H} fill="#0d1220" />
        {grid('#2952E8', 0.1)}
        {rings}
        {tiles.map((t, i) => (
          <rect key={i} x={t[0]} y={t[1]} width={t[2]} height={t[2]} fill="#717682" opacity={0.75 - i * 0.055} transform={`rotate(${i * 7 - 14} ${t[0] + t[2] / 2} ${t[1] + t[2] / 2})`} />
        ))}
        <path d={`M 90 ${cy - 6} C 300 ${cy - 60},430 ${cy - 30},498 ${cy}`} stroke="#717682" strokeOpacity=".5" fill="none" strokeWidth="1.4" />
        <path d={`M 120 ${cy + 90} C 300 ${cy + 70},430 ${cy + 34},500 ${cy + 8}`} stroke="#717682" strokeOpacity=".35" fill="none" strokeWidth="1.4" />
        <circle cx="560" cy={cy} r="52" fill="#F7931A" />
        <circle cx="560" cy={cy} r="52" fill="none" stroke="#0d1220" strokeWidth="3" />
        <text x="560" y={cy + 13} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="40" fill="#0d1220">
          ₿
        </text>
      </>
    );
  } else if (k === 'bond') {
    body = (
      <>
        <rect width={W} height={H} fill="#161922" />
        {range(9).map((b1) => (
          <line key={b1} x1={120 + b1 * 70} y1={H - 40} x2={120 + b1 * 70} y2={H - 40 - ((b1 < 5 ? b1 : 9 - b1) * 26 + 30)} stroke="#4A5060" strokeWidth="2" />
        ))}
        <path d={`M 70 ${H - 70} C 260 ${H - 200}, 420 60, 520 96 C 590 122, 660 ${H * 0.62}, 748 ${H * 0.7}`} fill="none" stroke="#D9A84E" strokeWidth="4" strokeLinecap="round" />
        <circle cx="520" cy="96" r="7" fill="#D9A84E" />
        <line x1="60" y1={H - 40} x2={W - 40} y2={H - 40} stroke="#DCE0E8" strokeOpacity=".4" strokeWidth="1.5" />
        <text x="86" y="70" fontFamily="Georgia,serif" fontSize="120" fill="#DCE0E8" opacity=".08" fontStyle="italic">
          %
        </text>
      </>
    );
  } else if (k === 'power') {
    const racks: ReactNode[] = [];
    for (let rr = 0; rr < 5; rr++)
      for (let cc = 0; cc < 3; cc++) {
        const rx = 54 + cc * 74;
        const ry = 44 + rr * 72;
        racks.push(<rect key={`r${rr}-${cc}`} x={rx} y={ry} width="58" height="54" fill="#1c2029" stroke="#4A5060" strokeWidth="1" />);
        for (let sl = 0; sl < 4; sl++) racks.push(<rect key={`s${rr}-${cc}-${sl}`} x={rx + 8} y={ry + 8 + sl * 11} width="42" height="4" fill="#4A5060" opacity=".8" />);
      }
    body = (
      <>
        <rect width={W} height={H} fill="#111318" />
        {racks}
        <polygon points={`300,${cy - 120} 470,${cy - 26} 470,${cy + 26} 300,${cy + 120}`} fill="#E5A93C" opacity=".14" />
        <polyline points={`310,${cy} 420,${cy - 34} 400,${cy} 500,${cy - 22} 480,${cy + 8} 560,${cy - 8}`} fill="none" stroke="#E5A93C" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="640" cy={cy} r="64" fill="none" stroke="#4A5060" strokeWidth="2" />
        <path d={`M 640 ${cy - 64} A 64 64 0 0 1 700 ${cy + 18}`} fill="none" stroke="#E5A93C" strokeWidth="6" strokeLinecap="round" />
        <line x1="600" y1={cy} x2="676" y2={cy - 30} stroke="#DCE0E8" strokeWidth="3" strokeLinecap="round" />
      </>
    );
  } else if (k === 'eth') {
    const shards = [
      [170, 90, 44, -12],
      [330, 60, 52, 8],
      [500, 100, 40, -6],
      [620, 66, 48, 14],
    ];
    body = (
      <>
        <rect width={W} height={H} fill="#0E1424" />
        <rect x="70" y={H - 110} width="660" height="46" fill="#1a2338" stroke="#3A445C" />
        <text x="92" y={H - 81} fontFamily="Consolas,monospace" fontSize="15" fill="#5B8AF7" opacity=".8">
          L1 SETTLEMENT
        </text>
        {shards.map((sh, i) => {
          const [px, py, pr] = sh;
          return (
            <Fragment key={i}>
              <polygon
                points={`${px},${py - pr} ${px + pr * 0.87},${py - pr * 0.5} ${px + pr * 0.87},${py + pr * 0.5} ${px},${py + pr} ${px - pr * 0.87},${py + pr * 0.5} ${px - pr * 0.87},${py - pr * 0.5}`}
                fill="#17203a"
                stroke="#5B8AF7"
                strokeWidth="1.6"
                transform={`rotate(${sh[3]} ${px} ${py})`}
              />
              <line x1={px} y1={py + pr} x2={px} y2={H - 110} stroke="#5B8AF7" strokeOpacity=".4" strokeWidth="1.4" strokeDasharray="3 5" />
              <circle cx={px} cy={H - 110} r="4" fill="#5B8AF7" />
            </Fragment>
          );
        })}
      </>
    );
  } else if (k === 'jpy') {
    body = (
      <>
        <rect width={W} height={H} fill="#14171F" />
        {grid('#D2D6DE', 0.05)}
        <polygon points={`60,${H - 40} 350,60 410,110 150,${H - 40}`} fill="#8A2B2B" opacity=".85" />
        <polygon points={`470,40 740,${H - 70} 640,${H - 40} 430,120`} fill="#D2D6DE" opacity=".16" />
        {range(7).map((j) => (
          <line key={j} x1={388 + j * 10} y1={96 + j * 22} x2={428 + j * 10} y2={88 + j * 22} stroke="#D2D6DE" strokeOpacity=".5" strokeWidth="1.2" />
        ))}
        <text x="560" y={cy + 58} textAnchor="middle" fontFamily="Georgia,serif" fontSize="170" fill="none" stroke="#D2D6DE" strokeOpacity=".7" strokeWidth="2">
          ¥
        </text>
      </>
    );
  } else if (k === 'stable') {
    const gates = [
      [190, 64],
      [330, 96],
      [470, 52],
      [610, 110],
    ];
    body = (
      <>
        <rect width={W} height={H} fill="#141c30" />
        {range(4).map((w2) => {
          const wy = H - 60 - w2 * 30;
          return <path key={w2} d={`M 110 ${wy} Q 210 ${wy - 12} 310 ${wy} T 510 ${wy} T 710 ${wy}`} fill="none" stroke="#3DBA8C" strokeOpacity={0.9 - w2 * 0.2} strokeWidth="2.4" />;
        })}
        <rect x="110" y={H - 56} width="600" height="30" fill="#3DBA8C" opacity=".14" />
        <line x1="80" y1="60" x2="80" y2={H - 26} stroke="#637089" strokeWidth="2" />
        {range(8).map((m3) => (
          <line key={m3} x1="70" y1={70 + m3 * 38} x2="90" y2={70 + m3 * 38} stroke="#637089" strokeWidth="1.6" />
        ))}
        {gates.map((g2, i) => (
          <Fragment key={i}>
            <rect x={g2[0]} y="30" width="52" height={g2[1]} fill="#1d2947" stroke="#637089" />
            <rect x={g2[0] + 18} y={g2[1] + 30} width="16" height="26" fill="#3DBA8C" opacity=".8" />
          </Fragment>
        ))}
      </>
    );
  } else if (k === 'gold') {
    const gx = 230;
    const gy = cy;
    body = (
      <>
        <rect width={W} height={H} fill="#0f1012" />
        <line x1={W / 2} y1="20" x2={W / 2} y2={H - 20} stroke="#DCE0E8" strokeOpacity=".25" strokeWidth="1.5" />
        <polygon points={`${gx},${gy - 84} ${gx + 76},${gy - 40} ${gx + 76},${gy + 48} ${gx},${gy + 92} ${gx - 76},${gy + 48} ${gx - 76},${gy - 40}`} fill="#C89B3C" />
        <polygon points={`${gx},${gy - 84} ${gx + 76},${gy - 40} ${gx},${gy + 4} ${gx - 76},${gy - 40}`} fill="#E0BA62" />
        <polygon points={`${gx},${gy + 4} ${gx + 76},${gy - 40} ${gx + 76},${gy + 48} ${gx},${gy + 92}`} fill="#9a7527" />
        {range(10).map((p4) => (
          <rect key={p4} x="500" y={cy - 70 + p4 * 15} width="200" height="8" rx="2" fill="none" stroke="#3A4A3F" strokeWidth="1.4" opacity={1 - p4 * 0.07} transform="skewX(-8)" />
        ))}
        <text x="600" y={cy + 7} textAnchor="middle" fontFamily="Georgia,serif" fontSize="56" fill="#4c614f">
          $
        </text>
      </>
    );
  } else if (k === 'sol') {
    const dots = [
      [535, cy - 30],
      [585, cy - 14],
      [550, cy + 24],
      [590, cy + 34],
      [562, cy - 2],
    ];
    body = (
      <>
        <rect width={W} height={H} fill="#12141C" />
        {range(9).map((st2) => {
          const sy = 40 + (st2 * (H - 80)) / 8;
          return (
            <Fragment key={st2}>
              <rect x="0" y={sy} width={W} height="4" fill="#4D47C4" opacity={0.14 + (st2 % 3) * 0.12} />
              <rect x={(80 + st2 * 60) % 520} y={sy - 1} width="130" height="6" fill="#4D47C4" opacity=".75" />
            </Fragment>
          );
        })}
        <circle cx="560" cy={cy} r="86" fill="#12141C" stroke="#2DD4BF" strokeWidth="3" />
        <circle cx="560" cy={cy} r="86" fill="#2DD4BF" opacity=".08" />
        {dots.map((d2, i) => (
          <circle key={i} cx={d2[0]} cy={d2[1]} r="7" fill="#2DD4BF" />
        ))}
        <circle cx="180" cy={cy} r="34" fill="none" stroke="#2DD4BF" strokeOpacity=".35" strokeWidth="2" />
      </>
    );
  } else if (k === 'capex') {
    body = (
      <>
        <rect width={W} height={H} fill="#1A1D26" />
        <polygon points={`150,30 650,30 400,${cy - 14}`} fill="#2a2f3d" stroke="#4A7CE8" strokeWidth="1.6" />
        <text x="400" y="86" textAnchor="middle" fontFamily="Consolas,monospace" fontSize="15" fill="#4A7CE8">
          CAPEX
        </text>
        <rect x="200" y={cy + 30} width="400" height="60" fill="#232836" stroke="#637089" />
        <line x1="400" y1={cy - 14} x2="400" y2={cy + 30} stroke="#D9534F" strokeWidth="5" />
        <path d={`M 280 ${cy + 90} l -26 46 M 420 ${cy + 90} l 14 48 M 540 ${cy + 90} l 30 40`} stroke="#D9534F" strokeWidth="2" fill="none" />
        <text x="400" y={cy + 68} textAnchor="middle" fontFamily="Consolas,monospace" fontSize="14" fill="#9BA5B3">
          REVENUE
        </text>
      </>
    );
  } else if (k === 'opt') {
    let zz = 'M 90 ' + cy;
    const amp = (H - 220) / 2;
    const seg = 34;
    for (let z2 = 1; z2 <= 14; z2++) {
      const za = amp * (1 - z2 / 16);
      zz += ' L ' + (90 + z2 * seg) + ' ' + (cy + (z2 % 2 ? -za : za));
    }
    body = (
      <>
        <rect width={W} height={H} fill="#242A38" />
        <line x1="60" y1="90" x2={W - 60} y2="90" stroke="#E0E8F5" strokeOpacity=".5" strokeWidth="2.5" />
        <line x1="60" y1={H - 90} x2={W - 60} y2={H - 90} stroke="#E0E8F5" strokeOpacity=".5" strokeWidth="2.5" />
        <path d={zz} fill="none" stroke="#E59E35" strokeWidth="4.5" strokeLinejoin="round" />
        <path d={`M ${90 + 14 * seg} ${cy} l 90 -54`} stroke="#E59E35" strokeWidth="5" strokeLinecap="round" />
        <polygon points={`${196 + 14 * seg},${cy - 66} ${168 + 14 * seg},${cy - 58} ${184 + 14 * seg},${cy - 36}`} fill="#E59E35" />
      </>
    );
  } else if (k === 'n1') {
    body = (
      <>
        <rect width={W} height={H} fill="#0d1220" />
        <path d={`M 70 ${cy + 74} H 730 M 70 ${cy + 92} H 730`} fill="none" stroke="#22304a" strokeWidth="3" />
        {range(8).map((i) => (
          <circle key={i} cx={100 + i * 84} cy={cy + 83} r="7" fill="#22304a" />
        ))}
        <rect x="100" y={cy - 12} width="140" height="72" rx="3" fill="#F7931A" />
        <path d={`M 170 ${cy - 12} V ${cy + 60}`} stroke="#0d1220" strokeWidth="3" />
        <path d={`M 300 ${cy - 130} H 350 L 320 ${cy + 52} H 270 Z`} fill="#22304a" stroke="#5B8AF7" strokeWidth="2" />
        <rect x="382" y={cy + 24} width="70" height="36" rx="3" fill="#F7931A" />
        <rect x="518" y={cy + 24} width="70" height="36" rx="3" fill="#F7931A" />
        <path d={`M 430 ${cy - 86} H 668 V ${cy - 34} H 430`} fill="none" stroke="#4ec08d" strokeWidth="2" />
        <rect x="452" y={cy - 72} width="54" height="24" fill="#4ec08d" opacity=".3" />
        <rect x="520" y={cy - 72} width="54" height="24" fill="#4ec08d" opacity=".3" />
        <path d={`M 624 ${cy - 34} V ${cy + 24} H 674`} fill="none" stroke="#4ec08d" strokeWidth="2" strokeDasharray="5 6" />
        <rect x="650" y={cy + 24} width="48" height="36" fill="#4ec08d" />
      </>
    );
  } else if (k === 'n2') {
    const cells: ReactNode[] = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const hole = c === 3 && r < 2;
        cells.push(<rect key={`${r}-${c}`} x={232 + c * 58} y={cy - 110 + r * 58} width="46" height="46" rx="3" fill={hole ? '#111622' : '#5B8AF7'} fillOpacity={hole ? '1' : '.6'} stroke="#5B8AF7" strokeWidth="1" />);
      }
    body = (
      <>
        <rect width={W} height={H} fill="#111622" />
        <rect x="214" y={cy - 128} width="256" height="256" rx="8" fill="#162039" stroke="#22304a" strokeWidth="2" />
        {cells}
        <path d={`M 452 ${cy - 87} H 552 V ${cy - 114} H 646`} fill="none" stroke="#5B8AF7" strokeWidth="2" />
        <rect x="652" y={cy - 138} width="46" height="46" rx="3" fill="#5B8AF7" transform={`rotate(12 675 ${cy - 115})`} />
        <path d={`M 646 ${cy + 94} H 554 V ${cy - 29} H 452`} fill="none" stroke="#4ec08d" strokeWidth="2" />
        <rect x="652" y={cy + 70} width="46" height="46" rx="3" fill="#4ec08d" />
        <path d={`M 464 ${cy - 37} L 452 ${cy - 29} L 464 ${cy - 21}`} fill="none" stroke="#4ec08d" strokeWidth="2" />
        <rect x="100" y={cy - 28} width="70" height="70" rx="4" fill="#E59E35" />
        <path d={`M 100 ${cy + 62} H 170`} stroke="#E59E35" strokeWidth="2" />
      </>
    );
  } else if (k === 'n3') {
    body = (
      <>
        <rect width={W} height={H} fill="#101824" />
        <path d={`M 84 ${cy + 118} H 716`} stroke="#22304a" strokeWidth="2" />
        <path d={`M 386 ${cy + 106} L 430 ${cy + 22} L 474 ${cy + 106} Z`} fill="#22304a" stroke="#627EEA" strokeWidth="2" />
        <g transform={`rotate(9 430 ${cy + 18})`}>
          <rect x="172" y={cy + 8} width="510" height="16" rx="4" fill="#627EEA" />
          <rect x="210" y={cy - 40} width="100" height="46" rx="3" fill="#5B8AF7" />
          <rect x="226" y={cy - 90} width="84" height="46" rx="3" fill="#5B8AF7" opacity=".55" />
          <rect x="562" y={cy - 40} width="78" height="46" rx="3" fill="#4ec08d" />
          <rect x="562" y={cy - 90} width="78" height="46" rx="3" fill="#4ec08d" />
        </g>
        <path d={`M 520 ${cy + 92} H 712`} fill="none" stroke="#E59E35" strokeWidth="2" strokeDasharray="5 6" />
        <path d={`M 168 ${cy - 122} L 126 ${cy - 58} L 156 ${cy - 38}`} fill="none" stroke="#5B8AF7" strokeWidth="2" strokeDasharray="4 6" />
        <rect x="130" y={cy - 148} width="50" height="40" fill="none" stroke="#5B8AF7" strokeWidth="2" transform={`rotate(-18 155 ${cy - 128})`} />
      </>
    );
  } else if (k === 'n4') {
    body = (
      <>
        <rect width={W} height={H} fill="#111722" />
        <path d={`M 88 ${cy - 98} H 260 L 636 ${cy} H 722`} fill="none" stroke="#E59E35" strokeWidth="4" strokeLinejoin="round" />
        <path d={`M 88 ${cy + 98} H 260 L 636 ${cy}`} fill="none" stroke="#5B8AF7" strokeWidth="4" strokeLinejoin="round" />
        {range(5).map((i) => {
          const x = 290 + i * 66;
          const d = (98 * (636 - x)) / 376;
          return <path key={i} d={`M ${x} ${cy - d + 9} V ${cy + d - 9}`} stroke="#22304a" strokeWidth="2" />;
        })}
        <rect x="104" y={cy - 28} width="100" height="56" rx="5" fill="#162039" stroke="#4ec08d" strokeWidth="2" />
        <path d={`M 124 ${cy + 12} V ${cy - 12} M 144 ${cy + 12} V ${cy - 12} M 164 ${cy + 12} V ${cy - 12}`} stroke="#4ec08d" strokeWidth="6" />
        <path d={`M 204 ${cy} H 240 V ${cy - 84}`} fill="none" stroke="#4ec08d" strokeWidth="2" strokeDasharray="4 5" />
        <rect x="626" y={cy - 22} width="22" height="44" rx="4" fill="#111722" stroke="#627EEA" strokeWidth="3" />
      </>
    );
  } else if (k === 'n5') {
    body = (
      <>
        <rect width={W} height={H} fill="#0e1422" />
        <defs>
          <linearGradient id={u + 'n5'} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#627EEA" stopOpacity=".4" />
            <stop offset="100%" stopColor="#22304a" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <path d={`M 80 ${cy - 18} H 330 L 382 ${cy + 18} H 80 Z`} fill="#4ec08d" opacity=".6" />
        <path d={`M 428 ${cy - 132} L 310 ${cy + 116} H 546 Z`} fill={`url(#${u}n5)`} stroke="#627EEA" strokeWidth="2" />
        <path d={`M 344 ${cy - 18} L 490 ${cy + 4} L 718 ${cy - 98} V ${cy - 60} L 506 ${cy + 38} Z`} fill="#5B8AF7" opacity=".7" />
        <path d={`M 362 ${cy + 18} L 506 ${cy + 38} L 718 ${cy + 92} V ${cy + 110} L 490 ${cy + 60} Z`} fill="#E59E35" opacity=".65" />
        <path d={`M 80 ${cy} H 292 M 734 ${cy - 122} V ${cy + 128}`} fill="none" stroke="#22304a" strokeWidth="2" />
        <path d={`M 724 ${cy - 98} H 746 M 724 ${cy - 60} H 746`} stroke="#5B8AF7" strokeWidth="2" />
        <path d={`M 724 ${cy + 92} H 746 M 724 ${cy + 110} H 746`} stroke="#E59E35" strokeWidth="2" />
      </>
    );
  } else {
    /* 맞춤 글 그림: k = 'p-a' | 'p-b' | 'p-c' */
    const lbl = k === 'p-b' ? 'Your Position' : k === 'p-c' ? 'Revisit The Market' : 'Your First Trade';
    body = (
      <>
        <rect width={W} height={H} fill="#0c0f16" />
        {range(16).map((c3) => {
          const chh = 20 + ((c3 * 53) % 64);
          const chy = H - 46 - chh;
          return (
            <Fragment key={c3}>
              <rect x={40 + c3 * 46} y={chy} width="9" height={chh} fill={(c3 * 53) % 3 ? '#22304a' : '#2c3f2f'} />
              <line x1={44.5 + c3 * 46} y1={chy - 12} x2={44.5 + c3 * 46} y2={chy + chh + 10} stroke="#22304a" strokeWidth="1.4" />
            </Fragment>
          );
        })}
        <defs>
          <radialGradient id={u + 'g'}>
            <stop offset="0%" stopColor="#F7931A" stopOpacity=".28" />
            <stop offset="100%" stopColor="#F7931A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="168" cy={cy - 16} r="118" fill={`url(#${u}g)`} />
        <circle cx="168" cy={cy - 16} r="56" fill="#F7931A" />
        <text x="168" y={cy - 2} textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="44" fill="#0c0f16">
          ₿
        </text>
        <text x={W / 2 + 50} y={cy - 6} textAnchor="middle" fontFamily="Georgia,serif" fontSize="44" fill="#E3E3E3">
          {lbl}
        </text>
        <line x1={W / 2 - 40} y1={cy + 16} x2={W / 2 + 140} y2={cy + 16} stroke="#5B8AF7" strokeWidth="2" />
        {k !== 'p-a' && (
          <>
            <circle cx="656" cy={cy - 16} r="44" fill="none" stroke="#627EEA" strokeWidth="2.5" />
            <path d={`M 656 ${cy - 46} l 17 26 -17 11 -17 -11 z M 656 ${cy + 4} l 15 -9 -15 21 -15 -21 z`} fill="#627EEA" opacity=".9" />
          </>
        )}
      </>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
      {body}
    </svg>
  );
}

/** tfInsFig(t): 본문 개념도 세 가지 (수치를 지어내지 않는 그림) */
export function InsFig({ t }: { t: string }) {
  const W = 800;
  const H = 356;
  const sans = 'sans-serif';
  let body: ReactNode;
  if (t === 'flow') {
    body = (
      <>
        <rect x="70" y="120" width="170" height="86" rx="10" fill="#1a1e28" stroke="#3a4254" />
        <text x="155" y="158" textAnchor="middle" fontSize="15" fill="#c4c7c5" fontFamily={sans}>
          출발점
        </text>
        <text x="155" y="182" textAnchor="middle" fontSize="12" fill="#9aa0a6" fontFamily={sans}>
          기존 자금 / 신규 자금
        </text>
        <rect x="560" y="120" width="170" height="86" rx="10" fill="#16233c" stroke="#5B8AF7" />
        <text x="645" y="158" textAnchor="middle" fontSize="15" fill="#e3e3e3" fontFamily={sans}>
          목적지
        </text>
        <text x="645" y="182" textAnchor="middle" fontSize="12" fill="#9aa0a6" fontFamily={sans}>
          주도 자산
        </text>
        <path d="M 250 148 C 360 110, 450 110, 550 148" fill="none" stroke="#5B8AF7" strokeWidth="3" />
        <polygon points="552,148 534,138 538,156" fill="#5B8AF7" />
        <path d="M 250 182 C 360 226, 450 226, 550 182" fill="none" stroke="#4A5060" strokeWidth="2" strokeDasharray="5 6" />
        <text x="400" y="100" textAnchor="middle" fontSize="13" fill="#5B8AF7" fontFamily={sans}>
          확인된 경로
        </text>
        <text x="400" y="248" textAnchor="middle" fontSize="13" fill="#9aa0a6" fontFamily={sans}>
          가정에 불과한 경로
        </text>
      </>
    );
  } else if (t === 'curve') {
    body = (
      <>
        <line x1="70" y1="286" x2="730" y2="286" stroke="#4A5060" strokeWidth="1.6" />
        <rect x="300" y="60" width="200" height="226" fill="#9aa0a6" opacity=".08" />
        <path d="M 80 240 C 200 232, 280 210, 380 150 C 470 96, 560 92, 720 78" fill="none" stroke="#E59E35" strokeWidth="3.5" />
        <line x1="500" y1="60" x2="500" y2="286" stroke="#c4c7c5" strokeWidth="1.6" strokeDasharray="4 6" />
        <text x="400" y="48" textAnchor="middle" fontSize="13" fill="#9aa0a6" fontFamily={sans}>
          선반영 / 압축 구간
        </text>
        <text x="510" y="80" fontSize="12.5" fill="#c4c7c5" fontFamily={sans}>
          이벤트 시점
        </text>
      </>
    );
  } else {
    const bars: [number, string, number, string][] = [
      [130, '수요와 기대', 210, '#5B8AF7'],
      [320, '공급과 실적', 120, '#4EC08D'],
      [510, '격차', 90, '#E0604B'],
    ];
    body = (
      <>
        {bars.map((b2) => (
          <Fragment key={b2[0]}>
            <rect x={b2[0]} y={276 - b2[2]} width="120" height={b2[2]} rx="6" fill={b2[3]} opacity=".8" />
            <text x={b2[0] + 60} y="304" textAnchor="middle" fontSize="13.5" fill="#c4c7c5" fontFamily={sans}>
              {b2[1]}
            </text>
          </Fragment>
        ))}
        <line x1="90" y1="276" x2="710" y2="276" stroke="#4A5060" strokeWidth="1.6" />
        <text x="570" y="150" fontSize="12.5" fill="#9aa0a6" fontFamily={sans}>
          두 속도의 차이가
        </text>
        <text x="570" y="170" fontSize="12.5" fill="#9aa0a6" fontFamily={sans}>
          병목, 시간차를 만든다
        </text>
      </>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width={W} height={H} fill="#12141a" />
      {body}
    </svg>
  );
}

/** tfInsAvatar(id,sz): 저자 얼굴 (벡터 고정) */
export function InsAvatar({ id, sz }: { id: string; sz: number }) {
  const a = tfIns2AuOf(id);
  return (
    <svg className="av2" width={sz} height={sz} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#242a35" />
      <path d="M4 29c1.6-5.4 6.2-7.6 12-7.6S26.4 23.6 28 29a16 16 0 0 1-24 0z" fill={a.top} />
      <circle cx="16" cy="13.4" r="6.6" fill={a.skin} />
      <path d={a.hairD} fill={a.hair} />
      <circle cx="13.6" cy="13.8" r=".85" fill="#241d18" />
      <circle cx="18.4" cy="13.8" r=".85" fill="#241d18" />
      <path d="M14.3 16.9c1 .8 2.4.8 3.4 0" stroke="#a06b45" strokeWidth=".8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
/** 맞춤 글 카드의 저자 자리 표시 (tfIns2Home 의 fyav) */
export function FyAvatar() {
  return (
    <svg className="av2" width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="fyav" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#5B8AF7" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#fyav)" />
      <path d="M8 19.5l4-6 3 4 3.4-8 5.6 9.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** tfAssetIcon(sym,sz): 자산 표시 (실제 브랜드 모양, 로컬 SVG) */
export function AssetIcon({ sym, sz = 34 }: { sym: string; sz?: number }) {
  const g = 'solg' + uid(useId());
  let body: ReactNode;
  if (sym === 'BTC')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#F7931A" />
        <text x="20" y="27.5" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="21" fill="#fff" transform="rotate(12 20 20)">
          ₿
        </text>
      </>
    );
  else if (sym === 'ETH')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#627EEA" />
        <path d="M20 7l7.6 12.5L20 24l-7.6-4.5z" fill="#fff" fillOpacity=".92" />
        <path d="M20 7v17l-7.6-4.5z" fill="#fff" fillOpacity=".6" />
        <path d="M20 26l7.6-4.4L20 33.5 12.4 21.6z" fill="#fff" fillOpacity=".92" />
        <path d="M20 33.5V26l-7.6-4.4z" fill="#fff" fillOpacity=".6" />
      </>
    );
  else if (sym === 'USDT')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#26A17B" />
        <path d="M11 11h18v4.4h-6.6v2.4c4.8.3 8.2 1.3 8.2 2.6 0 1.3-3.4 2.4-8.2 2.6v7H17.6v-7c-4.8-.3-8.2-1.3-8.2-2.6 0-1.3 3.4-2.4 8.2-2.6v-2.4H11V11zm9 9.8c4.3 0 7.4-.7 7.4-1.3 0-.6-3.1-1.3-7.4-1.3s-7.4.7-7.4 1.3c0 .6 3.1 1.3 7.4 1.3z" fill="#fff" />
      </>
    );
  else if (sym === 'USDC')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#2775CA" />
        <path
          d="M25.6 23.2c0-2.6-1.6-3.5-4.7-3.9-2.2-.3-2.7-.9-2.7-1.9s.8-1.7 2.3-1.7c1.4 0 2.1.5 2.5 1.6.1.2.3.3.5.3h1.2c.3 0 .5-.2.5-.5v-.1a3.9 3.9 0 0 0-3.4-3.2v-1.9c0-.3-.2-.5-.6-.6h-1.1c-.3 0-.5.2-.6.6v1.8c-2.2.3-3.6 1.8-3.6 3.6 0 2.4 1.5 3.4 4.6 3.8 2.1.4 2.8.8 2.8 2s-1 2-2.4 2c-1.9 0-2.5-.8-2.7-1.9-.1-.3-.3-.4-.5-.4h-1.3c-.3 0-.5.2-.5.5v.1c.3 1.9 1.5 3.2 3.9 3.6v1.9c0 .3.2.5.6.6h1.1c.3 0 .5-.2.6-.6v-1.9c2.2-.4 3.7-1.9 3.7-3.8z"
          fill="#fff"
        />
        <path
          d="M15.7 31.8c-5.7-2.1-8.7-8.4-6.5-14.1 1.1-3.2 3.6-5.6 6.5-6.6.3-.1.4-.3.4-.6v-1c0-.3-.1-.5-.4-.6h-.3C8.5 11.1 4.7 18.5 6.9 25.4a12.6 12.6 0 0 0 8.2 8.2c.3.1.6 0 .6-.3l.1-.2v-.9c0-.2-.2-.4-.4-.6zm8.9-22.9c-.3-.1-.6 0-.6.3l-.1.2v.9c0 .3.2.5.4.7 5.7 2.1 8.7 8.4 6.5 14.1a10.9 10.9 0 0 1-6.5 6.6c-.3.1-.4.3-.4.6v1c0 .3.1.5.4.6h.3c6.9-2.2 10.7-9.6 8.5-16.5a12.7 12.7 0 0 0-8.5-8.2z"
          fill="#fff"
        />
      </>
    );
  else if (sym === 'SOL')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#141722" />
        <defs>
          <linearGradient id={g} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#9945FF" />
            <stop offset="1" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <g fill={`url(#${g})`}>
          <path d="M13.2 24.6h14.9c.3 0 .5.1.3.4l-2.7 2.9a1 1 0 0 1-.7.3H10.2c-.3 0-.5-.2-.3-.4l2.6-2.9a1 1 0 0 1 .7-.3z" />
          <path d="M13.2 11.8h14.9c.3 0 .5.2.3.4l-2.7 2.9a1 1 0 0 1-.7.3H10.2c-.3 0-.5-.2-.3-.4l2.6-2.9a1 1 0 0 1 .7-.3z" />
          <path d="M25 18.2H10.2c-.3 0-.5.1-.3.4l2.6 2.8a1 1 0 0 0 .7.4h14.9c.3 0 .5-.2.3-.5l-2.7-2.8a1 1 0 0 0-.7-.3z" />
        </g>
      </>
    );
  else if (sym === 'MSFT')
    body = (
      <>
        <rect width="40" height="40" rx="20" fill="#1b1f28" />
        <rect x="10" y="10" width="9.2" height="9.2" fill="#F25022" />
        <rect x="20.8" y="10" width="9.2" height="9.2" fill="#7FBA00" />
        <rect x="10" y="20.8" width="9.2" height="9.2" fill="#00A4EF" />
        <rect x="20.8" y="20.8" width="9.2" height="9.2" fill="#FFB900" />
      </>
    );
  else if (sym === 'NVDA')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#76B900" />
        <path d="M18.5 15.2c-4.4.4-7.9 3-9.9 4.8 2.2 2.4 6 5.2 10.2 5 0 0 0-1.5 0-2.2-2.4 0-4.7-1.4-6.2-2.9 1.4-1.2 3.4-2.4 5.9-2.6v2.1l5.6-3.2-5.6-3.2v2.2z" fill="#fff" />
      </>
    );
  else if (sym === 'NDX')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#0d1b2e" />
        <path d="M11.6 27.4 16.2 12.6h3.1L14.7 27.4z" fill="#4AA8E0" />
        <path d="M18 27.4 22.6 12.6h3.1L21.1 27.4z" fill="#1E7BC4" />
        <path d="M24.4 27.4 29 12.6c2.3.7 3.6 3 2.9 5.3l-1.7 5.7c-.6 2.2-2.4 3.8-4.9 3.8z" fill="#77C3EF" />
      </>
    );
  else if (sym === 'USDJPY')
    body = (
      <>
        <circle cx="14" cy="20" r="12.5" fill="#3f7a4e" />
        <text x="14" y="25.5" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="15" fill="#fff">
          $
        </text>
        <circle cx="27" cy="20" r="12.5" fill="#f4f6f8" />
        <circle cx="27" cy="20" r="5.4" fill="#BC002D" />
      </>
    );
  else if (sym === 'XAU')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#2a2415" />
        <path d="M13 24l2-6h10l2 6z" fill="#C89B3C" />
        <path d="M15 18l1.4-4h7.2l1.4 4z" fill="#E0BA62" />
        <text x="20" y="33" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="8" fill="#C89B3C">
          Au
        </text>
      </>
    );
  else if (sym === 'DXY' || sym === 'US10Y')
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#3f7a4e" />
        <text x="20" y="28" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="700" fontSize="22" fill="#fff">
          $
        </text>
      </>
    );
  else
    body = (
      <>
        <circle cx="20" cy="20" r="19" fill="#3a4254" />
        <text x="20" y="26" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="14" fill="#e3e3e3">
          {String(sym).slice(0, 2)}
        </text>
      </>
    );
  return (
    <svg width={sz} height={sz} viewBox="0 0 40 40" aria-hidden="true">
      {body}
    </svg>
  );
}

/** TF_INS2_SNS: 공유 글리프 (글자로 대신하지 않는다) */
export const SnsFb = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4z" />
  </svg>
);
export const SnsX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3H8l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.1 4.7H5.2l11.5 14.4z" />
  </svg>
);
export const SnsLi = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.9 21H3.3V8.7h3.6V21zM5.1 7.1a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM21 21h-3.6v-6c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.5V8.7H13v1.7h.1c.5-.9 1.7-1.9 3.4-1.9 3.7 0 4.4 2.4 4.4 5.6V21z" />
  </svg>
);
export const SnsLnk = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
/** TF_INS2_IC.sh */
export const IcShare = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
