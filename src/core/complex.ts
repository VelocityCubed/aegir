export type C = [number, number];
export const add=(a:C,b:C):C=>[a[0]+b[0],a[1]+b[1]];
export const sub=(a:C,b:C):C=>[a[0]-b[0],a[1]-b[1]];
export const mul=(a:C,b:C):C=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
export const scale=(a:C,b:number):C=>[a[0]*b,a[1]*b];
export const div=(a:C,b:C):C=>{ const d=b[0]**2+b[1]**2; return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d]; };
export const abs=(a:C)=>Math.hypot(...a);
export const sinh=(a:C):C=>[Math.sinh(a[0])*Math.cos(a[1]),Math.cosh(a[0])*Math.sin(a[1])];
export const cosh=(a:C):C=>[Math.cosh(a[0])*Math.cos(a[1]),Math.sinh(a[0])*Math.sin(a[1])];
