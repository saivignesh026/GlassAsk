// Keep the assistant out of the way while the system browser owns sign-in.
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
