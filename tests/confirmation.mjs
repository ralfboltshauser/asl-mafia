// Full-game tests accept custom confirmations automatically. Safety/UX tests use real controls explicitly.
export async function autoConfirm(page,{exceptGroup=false}={}){
 await page.addInitScript(({exceptGroup})=>{
  new MutationObserver(()=>{const dialog=document.querySelector('#confirm-dialog[open]');if(!dialog)return;if(exceptGroup&&document.querySelector('#confirm-title').textContent.startsWith('Confirm the group'))return;document.querySelector('#confirm-accept').click();}).observe(document,{subtree:true,attributes:true,attributeFilter:['open']});
 },{exceptGroup});
}
