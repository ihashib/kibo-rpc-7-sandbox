import { L } from '../i18n.js';

// A key of the computer's key pad: the key, what it does (the tooltip) and its short label.
function key(code: string, k: string, title: string, label: string): string {
  return '<button data-key="' + code + '" title="' + title + ' (' + k + ')"><b>' + k + '</b><span>' + label + '</span></button>';
}

const MENU_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';

// The Shadow DOM markup, in the page's language; the element fills it in.
function template(): string {
  const waypointsTitle = L('Show the waypoint list (edit x, y, z and orientation)', 'ওয়েপয়েন্টের তালিকা দেখাও (x, y, z আর দিক বদলানো যায়)');
  return '\
<div class="root">\
  <header>\
    <div class="brand"><b>KIBO RPC 7 Nav Sandbox</b></div><div class="menuwrap viewswrap"><button class="btn viewsbtn" data-act="viewsmenu" aria-haspopup="true" aria-expanded="false" title="' + L('Pick a view', 'একটা ভিউ বেছে নাও') + '"><span class="vlbl">3D</span><span aria-hidden="true">&nbsp;▾</span></button></div>\
    <div class="seg views" role="group" aria-label="' + L('View', 'ভিউ') + '">\
      <button data-view="quad" aria-pressed="false">' + L('All', 'সব') + '</button><button data-view="3d" aria-pressed="false">3D</button><button data-view="top" aria-pressed="false" title="' + L('Top: seen from overhead. Drag a waypoint to set x and y', 'ওপর থেকে দেখা। ওয়েপয়েন্ট টেনে x আর y ঠিক করো') + '">' + L('Top', 'ওপর') + '</button><button data-view="side" aria-pressed="false" title="' + L('Side: the long side. Drag a waypoint to set x and z', 'লম্বা দিকের পাশ থেকে দেখা। ওয়েপয়েন্ট টেনে x আর z ঠিক করো') + '">' + L('Side', 'পাশ') + '</button><button data-view="end" aria-pressed="false" title="' + L('End: looking down the module. Drag a waypoint to set y and z', 'মডিউলের এক মাথা থেকে লম্বালম্বি দেখা। ওয়েপয়েন্ট টেনে y আর z ঠিক করো') + '">' + L('End', 'মাথা') + '</button><button data-view="cam" aria-pressed="false" title="' + L('Camera: what the robot camera sees and which AR markers it reads', 'রোবটের ক্যামেরা কী দেখছে আর কোন কোন AR মার্কার পড়তে পারছে') + '">' + L('Camera', 'ক্যামেরা') + '</button>\
    </div>\
    <div class="play">\
      <button class="btn" data-act="drive" aria-pressed="false" title="' + L('Fly the robot with the keyboard or joysticks and drop waypoints', 'কিবোর্ড বা জয়স্টিক দিয়ে রোবট নিজে চালাও আর পথে ওয়েপয়েন্ট বসাও') + '">' + L('Drive', 'ড্রাইভ') + '</button>\
      <button class="btn" data-act="play">' + L('▶ Play', '▶ চালাও') + '</button><button class="btn" data-act="pause" aria-pressed="false" aria-label="' + L('Pause', 'থামাও') + '" hidden></button><button class="btn" data-act="replay" aria-label="' + L('Play again', 'আবার চালাও') + '" hidden>↺<span class="plbl"> ' + L('Play again', 'আবার চালাও') + '</span></button>\
      <select data-f="speed" aria-label="' + L('Playback speed', 'চালানোর গতি') + '"><option value="1">1×</option><option value="2" selected>2×</option><option value="5">5×</option><option value="10">10×</option></select>\
      <button class="btn" data-act="saves">' + L('Saves', 'সেভ') + '</button>\
      <button class="btn drawerbtn" data-act="drawer" aria-pressed="false" title="' + waypointsTitle + '">' + MENU_ICON + '<span class="lbl">' + L('Waypoints', 'ওয়েপয়েন্ট') + '</span></button>\
      <button class="btn fsbtn" data-act="fullscreen" aria-pressed="false" title="' + L('Full screen (turns phones to landscape)', 'ফুল স্ক্রিন (ফোন আড়াআড়ি হয়ে যাবে)') + '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg><span class="lbl">' + L('Full screen', 'ফুল স্ক্রিন') + '</span></button>\
    </div>\
  </header>\
  <main>\
    <div class="viewport quad" tabindex="0" aria-label="' + L('Views. In Drive mode, use the keyboard here to fly the robot.', 'ভিউগুলো। ড্রাইভ মোডে এখানে কিবোর্ড দিয়ে রোবট চালাও।') + '">\
      <div class="cell" data-cell="3d"><div class="three"></div><div class="cap"><span class="mouse">' + L('3D · drag to orbit · scroll to zoom · click a waypoint', '3D · টেনে ঘোরাও · স্ক্রল করে জুম · ওয়েপয়েন্টে ক্লিক করো') + '</span><span class="touch">' + L('3D · drag to turn · pinch to zoom · double-tap resets', '3D · টেনে ঘোরাও · দুই আঙুলে জুম · দুবার ট্যাপ করলে আগের মতো') + '</span><span class="touch2">' + L('3D · swipe ↔ turn · pinch zoom · ⟲ wheel rolls', '3D · ↔ সোয়াইপে ঘোরাও · দুই আঙুলে জুম · ⟲ চাকা দিয়ে রোল') + '</span></div><button class="btn small fit" data-act="fit3d">' + L('Reset view', 'ভিউ আগের মতো') + '</button><div class="rollwheel" title="' + L('Drag up or down to roll the module about its long axis', 'ওপরে-নিচে টেনে মডিউলটাকে লম্বা অক্ষ বরাবর ঘোরাও') + '"><span aria-hidden="true">⟲</span></div><div class="legend"></div><div class="insets"><div class="inset" data-inset="cam"><div class="ih"><span></span><button class="icon" data-act="pipopen" title="' + L('Open the Camera view', 'ক্যামেরা ভিউ খোলো') + '" aria-label="' + L('Open the Camera view', 'ক্যামেরা ভিউ খোলো') + '">⤢</button><button class="icon" data-act="piphide" title="' + L('Hide the small views', 'ছোট ভিউগুলো লুকাও') + '" aria-label="' + L('Hide the small views', 'ছোট ভিউগুলো লুকাও') + '">✕</button></div><canvas data-act="pipopen" title="' + L('Open the Camera view', 'ক্যামেরা ভিউ খোলো') + '"></canvas></div><div class="inset" data-inset="map" hidden><div class="ih"><span></span></div><canvas data-act="mapopen" title="' + L('Open the Top view', 'ওপরের ভিউ খোলো') + '"></canvas></div></div><button class="btn small pipshow" data-act="pipshow" hidden>' + L('Camera', 'ক্যামেরা') + '</button><div class="msg3d"></div><button class="btn small maxbtn" data-act="maxview" data-v="3d" title="' + L('Make the 3D view fill the view (driving pauses)', '3D ভিউ বড় করে পুরো জায়গায় দেখাও (ড্রাইভ থেমে থাকবে)') + '">⤢ ' + L('Expand', 'বড় করো') + '</button></div>\
      <div class="cell" data-cell="top"><canvas></canvas><button class="btn small fit" data-act="fit" data-v="top">' + L('Fit', 'মানানসই') + '</button></div>\
      <div class="cell" data-cell="side"><canvas></canvas><button class="btn small fit" data-act="fit" data-v="side">' + L('Fit', 'মানানসই') + '</button></div>\
      <div class="cell" data-cell="end"><canvas></canvas><button class="btn small fit" data-act="fit" data-v="end">' + L('Fit', 'মানানসই') + '</button></div>\
      <div class="cell" data-cell="cam"><canvas></canvas><div class="caminfo"></div><button class="btn small maxbtn" data-act="maxview" data-v="cam" title="' + L('Make the camera fill the view (driving pauses)', 'ক্যামেরা বড় করে পুরো জায়গায় দেখাও (ড্রাইভ থেমে থাকবে)') + '">⤢ ' + L('Expand', 'বড় করো') + '</button></div>\
      <button class="btn primary backbtn" data-act="viewback" hidden></button>\
      <div class="boot" aria-hidden="true"></div>\
      <div class="toast" role="status" aria-live="polite"><span class="tmsg"></span><button class="tclose" data-act="toastclose" aria-label="' + L('Close this message', 'বার্তাটা বন্ধ করো') + '" title="' + L('Close', 'বন্ধ করো') + '">✕</button></div>\
      <div class="term" aria-label="' + L('Log', 'লগ') + '"><div class="tlines" aria-live="polite"></div><button class="termbtn" data-act="termtoggle" aria-expanded="true" aria-label="' + L('Collapse the log', 'লগ গুটিয়ে রাখো') + '" title="' + L('Collapse the log', 'লগ গুটিয়ে রাখো') + '">▾</button></div>\
      <div class="drive" hidden>\
        <div class="hud"><div class="hrow"><div data-h="1"></div><div data-h="3"></div></div><div class="hrow"><div data-h="2"></div><div data-h="4"></div></div></div>\
        <div class="jzone" data-zone="move"></div><div class="jzone" data-zone="turn"></div>\
        <div class="dpad">\
          <div class="joy" data-joy="move"><div class="halo"></div><div class="knob"></div><span>' + L('Move', 'চলো') + '</span></div>\
          <div class="kpad" aria-label="' + L('Move and roll keys', 'চলা আর রোলের কি') + '">\
            <div class="krow">' + key('KeyQ', 'Q', L('Turn the camera picture anticlockwise', 'ক্যামেরার ছবি ঘড়ির কাঁটার উল্টো দিকে ঘোরাও'), L('roll ⟲', 'রোল ⟲')) +
              key('KeyW', 'W', L('Forward', 'সামনে'), L('forward', 'সামনে')) +
              key('KeyE', 'E', L('Turn the camera picture clockwise', 'ক্যামেরার ছবি ঘড়ির কাঁটার দিকে ঘোরাও'), L('roll ⟳', 'রোল ⟳')) +
              key('KeyR', 'R', L('Up in the camera picture', 'ক্যামেরার ছবিতে ওপরে'), L('up', 'ওপরে')) + '</div>\
            <div class="krow">' + key('KeyA', 'A', L('Left', 'বাঁয়ে'), L('left', 'বাঁয়ে')) +
              key('KeyS', 'S', L('Back', 'পেছনে'), L('back', 'পেছনে')) +
              key('KeyD', 'D', L('Right', 'ডানে'), L('right', 'ডানে')) +
              key('KeyF', 'F', L('Down in the camera picture', 'ক্যামেরার ছবিতে নিচে'), L('down', 'নিচে')) + '</div>\
            <div class="kcap">' + L('Move and roll', 'চলা আর রোল') + '</div>\
          </div>\
          <div class="dmid">\
            <div class="vbtns"><button class="btn" data-hold="up" aria-label="' + L('Up', 'ওপরে') + '" title="' + L('Move up in the camera picture', 'ক্যামেরার ছবিতে ওপরে যাও') + '">▲<span class="lbl"> ' + L('Up', 'ওপরে') + '</span></button><button class="btn" data-hold="down" aria-label="' + L('Down', 'নিচে') + '" title="' + L('Move down in the camera picture', 'ক্যামেরার ছবিতে নিচে যাও') + '">▼<span class="lbl"> ' + L('Down', 'নিচে') + '</span></button><button class="btn" data-hold="rollL" aria-label="' + L('Roll anticlockwise', 'ঘড়ির কাঁটার উল্টো দিকে রোল') + '" title="' + L('Turn the camera picture anticlockwise', 'ক্যামেরার ছবি ঘড়ির কাঁটার উল্টো দিকে ঘোরাও') + '">⟲<span class="lbl"> ' + L('Roll', 'রোল') + '</span></button><button class="btn" data-hold="rollR" aria-label="' + L('Roll clockwise', 'ঘড়ির কাঁটার দিকে রোল') + '" title="' + L('Turn the camera picture clockwise', 'ক্যামেরার ছবি ঘড়ির কাঁটার দিকে ঘোরাও') + '">⟳<span class="lbl"> ' + L('Roll', 'রোল') + '</span></button></div>\
            <div class="dbtns"><button class="btn primary" data-act="driveadd">' + L('Add waypoint here', 'এখানে ওয়েপয়েন্ট বসাও') + '</button><button class="btn drawerbtn listbtn" data-act="drawer" aria-pressed="false" aria-label="' + L('Waypoints', 'ওয়েপয়েন্ট') + '" title="' + waypointsTitle + '">' + MENU_ICON + '<span class="lbl">' + L('Waypoints', 'ওয়েপয়েন্ট') + '</span></button><button class="btn" data-act="driveupdate">' + L('Move selected here', 'বাছাই করাটা এখানে আনো') + '</button><button class="btn" data-act="drivefine" aria-pressed="false">' + L('Fine', 'ধীরে') + '<kbd>Shift</kbd></button><button class="btn" data-act="drivereset" title="' + L('Back to where you started driving, upright', 'যেখান থেকে চালানো শুরু করেছিলে, সোজা হয়ে সেখানে ফিরে যাও') + '">' + L('Reset', 'শুরুতে ফেরো') + '<kbd>H</kbd></button></div>\
            <div class="keys">' + L('Keys work anywhere on the page while Drive is on (not while typing in a box).', 'ড্রাইভ চালু থাকলে পাতার যেকোনো জায়গা থেকে কি কাজ করে (কোনো বক্সে লেখার সময় বাদে)।') + '</div>\
          </div>\
          <div class="joy" data-joy="turn"><div class="halo"></div><div class="knob"></div><span>' + L('Turn / look', 'ঘোরাও / দেখো') + '</span></div>\
          <div class="kpad" aria-label="' + L('Turn and look keys', 'ঘোরানো আর দেখার কি') + '">\
            <div class="krow"><span class="kgap"></span>' + key('ArrowUp', '↑', L('Look up', 'ওপরে তাকাও'), L('look up', 'ওপরে দেখো')) + '<span class="kgap"></span></div>\
            <div class="krow">' + key('ArrowLeft', '←', L('Turn left', 'বাঁয়ে ঘোরো'), L('turn left', 'বাঁয়ে ঘোরো')) +
              key('ArrowDown', '↓', L('Look down', 'নিচে তাকাও'), L('look down', 'নিচে দেখো')) +
              key('ArrowRight', '→', L('Turn right', 'ডানে ঘোরো'), L('turn right', 'ডানে ঘোরো')) + '</div>\
            <div class="kcap">' + L('Turn and look', 'ঘোরা আর দেখা') + '</div>\
          </div>\
        </div>\
      </div>\
    </div>\
    <footer class="status"></footer>\
    <aside class="panel">\
      <div class="tabs" role="tablist"><button role="tab" data-tab="route">' + L('Route', 'রুট') + '</button><button role="tab" data-tab="code">' + L('Code', 'কোড') + '</button><button role="tab" data-tab="world">' + L('World', 'ওয়ার্ল্ড') + '</button><button class="icon drawerclose" data-act="drawer" aria-label="' + L('Close the waypoint list', 'ওয়েপয়েন্টের তালিকা বন্ধ করো') + '" title="' + L('Close', 'বন্ধ করো') + '">✕</button></div>\
      <section class="pane" data-pane="route">\
        <details class="mission" open><summary><b>' + L('Mission', 'মিশন') + '</b><span class="mcount"></span></summary>\
          <div class="mlevel"><label>' + L('Level', 'লেভেল') + ' <select data-f="level" aria-label="' + L('Difficulty level', 'কঠিনতার লেভেল') + '"><option value="easy">' + L('Easy · 6', 'সহজ · 6') + '</option><option value="normal">' + L('Normal · 8', 'মাঝারি · 8') + '</option><option value="hard">' + L('Hard · 10', 'কঠিন · 10') + '</option><option value="veryhard">' + L('Very Hard · 12', 'খুব কঠিন · 12') + '</option><option value="other" hidden disabled>' + L('Other', 'অন্য') + '</option></select></label><button class="btn small" data-act="newcps" title="' + L('Draw a new random layout at this level', 'এই লেভেলে এলোমেলো নতুন একটা লেআউট বানাও') + '">' + L('New layout', 'নতুন লেআউট') + '</button><span class="mgap"></span></div>\
          <p class="note mrule"></p>\
          <p class="note mscore" hidden></p>\
          <ul class="goals"></ul>\
        </details>\
        <div class="toolbar">\
          <button class="btn primary" data-act="add" title="' + L('Add a waypoint after the selected one', 'বাছাই করা ওয়েপয়েন্টের পরে নতুন একটা যোগ করো') + '">' + L('+ Waypoint', '+ ওয়েপয়েন্ট') + '</button>\
          <div class="menuwrap" data-guided><button class="btn primary" data-act="goto" aria-haspopup="true">' + L('Go to… ▾', 'যাও… ▾') + '</button><div class="menu" data-menu="goto" hidden></div></div>\
          <button class="btn" data-act="fixall" data-guided>' + L('Fix blocked moves', 'আটকে যাওয়া পথ ঠিক করো') + '</button>\
          <div class="menuwrap"><button class="btn" data-act="more" aria-haspopup="true" aria-label="' + L('More', 'আরও') + '">⋯</button><div class="menu" data-menu="more" hidden>\
            <button data-act="undo">' + L('Undo', 'আগের অবস্থায় ফেরো') + '<small>Ctrl/⌘+Z</small></button>\
            <button data-act="example" data-guided>' + L('Load the starter route', 'শুরুর উদাহরণ রুট আনো') + '<small>' + L('One worked example and three rough waypoints to fix', 'একটা করে দেখানো উদাহরণ, আর ঠিক করার জন্য তিনটা কাঁচা ওয়েপয়েন্ট') + '</small></button>\
            <button data-act="clear">' + L('Clear the route', 'রুট মুছে ফেলো') + '</button>\
          </div></div>\
        </div>\
        <div class="list"></div>\
      </section>\
      <section class="pane" data-pane="code" hidden>\
        <div class="toolbar"><div class="seg" role="group" aria-label="' + L('Language', 'প্রোগ্রামিং ভাষা') + '"><button data-lang="python" aria-pressed="true">Python</button><button data-lang="cpp" aria-pressed="false">C++</button></div>\
          <button class="btn primary" data-act="copycode">' + L('Copy Python', 'Python কপি করো') + '</button><button class="btn" data-act="copyjson">' + L('Copy route JSON', 'রুটের JSON কপি করো') + '</button></div>\
        <pre class="code" tabindex="0"></pre>\
        <p class="note" data-lang-note="python">' + L('For the 7th Kibo-RPC Python template (<code>scripts/user_template.py</code>): paste it between the <code>USER EDIT AREA</code> markers in <code>__run_user_flow()</code>; it is already indented for that spot. One <code>/ctl/command</code> move per waypoint, then <code>/event/checkpoint_passed</code> at each waypoint meant for a checkpoint. The simulator draws new checkpoints every run, so your final program must read them from <code>/mission/get_checkpoints</code> instead of using these numbers. The template is under <code>"exportPython"</code> in the World JSON.',
          'সপ্তম Kibo-RPC-র Python টেমপ্লেটের (<code>scripts/user_template.py</code>) জন্য: <code>__run_user_flow()</code>-এর ভেতরে <code>USER EDIT AREA</code> চিহ্ন দুটোর মাঝে পেস্ট করো; ওই জায়গার মাপে ইনডেন্ট করাই আছে। প্রতিটা ওয়েপয়েন্টের জন্য একটা করে <code>/ctl/command</code> মুভ, আর যে ওয়েপয়েন্ট কোনো চেকপয়েন্টের জন্য, সেখানে <code>/event/checkpoint_passed</code>। সিমুলেটর প্রতিবার নতুন চেকপয়েন্ট বানায়, তাই তোমার আসল প্রোগ্রামকে এই সংখ্যাগুলো ব্যবহার না করে <code>/mission/get_checkpoints</code> থেকে চেকপয়েন্ট পড়ে নিতে হবে। টেমপ্লেটটা World JSON-এর <code>"exportPython"</code>-এর ভেতরে আছে।') + '</p>\
        <p class="note" data-lang-note="cpp" hidden>' + L('For the C++14 template (<code>src/user_template_node.cpp</code>), after <code>mission_start</code>. It makes its own Action clients; if your template already has them, use those (and cancel their goals in your <code>/ib2_user/stop</code> handler). The simulator draws new checkpoints every run, so your final program must read them from <code>/mission/get_checkpoints</code>. The template is under <code>"export"</code> in the World JSON.',
          'C++14 টেমপ্লেটের (<code>src/user_template_node.cpp</code>) জন্য, <code>mission_start</code>-এর পরে। এটা নিজের Action client বানিয়ে নেয়; তোমার টেমপ্লেটে আগে থেকেই থাকলে সেগুলোই ব্যবহার করো (আর তোমার <code>/ib2_user/stop</code> হ্যান্ডলারে সেগুলোর goal বাতিল করো)। সিমুলেটর প্রতিবার নতুন চেকপয়েন্ট বানায়, তাই আসল প্রোগ্রামকে <code>/mission/get_checkpoints</code> থেকে সেগুলো পড়ে নিতে হবে। টেমপ্লেটটা World JSON-এর <code>"export"</code>-এর ভেতরে আছে।') + '</p>\
      </section>\
      <section class="pane" data-pane="world" hidden>\
        <h4>' + L('Settings', 'সেটিংস') + '</h4>\
        <div class="settings">\
          <label>' + L('Clearance (m)', 'দেয়াল থেকে দূরত্ব (মি)') + '<input type="number" step="0.01" min="0" data-s="clearance"></label>\
          <label>' + L('Standoff (m)', 'টার্গেট থেকে দূরত্ব (মি)') + '<input type="number" step="0.05" min="0" data-s="standoff"></label>\
          <label>' + L('Speed (m/s)', 'গতি (মি/সে)') + '<input type="number" step="0.01" min="0.01" data-s="speed"></label>\
          <label>' + L('Turn rate (°/s)', 'ঘোরার হার (°/সে)') + '<input type="number" step="1" min="1" data-s="turnRate"></label>\
          <label>' + L('Grid for auto-route (m)', 'অটো-রুটের গ্রিড (মি)') + '<input type="number" step="0.01" min="0.01" data-s="gridRes"></label>\
          <label>' + L('Snap when dragging (m)', 'টানার সময় স্ন্যাপ (মি)') + '<input type="number" step="0.005" min="0" data-s="snap"></label>\
        </div>\
        <h4>' + L('Checkpoints', 'চেকপয়েন্ট') + '</h4>\
        <div class="row"><button class="btn" data-act="newcps">' + L('New random checkpoints (same level)', 'নতুন এলোমেলো চেকপয়েন্ট (একই লেভেল)') + '</button><button class="btn" data-act="samplecps">' + L('Back to the sample layout', 'নমুনা লেআউটে ফেরো') + '</button></div>\
        <p class="note">' + L('The simulator draws a new layout every run: 6 to 12 checkpoints by difficulty level (Easy, Normal, Hard, Very Hard), goal last. Pick the level above the Mission list. The documents don\'t say how many checkpoints each level has, so the sandbox\'s 6, 8, 10 and 12 are assumed. Practise on a few. To try a layout from your own simulator run, paste the <code>/mission/get_checkpoints</code> message from its log into the World JSON box and press Apply. Each checkpoint\'s margins are in the JSON.',
          'সিমুলেটর প্রতিবার নতুন লেআউট বানায়: কঠিনতার লেভেল (Easy, Normal, Hard, Very Hard) অনুযায়ী 6 থেকে 12টা চেকপয়েন্ট, সবশেষে গোল পয়েন্ট। মিশনের তালিকার ওপরে লেভেল বেছে নাও। কোন লেভেলে কয়টা চেকপয়েন্ট থাকে, ডকুমেন্টে তা বলা নেই, তাই স্যান্ডবক্সের 6, 8, 10 আর 12 অনুমান করে নেওয়া। কয়েকটা লেআউটে অনুশীলন করো। নিজের সিমুলেটর রানের লেআউট চালিয়ে দেখতে চাইলে তার লগ থেকে <code>/mission/get_checkpoints</code> মেসেজটা World JSON বক্সে পেস্ট করে ‘প্রয়োগ করো’ চাপো। প্রতিটা চেকপয়েন্টের মার্জিন JSON-এ দেওয়া আছে।') + '</p>\
        <h4>' + L('Target and pose goals', 'টার্গেট আর পোজের লক্ষ্য') + '</h4>\
        <div class="settings three">\
          <label>' + L('Aim within (°)', 'নিশানার সীমা (°)') + '<input type="number" step="1" min="0" data-s="aimTolerance"></label>\
          <label>' + L('Distance ± (m)', 'দূরত্ব ± (মি)') + '<input type="number" step="0.05" min="0" data-s="rangeTolerance"></label>\
          <label>' + L('Pose within (m)', 'পোজের সীমা (মি)') + '<input type="number" step="0.01" min="0" data-s="poseTolerance"></label>\
        </div>\
        <p class="note">' + L('Only for worlds with target or pose goals in their mission (the 7th world uses checkpoints). A target counts as captured when the camera is within the aim angle of its centre and the distance is the standoff ± this value. A pose goal needs the position within the pose distance and the orientation within the aim angle.',
          'শুধু সেসব ওয়ার্ল্ডের জন্য, যাদের মিশনে টার্গেট বা পোজের লক্ষ্য আছে (সপ্তম রাউন্ডের ওয়ার্ল্ডে আছে চেকপয়েন্ট)। ক্যামেরা টার্গেটের কেন্দ্র থেকে নিশানার কোণের মধ্যে থাকলে, আর দূরত্ব টার্গেট-দূরত্ব ± এই মানের মধ্যে থাকলে টার্গেট ধরা হয়েছে বলে গোনা হয়। পোজের লক্ষ্যে অবস্থান থাকতে হবে পোজের সীমার মধ্যে, আর দিক থাকতে হবে নিশানার কোণের মধ্যে।') + '</p>\
        <h4>' + L('Keep-Out Zones', 'কিপ-আউট জোন') + '</h4>\
        <button class="btn" data-act="addkoz">' + L('Add a Keep-Out Zone', 'কিপ-আউট জোন যোগ করো') + '</button>\
        <div class="kozlist"></div>\
        <h4>World JSON</h4>\
        <textarea class="json" spellcheck="false" aria-label="World JSON"></textarea>\
        <div class="row"><button class="btn primary" data-act="applyjson">' + L('Apply', 'প্রয়োগ করো') + '</button><button class="btn" data-act="copyworld">' + L('Copy', 'কপি করো') + '</button><button class="btn" data-act="resetworld">' + L('Reset to defaults', 'শুরুর মানে ফেরো') + '</button></div>\
        <div class="err" data-err="json"></div>\
        <p class="note">' + L('Positions are in the <code>iss_body</code> frame, metres, with the Int-Ball2 dock at (0.2, 0, 0); +z points to the deck (worked out from the AR marker orientations). Quaternions are [x, y, z, w]; the camera looks along body +X and body +Z is the robot\'s top. The AR markers and dock come from the 7th Kibo-RPC rulebook. The keep-in box is not published: it is a guess spanning the walls the markers are on.',
          'অবস্থানগুলো <code>iss_body</code> ফ্রেমে, মিটারে; Int-Ball2-এর ডক (0.2, 0, 0)-তে, আর +z মেঝের দিকে (AR মার্কারগুলোর দিক থেকে বের করা)। কোয়াটারনিয়ন [x, y, z, w] আকারে; ক্যামেরা বডির +X বরাবর তাকায়, আর বডির +Z রোবটের মাথার দিক। AR মার্কার আর ডকের তথ্য সপ্তম Kibo-RPC-র রুলবুক থেকে নেওয়া। কিপ-ইন বক্স কোথাও প্রকাশ করা হয়নি: মার্কারগুলো যে দেয়ালে আছে, সেগুলো জুড়ে এটা একটা অনুমান।') + '</p>\
      </section>\
    </aside>\
  </main>\
  <div class="overlay" hidden><div class="dialog" role="dialog" aria-label="' + L('Saves and progress', 'সেভ আর অগ্রগতি') + '">\
    <div class="dh"><b>' + L('Saves &amp; progress', 'সেভ আর অগ্রগতি') + '</b><button class="icon" data-act="closesaves" aria-label="' + L('Close', 'বন্ধ করো') + '">✕</button></div>\
    <p class="note" data-autosave></p>\
    <h4>' + L('Saved routes', 'সেভ করা রুট') + '</h4>\
    <div class="row"><input type="text" data-f="savename" placeholder="' + L('Name this save, e.g. Try 2', 'এই সেভের একটা নাম দাও, যেমন চেষ্টা 2') + '" maxlength="60"><button class="btn primary" data-act="savenew">' + L('Save', 'সেভ করো') + '</button></div>\
    <div class="savelist"></div>\
    <h4>' + L('Backup file', 'ব্যাকআপ ফাইল') + '</h4>\
    <p class="note">' + L('Keep your work when you change device or clear the browser.', 'ডিভাইস বদলালে বা ব্রাউজার পরিষ্কার করলেও যাতে কাজ হারিয়ে না যায়।') + '</p>\
    <div class="row"><button class="btn" data-act="exportfile">' + L('Download backup', 'ব্যাকআপ ডাউনলোড করো') + '</button><button class="btn" data-act="importfile">' + L('Load backup…', 'ব্যাকআপ লোড করো…') + '</button><input type="file" accept=".json,application/json" hidden></div>\
    <h4>' + L('Progress', 'অগ্রগতি') + '</h4>\
    <ul class="progress"></ul>\
    <div class="row" style="margin-top:14px"><button class="btn danger" data-act="wipe">' + L('Delete all saved data', 'জমা থাকা সব ডেটা মুছে ফেলো') + '</button></div>\
  </div></div>\
</div>';
}

export { template };
