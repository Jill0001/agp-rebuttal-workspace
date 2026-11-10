export function el(tag,cls='',text=''){const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;}
let toastTimer;
export function toast(message){const box=document.querySelector('#toast');box.textContent=message;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,6000);}
export {request as api} from './transport.js';
