const install=document.querySelector('#install-app'),dialog=document.querySelector('#install-dialog');
let promptEvent;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
function update(){install.hidden=!!standalone()||document.querySelector('#app').dataset.phase!=='entry';}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;update();});
window.addEventListener('appinstalled',()=>{promptEvent=null;install.hidden=true;dialog.close();});
new MutationObserver(update).observe(document.querySelector('#app'),{attributes:true,attributeFilter:['data-phase']});
install.onclick=async()=>{
 if(promptEvent){const event=promptEvent;promptEvent=null;try{await event.prompt();await event.userChoice;}catch{dialog.showModal();}return;}
 dialog.showModal();
};
document.querySelector('#install-close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>install.focus({preventScroll:true}));
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
update();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{/* The online game remains usable when installation is unavailable. */});
