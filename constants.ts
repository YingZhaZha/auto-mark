
import { AircraftConfig } from './types';

// Common Cylinders
const A320_CYLINDERS = [
  { id: 'lh_cyl', label: '货舱左侧气瓶', watermark: 'LH气瓶', x: 42, y: 65.5 },
  { id: 'rh_cyl', label: '货舱右侧气瓶', watermark: 'RH气瓶', x: 58, y: 65.5 },
];

const FAP = { id: 'fap', label: 'FAP面板门页面', watermark: 'FAP', x: 50, y: 10 };

export const AIRCRAFT_CONFIGS: Record<string, any> = {
  A319: {
    id: 'A319',
    label: 'A319',
    emoji: '✈️',
    color: 'from-blue-400 to-blue-600',
    fuselagePath: "M150 50C100 50 80 110 80 400C80 690 100 750 150 750C200 750 220 690 220 400C220 110 200 50 150 50Z",
    tailY: -30,
    doors: [
      { id: 'fap', label: 'FAP面板门页面', watermark: 'FAP', x: 50, y: 13 }, // Moved down from 10
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 38, y: 22 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 62, y: 22 },
      { id: 'l_ow', label: '左侧应急门', watermark: 'LH EMG', x: 39, y: 50.5 },
      { id: 'r_ow', label: '右侧应急门', watermark: 'RH EMG', x: 61, y: 50.5 },
      { id: 'l2', label: '左二乘客门', watermark: 'L2', x: 38, y: 85 },
      { id: 'r2', label: '右二乘客门', watermark: 'R2', x: 62, y: 85 },
      { id: 'lh_cyl', label: '货舱左侧气瓶', watermark: 'LH气瓶', x: 42, y: 62.5 },
      { id: 'rh_cyl', label: '货舱右侧气瓶', watermark: 'RH气瓶', x: 58, y: 62.5 },
    ]
  },
  A320: {
    id: 'A320',
    label: 'A320',
    emoji: '🛫',
    color: 'from-emerald-400 to-emerald-600',
    fuselagePath: "M150 20C100 20 80 80 80 400C80 720 100 780 150 780C200 780 220 720 220 400C220 80 200 20 150 20Z",
    tailY: 0,
    doors: [
      FAP,
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 38, y: 20 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 62, y: 20 },
      // Adjusted: Dynamic vertical touching. Gap of ~7% roughly equals button size on phone screens.
      // Wing Y range is approx 43% to 65%. Centered around 53%.
      { id: 'l1_emg', label: '左一应急门', watermark: 'L1 EMG', x: 39, y: 49.5 }, 
      { id: 'l2_emg', label: '左二应急门', watermark: 'L2 EMG', x: 39, y: 56.5 },
      { id: 'r1_emg', label: '右一应急门', watermark: 'R1 EMG', x: 61, y: 49.5 },
      { id: 'r2_emg', label: '右二应急门', watermark: 'R2 EMG', x: 61, y: 56.5 },
      { id: 'l2', label: '左二乘客门', watermark: 'L2', x: 38, y: 88 },
      { id: 'r2', label: '右二乘客门', watermark: 'R2', x: 62, y: 88 },
      ...A320_CYLINDERS
    ]
  },
  A321: {
    id: 'A321',
    label: 'A321',
    emoji: '🛬',
    color: 'from-indigo-400 to-indigo-600',
    fuselagePath: "M150 10C100 10 80 60 80 400C80 740 100 790 150 790C200 790 220 740 220 400C220 60 200 10 150 10Z",
    tailY: 10,
    doors: [
      FAP,
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 38, y: 15 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 62, y: 15 },
      { id: 'l2', label: '左一应急门', watermark: 'L1 EMG', x: 38, y: 35 },
      { id: 'r2', label: '右一应急门', watermark: 'R1 EMG', x: 62, y: 35 },
      { id: 'l3', label: '左二应急门', watermark: 'L2 EMG', x: 38, y: 65 },
      { id: 'r3', label: '右二应急门', watermark: 'R2 EMG', x: 62, y: 65 },
      { id: 'l4', label: '左二乘客门', watermark: 'L2', x: 38, y: 92 },
      { id: 'r4', label: '右二乘客门', watermark: 'R2', x: 62, y: 92 },
    ]
  },
  A321ACF: {
    id: 'A321ACF',
    label: 'A321 ACF',
    emoji: '🚀',
    color: 'from-orange-400 to-orange-600',
    fuselagePath: "M150 10C100 10 80 60 80 400C80 740 100 790 150 790C200 790 220 740 220 400C220 60 200 10 150 10Z",
    tailY: 10,
    wingY: -60,
    doors: [
      FAP,
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 38, y: 15 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 62, y: 15 },
      
      { id: 'l1_emg', label: '左一应急门', watermark: 'L1 EMG', x: 38, y: 45 },
      { id: 'r1_emg', label: '右一应急门', watermark: 'R1 EMG', x: 62, y: 45 },
      
      { id: 'l2_emg', label: '左二应急门', watermark: 'L2 EMG', x: 38, y: 51 },
      { id: 'r2_emg', label: '右二应急门', watermark: 'R2 EMG', x: 62, y: 51 },
      
      { id: 'lh_cyl', label: '货舱左侧气瓶', watermark: 'LH气瓶', x: 42, y: 60.5 },
      { id: 'rh_cyl', label: '货舱右侧气瓶', watermark: 'RH气瓶', x: 58, y: 60.5 },

      { id: 'l3_emg', label: '左三应急门', watermark: 'L3 EMG', x: 38, y: 70 },
      { id: 'r3_emg', label: '右三应急门', watermark: 'R3 EMG', x: 62, y: 70 },
      
      { id: 'l2', label: '左二乘客门', watermark: 'L2', x: 38, y: 92 },
      { id: 'r2', label: '右二乘客门', watermark: 'R2', x: 62, y: 92 },
    ]
  },
  A330: {
    id: 'A330',
    label: 'A330',
    emoji: '🛫',
    color: 'from-purple-400 to-purple-600',
    fuselagePath: "M150 10C90 10 60 60 60 400C60 740 90 790 150 790C210 790 240 740 240 400C240 60 210 10 150 10Z",
    tailY: 10, 
    doors: [
      FAP,
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 35, y: 15 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 65, y: 15 },
      { id: 'l2', label: '左二乘客门', watermark: 'L2', x: 35, y: 40 },
      { id: 'r2', label: '右二乘客门', watermark: 'R2', x: 65, y: 40 },
      { id: 'lh_emg', label: '左侧应急门', watermark: 'LH EMG', x: 35, y: 65 },
      { id: 'rh_emg', label: '右侧应急门', watermark: 'RH EMG', x: 65, y: 65 },
      { id: 'l3', label: '左三乘客门', watermark: 'L3', x: 35, y: 90 },
      { id: 'r3', label: '右三乘客门', watermark: 'R3', x: 65, y: 90 },
    ]
  },
  A350: {
    id: 'A350',
    label: 'A350',
    emoji: '🦅',
    color: 'from-slate-700 to-slate-900',
    fuselagePath: "M150 10C100 10 70 60 70 400C70 740 100 790 150 790C200 790 230 740 230 400C230 60 200 10 150 10Z",
    tailY: 10, 
    doors: [
      FAP,
      { id: 'l1', label: '左一乘客门', watermark: 'L1', x: 35, y: 15 },
      { id: 'r1', label: '右一乘客门', watermark: 'R1', x: 65, y: 15 },
      
      { id: 'l2', label: '左二乘客门', watermark: 'L2', x: 35, y: 32 },
      { id: 'r2', label: '右二乘客门', watermark: 'R2', x: 65, y: 32 },
      
      { id: 'l3', label: '左三乘客门', watermark: 'L3', x: 35, y: 68 },
      { id: 'r3', label: '右三乘客门', watermark: 'R3', x: 65, y: 68 },
      
      { id: 'l4', label: '左四乘客门', watermark: 'L4', x: 35, y: 90 },
      { id: 'r4', label: '右四乘客门', watermark: 'R4', x: 65, y: 90 },
    ]
  }
};
