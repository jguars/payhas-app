// Shared mockup icons (same strokes as the app's icon set).
const I={
back:'<path d="M15 6l-6 6 6 6"/>',chev:'<path d="M9 6l6 6-6 6"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
spark:'<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
x:'<path d="M6 6l12 12M18 6L6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',pause:'<path d="M9 5v14M15 5v14"/>',playI:'<path d="M7 5l12 7-12 7z"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="M5 12l5 5 9-10"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
moon:'<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>',me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
game:'<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 11.5h.01M17 13.5h.01"/>',
chart:'<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',card:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
sliders:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
link:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',phone:'<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',home2:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',send:'<path d="M21 3L3 10l7 3 3 7z"/><path d="M10 13l11-10"/>',del:'<path d="M21 5H8l-6 7 6 7h13z"/><path d="M12 9l6 6M18 9l-6 6"/>'};
const ic=(n,s=22,w)=>`<svg viewBox="0 0 24 24" style="width:${s}px;height:${s}px${w?';stroke-width:'+w:''}">${I[n]}</svg>`;
