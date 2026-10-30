import type { Driver, Project } from './types';
// Deliberately synthetic examples: never presented as manufacturer specifications.
export const drivers: Driver[] = [
  {id:'demo-165', name:'Studio 165 · example', note:'Synthetic 6½-inch woofer. Replace with measured or manufacturer T/S data before building.', fs:38,qes:0.42,qms:4.8,vas:24,re:5.8,le:0.45,sd:132,xmax:5,cutout:145,frame:176,depth:85},
  {id:'demo-130', name:'Compact 130 · example', note:'Synthetic 5-inch driver for exploring a smaller line.', fs:53,qes:0.48,qms:4.2,vas:10,re:6.2,le:0.3,sd:85,xmax:4,cutout:116,frame:136,depth:72},
  {id:'demo-200', name:'Bass 200 · example', note:'Synthetic 8-inch woofer for low-frequency exploration.', fs:29,qes:0.39,qms:5.5,vas:62,re:5.6,le:0.7,sd:220,xmax:7,cutout:184,frame:212,depth:105}
];
export const defaultProject: Project = {
  version:1, name:'Quarter-wave study', driver:drivers[0],
  design:{length:1.8,areaRatio:2.3,laneWidth:170,folds:2,thickness:18,driverPosition:0.16,damping:0.65,voltage:2.83,temperature:20},
  targets:{low:40,high:200,maxHeight:1250,maxWidth:650,maxDepth:500,minLength:1.2,maxLength:3,maxVelocity:17}
};
