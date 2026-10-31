// Payhas prototype: one frame per screenshot, tap areas linked to the next
// screen, the flow starting at Welcome. DATA is prepended by build_plugin.py.
const W = 360, H = 800, GAP = 80, ROW_GAP = 200, SCALE = 0.5;

async function run() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  // A fresh page each run, so running it twice never doubles anything.
  const old = figma.root.children.find((p) => p.name === 'Prototype');
  const page = figma.createPage();
  page.name = 'Prototype';
  await figma.setCurrentPageAsync(page);
  if (old) old.remove();

  const frames = {};
  let y = 0;
  for (const [title, names] of DATA.rows) {
    const label = figma.createText();
    label.fontName = { family: 'Inter', style: 'Bold' };
    label.fontSize = 40;
    label.characters = title;
    label.y = y;
    names.forEach((name, i) => {
      const f = figma.createFrame();
      f.name = name;
      f.resize(W, H);
      f.x = i * (W + GAP);
      f.y = y + 80;
      f.cornerRadius = 28;
      f.clipsContent = true;
      const image = figma.createImage(figma.base64Decode(DATA.images[name]));
      f.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
      const cap = figma.createText();
      cap.fontName = { family: 'Inter', style: 'Regular' };
      cap.fontSize = 18;
      cap.characters = name;
      cap.x = f.x;
      cap.y = f.y + H + 14;
      cap.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.5 } }];
      frames[name] = f;
    });
    y += 80 + H + ROW_GAP;
  }

  let links = 0;
  for (const [name, spots] of Object.entries(DATA.links)) {
    const frame = frames[name];
    for (const s of spots) {
      const r = figma.createRectangle();
      r.name = '→ ' + s.to;
      r.x = Math.max(0, s.x * SCALE);
      r.y = Math.max(0, s.y * SCALE);
      r.resize(Math.min(W, s.w * SCALE), Math.min(H, s.h * SCALE));
      r.fills = [];
      frame.appendChild(r);
      await r.setReactionsAsync([{
        trigger: { type: 'ON_CLICK' },
        actions: [{ type: 'NODE', destinationId: frames[s.to].id, navigation: 'NAVIGATE', transition: null, preserveScrollPosition: false }],
      }]);
      links++;
    }
  }

  page.flowStartingPoints = [{ nodeId: frames['00-welcome'].id, name: 'Payhas' }];
  figma.viewport.scrollAndZoomIntoView(Object.values(frames));
  figma.closePlugin(`Payhas prototype: ${Object.keys(frames).length} screens, ${links} links. Press Present (▶) to play.`);
}

run().catch((e) => figma.closePlugin('Payhas prototype failed: ' + e.message));
