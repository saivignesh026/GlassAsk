// Keep the assistant out of the way while the system browser owns sign-in.
export function panelBounds(workArea,width,height,position=null){
  width=Math.min(width,workArea.width-32);height=Math.min(height,workArea.height-40);
  const x=position?.x??Math.round(workArea.x+(workArea.width-width)/2);
  const y=position?.y??Math.round(workArea.y+(workArea.height-height)/2);
  return {width,height,x:Math.max(workArea.x,Math.min(x,workArea.x+workArea.width-width)),y:Math.max(workArea.y,Math.min(y,workArea.y+workArea.height-height))};
}

export async function browserHandoff(win, openBrowser, operation) {
  let handedOff=false;
  try {
    return await operation(async url=>{
      handedOff=true;
      win.setAlwaysOnTop(false);
      win.hide();
      await openBrowser(url);
    });
  } finally {
    if(handedOff && !win.isDestroyed()) {
      win.setAlwaysOnTop(true);
      win.show();
      win.focus();
    }
  }
}
