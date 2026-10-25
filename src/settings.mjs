export const defaults = Object.freeze({textShortcut:'Control+Alt+Space', screenShortcut:'Control+Alt+S', gestures:true, shakeCount:5, shakeWindow:2000, opacity:82, startAtLogin:false, model:''});
export function shortcut(value) {
  if (typeof value !== 'string' || value.length > 80) throw Error('Invalid shortcut.');
  const parts = value.split('+');
  const mods = ['Control','Alt','Shift','Super'];
  const key = parts.pop();
  if (!parts.length || parts.some(p => !mods.includes(p)) || new Set(parts).size !== parts.length || !/^(Space|Enter|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(key)) throw Error('Use a modifier (Ctrl, Alt, Shift, Win) and a letter, number, Space, Enter, or F-key.');
  return [...mods.filter(m=>parts.includes(m)),key].join('+');
}
export function validateSettings(input) {
  if (!input || typeof input !== 'object') throw Error('Invalid settings.');
  const s = {...defaults};
  s.textShortcut=shortcut(input.textShortcut); s.screenShortcut=shortcut(input.screenShortcut);
  if(s.textShortcut===s.screenShortcut) throw Error('Choose different shortcuts for text and screen.');
  for(const key of ['gestures','startAtLogin']) { if(typeof input[key]!=='boolean') throw Error(`Invalid ${key}`); s[key]=input[key]; }
  for(const [key,min,max] of [['shakeCount',3,10],['shakeWindow',1000,5000],['opacity',40,100]]) {
    if(!Number.isInteger(input[key]) || input[key]<min || input[key]>max) throw Error(`Invalid ${key}`); s[key]=input[key];
  }
  if(typeof input.model!=='string' || input.model.length>100 || (input.model && !/^[\w.:-]+$/.test(input.model))) throw Error('Invalid model.');
  s.model=input.model; return s;
}
// Keep old shortcuts operational if an OS reservation conflicts with a new one.
export function registerShortcuts(api, next, previous, callbacks) {
  api.unregisterAll();
  try {
    for (const [key, cb] of [['textShortcut',callbacks.text],['screenShortcut',callbacks.screen]])
      if (!api.register(next[key],cb)) throw Error(`${next[key]} is already in use. Choose another shortcut.`);
  } catch(error) {
    api.unregisterAll();
    if(previous) for(const [key,cb] of [['textShortcut',callbacks.text],['screenShortcut',callbacks.screen]]) api.register(previous[key],cb);
    throw error;
  }
}
