// The Shadow DOM stylesheet.
const CSS = '\
:host{all:initial;display:block;contain:content}\
:host([hidden]){display:none}\
*,*::before,*::after{box-sizing:border-box}\
.root{--bg:#f6f7fb;--panel:#fff;--fg:#1d2433;--muted:#5b6475;--border:#d9dde7;--accent:#3156d3;--accent-fg:#fff;--ok:#11806a;--bad:#cf3434;--chip-ok:#e1f4ee;--chip-bad:#fde6e6;--input:#fff;--code:#f2f4f9;--hover:#eef1f8;\
--view-bg:#eef1f7;--grid:#cdd3df;--kiz:#1f9d6b;--oasis:#c98a12;--koz:#d23c3c;--target:#3b6cf6;--route:#0e8f7e;--wp:#ea7210;--sel:#7b4ce0;--robot:#6f788b;--cam:#3b6cf6;--cp:#b4359c;--top:#d4570f;\
font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Bengali",sans-serif;color:var(--fg);background:var(--bg);\
display:grid;grid-template-rows:auto auto;border:1px solid var(--border);border-radius:12px;overflow:hidden;position:relative}\
.root.dark{--bg:#11141b;--panel:#181c25;--fg:#e6e9f0;--muted:#9aa3b5;--border:#2c3342;--accent:#86a2ff;--accent-fg:#0d1020;--ok:#3ccf9f;--bad:#ff6b6b;--chip-ok:#123a30;--chip-bad:#40191d;--input:#10131a;--code:#0f1218;--hover:#222838;\
--view-bg:#0c0f15;--grid:#283041;--kiz:#3ccf9f;--oasis:#f0b54a;--koz:#ff6b6b;--target:#86a2ff;--route:#41d6c3;--wp:#ff9f43;--sel:#c4a5ff;--robot:#aab3c5;--cam:#86a2ff;--cp:#f07ad8;--top:#ff9b5c}\
button,input,select,textarea{font:inherit;color:inherit}\
button{cursor:pointer}\
:focus-visible{outline:2px solid var(--accent);outline-offset:1px}\
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 10px;border-bottom:1px solid var(--border);background:var(--panel)}\
.brand{display:flex;align-items:baseline;gap:8px;margin-right:auto;min-width:0}\
.brand b{font-size:15px;white-space:nowrap}\
.tag{font-size:12px;color:var(--muted);white-space:nowrap}\
.seg{display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}\
.seg button{border:0;background:transparent;padding:5px 10px;min-height:32px}\
.seg button+button{border-left:1px solid var(--border)}\
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-fg)}\
.btn{border:1px solid var(--border);background:var(--panel);border-radius:8px;padding:5px 10px;min-height:32px;white-space:nowrap}\
.btn:hover{background:var(--hover)}\
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}\
.btn.small{padding:2px 8px;min-height:26px;font-size:12.5px}\
.btn.danger{color:var(--bad)}\
.btn:disabled{opacity:.45;cursor:default}\
.play{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}\
select,input[type=number],input[type=text],textarea{background:var(--input);border:1px solid var(--border);border-radius:6px;padding:3px 6px;min-height:30px}\
main{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:var(--vh,min(680px,78vh)) auto var(--ph,min(480px,75vh));min-height:0}\
.viewport{position:relative;display:grid;gap:1px;background:var(--border);min-height:0;min-width:0}\
.viewport.quad{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}\
.viewport:not(.quad){grid-template-columns:1fr;grid-template-rows:1fr}\
.viewport:not(.quad) .cell:not(.on){display:none}\
.viewport.quad .cell[data-cell=cam]{display:none}\
.viewport.split:not(.quad){grid-template-columns:1fr 1fr;grid-template-rows:1fr}\
.viewport.split .cell[data-cell=cam]{grid-column:1;grid-row:1}\
.viewport.split .cell[data-cell="3d"]{grid-column:2;grid-row:1}\
.root.narrow .viewport.split:not(.quad){grid-template-columns:1fr;grid-template-rows:1fr 1fr}\
.root.narrow .viewport.split .cell[data-cell="3d"]{grid-column:1;grid-row:2}\
.term{display:none;position:relative;min-height:0;overflow:hidden;background:#0e131b;color:#c3cddb;font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;border-top:1px solid #222b38;border-bottom:1px solid #222b38}\
.term .tlines{height:100%;overflow-y:auto;padding:4px 40px 4px 9px;overscroll-behavior:contain}\
.term .termbtn{position:absolute;top:2px;right:4px;width:30px;height:22px;border:1px solid #2c3746;border-radius:5px;background:#18202c;color:#c3cddb;font-size:11px;line-height:1;cursor:pointer;padding:0}\
.term .termbtn:hover{background:#222c3a}\
.root.term-min .term .tlines{padding-top:4px;padding-bottom:3px;overflow:hidden}\
.root.term-min .term .tlines>div:not(:last-child){display:none}\
@media (pointer:coarse){.term .termbtn{width:36px;height:24px}}\
.term .tlines>div{white-space:normal;overflow-wrap:anywhere}\
.root.term-min .term .tlines>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.term .t-ar{color:#5fd4f0}.term .t-ok{color:#4fd69c}.term .t-warn{color:#f0c060}.term .t-bad{color:#ff7a7a}.term .t-head{color:#fff;font-weight:700}\
.term .t-time{color:#5b6779;margin-right:6px}\
.viewport.split .term{display:block}\
.viewport.split .caminfo,.viewport.split .legend{display:none}\
.viewport.split:not(.quad){grid-template-rows:minmax(0,1fr) 64px}\
.root.term-min .viewport.split:not(.quad){grid-template-rows:minmax(0,1fr) 26px}\
.viewport.split .term{grid-column:1/span 2;grid-row:2}\
.root.narrow .viewport.split:not(.quad){grid-template-rows:minmax(0,1fr) 58px minmax(0,1fr)}\
.root.narrow.term-min .viewport.split:not(.quad){grid-template-rows:minmax(0,1fr) 28px minmax(0,1fr)}\
.root.narrow .viewport.split .term{grid-column:1;grid-row:2}\
.root.narrow .viewport.split .cell[data-cell="3d"]{grid-row:3}\
.root.short .viewport.split:not(.quad),.root.short.term-min .viewport.split:not(.quad){grid-template-rows:minmax(0,1fr)}\
.root.short .viewport.split .term{position:absolute;grid-row:auto;grid-column:auto;left:calc(50% + 8px);right:8px;top:38px;height:52px;z-index:3;opacity:.92;border-radius:6px;border:0}\
.root.short.term-min .viewport.split .term{height:28px}\
.root.driving .viewport.split{padding-bottom:var(--dpadh,0px);background:var(--view-bg)}\
.viewport.split .cell[data-cell="3d"]{box-shadow:inset 1px 0 0 var(--border)}\
.maxbtn{display:none;position:absolute;right:6px;bottom:6px;z-index:5}\
.viewport.split .maxbtn{display:inline-block}\
.root.driving .maxbtn{display:none!important}\
.root.short .maxbtn{top:98px;bottom:auto}\
.backbtn{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;box-shadow:0 4px 14px rgba(0,0,0,.25)}\
.backbtn[hidden]{display:none}\
.root.drive-paused .dpad,.root.drive-paused .jzone{display:none!important}\
.root.cam-max .caminfo{display:none}\
@media (pointer:coarse){.maxbtn,.backbtn{min-height:40px;padding:4px 14px;font-size:14px}}\
.root.narrow .viewport.split .cell[data-cell="3d"]{box-shadow:inset 0 1px 0 var(--border)}\
.caminfo{position:absolute;left:8px;right:8px;bottom:8px;max-height:44%;overflow:auto;background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--border);border-radius:8px;padding:6px 9px;font-size:12.5px;z-index:2}\
.caminfo .ch{display:flex;align-items:center;gap:8px;margin-bottom:3px}\
.caminfo .ch b{margin-right:auto}\
.caminfo .m{padding:3px 0;border-top:1px solid var(--border)}\
.caminfo code{font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;color:var(--muted);word-break:break-word}\
.caminfo .ok{color:var(--ok)}\
.caminfo .bad{color:var(--bad)}\
.caminfo .note{margin:3px 0 0}\
.cell{position:relative;background:var(--view-bg);min-width:0;min-height:0;overflow:hidden}\
.cell canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}\
.root.scroll3d .cell[data-cell=cam] canvas{touch-action:pan-y}\
.cell .three{position:absolute;inset:0}\
.cell .three canvas{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}\
.cell .cap{position:absolute;left:8px;top:6px;font-size:12px;color:var(--muted);pointer-events:none;background:color-mix(in srgb,var(--view-bg) 80%,transparent);padding:1px 4px;border-radius:4px}\
.cell .fit{position:absolute;right:6px;top:6px}\
.msg3d{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:20px;color:var(--muted)}\
.viewport:focus{outline:none}\
.viewport:focus-visible{box-shadow:inset 0 0 0 2px var(--accent)}\
.btn[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}\
/* The Zero-g toggle switch in Drive: a track with a knob that slides right (accent) when it is on. */\
.zgswitch{display:inline-flex;align-items:center;gap:7px}\
.dbtns .haltbtn{display:inline-flex;align-items:center;justify-content:center;visibility:hidden}\
.mvl{display:inline-grid;justify-items:center}\
.mvl>span{grid-area:1/1}\
.mvl>span~span{visibility:hidden}\
.root.zerog .dbtns .haltbtn{visibility:visible}\
.zgswitch .sw{position:relative;flex:none;width:30px;height:17px;border-radius:9px;background:var(--border);transition:background .15s}\
.zgswitch .sw::after{content:"";position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.35);transition:transform .15s}\
.zgswitch[aria-checked=true] .sw{background:var(--accent)}\
.zgswitch[aria-checked=true] .sw::after{transform:translateX(13px)}\
@media (prefers-reduced-motion:reduce){.zgswitch .sw,.zgswitch .sw::after{transition:none}}\
.drive{position:absolute;inset:0;pointer-events:none;z-index:4;display:flex;flex-direction:column;justify-content:space-between}\
.drive[hidden]{display:none}\
.hud{margin:30px 8px 0;align-self:flex-start;max-width:min(560px,calc(100% - 16px));background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--border);border-radius:8px;padding:5px 9px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;color:var(--fg)}\
.hud .ok{color:var(--ok)}\
.hud .bad{color:var(--bad)}\
.hud .mut{color:var(--muted)}\
.dpad{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:8px 8px 24px}\
.dmid{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;flex:1;position:relative;z-index:2}\
.dbtns,.vbtns{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:auto}\
.keys{font-size:11.5px;color:var(--muted);background:color-mix(in srgb,var(--panel) 90%,transparent);padding:3px 8px;border-radius:6px;text-align:center}\
.keys b{color:var(--fg);font-weight:600}\
.viewport{container-type:inline-size}\
.kpad{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:4px;flex:none;background:color-mix(in srgb,var(--panel) 90%,transparent);border:1px solid var(--border);border-radius:10px;padding:6px 6px 4px}\
.krow{display:flex;gap:4px}\
.kpad button{width:50px;height:46px;padding:0;border:1px solid var(--border);border-bottom-width:3px;border-radius:7px;background:var(--panel);display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none}\
.kpad button:hover{background:var(--hover)}\
.kpad button b{font-size:15px;line-height:1.1}\
.kpad button span{font-size:9.5px;line-height:1.1;color:var(--muted);white-space:nowrap}\
.kpad button.on{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}\
.kpad button.on span{color:var(--accent-fg)}\
.kgap{width:50px}\
.kcap{font-size:11px;color:var(--muted)}\
kbd{font:600 10.5px ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;border:1px solid currentColor;border-radius:4px;padding:0 3px;margin-left:5px;opacity:.75}\
@container (max-width:760px){.kpad button{width:40px;height:38px}.kpad button span{display:none}.kgap{width:40px}}\
@container (max-width:520px){.kpad{display:none}}\
.root.sticks .kpad,.root.sticks kbd{display:none}\
.joy{pointer-events:auto;touch-action:none;width:120px;height:120px;z-index:1;border-radius:50%;border:2px solid var(--border);background:color-mix(in srgb,var(--panel) 75%,transparent);position:relative;flex:none;user-select:none;-webkit-user-select:none}\
.jzone{display:none;position:absolute;border-radius:50%;pointer-events:auto;touch-action:none}\
.jzone[data-zone=move]{left:0}\
.cap .touch{display:none}\
.cap .touch2{display:none}\
.root.scroll3d .cap .touch{display:none!important}\
.root.scroll3d .cap .touch2{display:inline}\
.root.scroll3d .cell[data-cell="3d"] .cap{max-width:calc(100% - 124px)}\
.rollwheel{display:none}\
.root.scroll3d .rollwheel{display:flex;flex-direction:column;align-items:center;position:absolute;left:6px;top:50%;transform:translateY(-50%);z-index:4;width:34px;height:min(190px,calc(100% - 96px));min-height:90px;box-sizing:border-box;padding-top:4px;border:1px solid var(--border);border-radius:17px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:ns-resize;background-color:color-mix(in srgb,var(--panel) 72%,transparent);background-image:repeating-linear-gradient(to bottom,color-mix(in srgb,var(--muted) 55%,transparent) 0 2px,transparent 2px 9px);background-size:12px 9px;background-repeat:repeat-y;background-position:center 0}\
.rollwheel span{font-size:15px;line-height:1;color:var(--fg);background:color-mix(in srgb,var(--panel) 90%,transparent);border-radius:50%;padding:2px}\
.rollwheel.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)}\
@media (pointer:coarse){.cap .touch{display:inline}.cap .mouse{display:none}}\
.jzone[data-zone=turn]{right:0}\
.root.sticks .jzone{display:block}\
.dpad{position:relative}\
.joy .halo{position:absolute;inset:-36px;border-radius:50%;background:color-mix(in srgb,var(--accent) 7%,transparent);touch-action:none}\
.joy .knob{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:var(--accent);opacity:.85;pointer-events:none}\
.joy span{position:absolute;left:-10px;right:-10px;bottom:-19px;text-align:center;font-size:11px;color:var(--muted)}\
.vbtns .btn{touch-action:none;user-select:none;-webkit-user-select:none}\
.root:not(.sticks) .joy,.root:not(.sticks) .vbtns{display:none}\
.root.sticks .keys{display:none}\
.root.driving .legend{display:none}\
.insets{position:absolute;right:8px;top:42px;width:var(--iw,300px);display:flex;flex-direction:column;gap:6px;z-index:3;pointer-events:none}\
.inset{background:color-mix(in srgb,var(--panel) 94%,transparent);border:1px solid var(--border);border-radius:8px;overflow:hidden;pointer-events:auto;box-shadow:0 2px 10px rgba(0,0,0,.12)}\
.inset[hidden]{display:none}\
.inset .ih{display:flex;align-items:center;gap:2px;padding:2px 3px 2px 8px;font-size:11.5px;min-height:24px}\
.inset .ih span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.inset .icon{min-width:22px;height:22px;font-size:12px}\
.cell .inset canvas{position:static;inset:auto;display:block;width:100%;cursor:pointer;touch-action:auto}\
.pipshow{position:absolute;right:8px;top:42px;z-index:3}\
.root.insets-on .hud{max-width:min(560px,calc(100% - var(--iw,300px) - 32px))}\
.viewport{overflow:hidden}\
.root.driving .toast{bottom:auto;top:100px}\
.root.narrow main{grid-template-rows:min(var(--vh,520px),62vh) auto var(--ph,min(480px,75vh))}\
.root.narrow.driving main{grid-template-rows:min(640px,80vh) auto var(--ph,min(480px,75vh))}\
.root.narrow .hud{margin-top:28px;font-size:10.5px;line-height:1.4;padding:4px 7px}\
.root.narrow .hud [data-h="3"]{display:none}\
.root.driving .caminfo{display:none}\
.root.narrow .dpad{flex-wrap:wrap;row-gap:8px}\
.root.narrow .dmid{order:-1;flex-basis:100%}\
.root.narrow .vbtns .lbl{display:none}\
.root.narrow .vbtns .btn{min-width:52px}\
.root.narrow .dbtns{flex-wrap:nowrap}\
.root.narrow .dbtns .btn{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}\
.root.narrow .dpad{padding:6px 6px 20px;column-gap:4px}\
.root.narrow .joy{width:100px;height:100px}\
.root.narrow .joy .halo{inset:-30px}\
.root.narrow .joy .knob{width:42px;height:42px;margin:-21px 0 0 -21px}\
.root.narrow .dmid .btn{padding:3px 9px;min-height:32px;font-size:13px}\
.root.narrow .vbtns{flex-wrap:nowrap}\
.legend{position:absolute;left:8px;bottom:8px;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;color:var(--muted);background:color-mix(in srgb,var(--view-bg) 85%,transparent);padding:3px 6px;border-radius:6px;pointer-events:none;max-width:calc(100% - 16px)}\
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}\
.toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:max-content;max-width:min(calc(100% - 24px),520px);display:flex;align-items:flex-start;gap:6px;background:var(--fg);color:var(--bg);padding:8px 6px 8px 12px;border-radius:10px;font-size:13.5px;line-height:1.4;box-shadow:0 4px 18px rgba(0,0,0,.25);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s,visibility .2s;z-index:5}\
.toast .tmsg{flex:1;min-width:0;padding-top:2px}\
.toast .tclose{flex:none;border:0;background:transparent;color:inherit;font-size:15px;width:30px;height:30px;margin:-4px 0 -4px;border-radius:6px;opacity:.8;cursor:pointer}\
.toast .tclose:hover{opacity:1;background:color-mix(in srgb,var(--bg) 18%,transparent)}\
@media (pointer:coarse){.toast{font-size:14px;padding:10px 6px 10px 14px}.toast .tclose{width:40px;height:40px;font-size:17px;margin:-8px 0}}\
.toast.on{opacity:1;visibility:visible}\
.toast.on .tclose{pointer-events:auto}\
.panel{display:flex;flex-direction:column;min-height:0;border-top:1px solid var(--border);background:var(--panel);container-type:inline-size}\
@container (min-width:880px){\
.pane[data-pane=route]:not([hidden]){display:grid;grid-template-columns:minmax(300px,1fr) minmax(0,1.5fr);grid-template-rows:auto minmax(0,1fr);gap:0 14px;overflow:hidden}\
.pane[data-pane=route] .mission{grid-column:1;grid-row:1/span 2;margin:0;overflow:auto;min-height:0}\
.pane[data-pane=route] .toolbar{grid-column:2;grid-row:1}\
.pane[data-pane=route] .list{grid-column:2;grid-row:2;overflow:auto;min-height:0;padding-right:2px}\
.pane[data-pane=world]:not([hidden]){columns:2 320px;column-gap:24px}\
.pane[data-pane=world]>*{break-inside:avoid}\
.pane[data-pane=world]>h4{break-after:avoid}\
}\
.tabs{display:flex;border-bottom:1px solid var(--border)}\
.tabs button{flex:1;border:0;background:transparent;padding:9px 6px;border-bottom:2px solid transparent;color:var(--muted)}\
.tabs button[aria-selected=true]{color:var(--fg);border-bottom-color:var(--accent);font-weight:600}\
.pane{flex:1;min-height:0;overflow:auto;padding:10px}\
.pane[hidden]{display:none}\
.toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}\
.menuwrap{position:relative}\
.menu{position:absolute;left:0;top:calc(100% + 4px);z-index:6;min-width:240px;background:var(--panel);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px}\
.menu[hidden]{display:none}\
.menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:7px 9px;border-radius:6px}\
.menu button:hover{background:var(--hover)}\
.menu small{display:block;color:var(--muted);font-size:11.5px}\
.menu .sep{height:1px;background:var(--border);margin:4px 2px}\
.empty{color:var(--muted);padding:14px 4px}\
.leg{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--muted);padding:3px 6px 3px 14px;border-left:3px solid var(--ok);margin:2px 0 2px 12px}\
.leg.bad{border-left-color:var(--bad);color:var(--fg);background:var(--chip-bad);border-radius:0 6px 6px 0}\
.leg .st{font-weight:600;color:var(--ok)}\
.leg.bad .st{color:var(--bad)}\
.wp{border:1px solid var(--border);border-radius:8px;padding:7px;background:var(--panel)}\
.wp.sel{border-color:var(--sel);box-shadow:0 0 0 1px var(--sel)}\
.wp.via{background:var(--bg)}\
.wp.via .xyz,.wp.via .ori{font-size:12.5px}\
.wph{display:flex;gap:4px;align-items:center}\
.num{flex:none;display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:12px;background:var(--wp);color:#fff;font-weight:700;font-size:12px}\
.wp.via .num{background:var(--robot)}\
.wp.sel .num{background:var(--sel)}\
.wph input{flex:1;min-width:0;border-color:transparent;background:transparent;font-weight:600}\
.wph input:hover,.wph input:focus{border-color:var(--border);background:var(--input)}\
.icon{border:1px solid transparent;background:transparent;border-radius:6px;min-width:28px;height:28px;color:var(--muted)}\
@media (pointer:coarse){.icon{min-width:38px;height:38px}.tabs button{padding:12px 6px}}\
.icon:hover{border-color:var(--border);color:var(--fg)}\
.xyz{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}\
.xyz label,.qin label{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--muted)}\
.xyz input,.qin input{width:100%;min-width:0}\
.ori{display:flex;gap:4px;margin-top:5px;flex-wrap:wrap}\
.ori select{flex:1;min-width:0}\
.qin{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:5px}\
.qres{margin-top:5px;font-size:11.5px;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;word-break:break-word}\
.warnpt{margin-top:4px;font-size:12px;color:var(--bad)}\
pre.code{margin:0;background:var(--code);border:1px solid var(--border);border-radius:8px;padding:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;white-space:pre;overflow:auto;max-height:none}\
.note{color:var(--muted);font-size:12.5px}\
h4{margin:14px 0 6px;font-size:13px}\
h4:first-child{margin-top:0}\
.settings{display:grid;grid-template-columns:1fr 1fr;gap:6px}\
.settings.three{grid-template-columns:repeat(3,1fr)}\
.settings label{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);min-width:0}\
.settings input{width:100%;min-width:0}\
.koz{border:1px solid var(--border);border-radius:8px;padding:6px;margin-top:6px}\
.koz .r{display:grid;grid-template-columns:auto repeat(3,1fr);gap:4px;align-items:center;margin-top:4px;font-size:12px;color:var(--muted)}\
.koz input{width:100%;min-width:0}\
textarea.json{width:100%;min-height:220px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace;resize:vertical}\
.err{color:var(--bad);font-size:12.5px;margin-top:4px;white-space:pre-wrap}\
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}\
.row input[type=text]{flex:1;min-width:120px}\
footer{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:6px 10px;border-top:1px solid var(--border);background:var(--panel);font-size:12.5px;color:var(--muted)}\
footer b{color:var(--fg);font-weight:600}\
.chip{padding:2px 8px;border-radius:10px;font-weight:600}\
.chip.ok{background:var(--chip-ok);color:var(--ok)}\
.chip.bad{background:var(--chip-bad);color:var(--bad)}\
.boot{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;z-index:6;padding:12px}\
.boot.on{display:flex}\
.boot .bp{width:min(540px,100%);background:rgba(8,11,17,.9);border:1px solid rgba(134,162,255,.35);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.45);padding:12px 14px;color:#cfd6e6;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,"Noto Sans Bengali",monospace}\
.boot .bt{display:flex;align-items:center;gap:8px;color:#86a2ff;font-weight:700;letter-spacing:.18em;margin-bottom:6px}\
.boot .bt i{width:8px;height:8px;border-radius:50%;background:#86a2ff;animation:kns-blink 1s steps(2,start) infinite}\
.boot .bl{white-space:pre;overflow:hidden;text-overflow:ellipsis;animation:kns-in .18s ease-out}\
.root.narrow .boot .bp{font-size:11px;line-height:1.5;padding:10px 11px}\
.root.narrow .boot .bl{white-space:pre-wrap}\
.boot .ok{color:#3ccf9f}\
.boot .warn{color:#f0b54a}\
.boot .mut{color:#7d879b}\
.boot .cur::after{content:"▋";margin-left:2px;animation:kns-blink 1s steps(2,start) infinite}\
@keyframes kns-blink{to{visibility:hidden}}\
@keyframes kns-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}\
@media (prefers-reduced-motion:reduce){.boot .bl,.boot .bt i,.boot .cur::after{animation:none}}\
/* A phone header has no room for the Pause label and Saves while playing */\
.root.narrow:not(.fs) .plbl,.root.narrow.playing:not(.fs) [data-act=saves]{display:none}\
.credit{margin-left:auto;font-size:11.5px}\
.overlay{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;z-index:10;padding:12px;overflow:auto}\
.overlay[hidden]{display:none}\
.dialog{background:var(--panel);border:1px solid var(--border);border-radius:12px;width:min(480px,100%);max-height:100%;overflow:auto;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.3)}\
.dh{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}\
.dh b{font-size:15px}\
.saveitem{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)}\
.saveitem div{flex:1;min-width:0}\
.saveitem small{display:block;color:var(--muted)}\
ul.progress{list-style:none;margin:0;padding:0}\
ul.progress li{padding:3px 0;display:flex;gap:8px;align-items:baseline}\
ul.progress li span{flex:none;width:18px;text-align:center;color:var(--muted)}\
ul.progress li.done span{color:var(--ok);font-weight:700}\
ul.progress li.done{color:var(--fg)}\
ul.progress li:not(.done){color:var(--muted)}\
.root.practice [data-guided]{display:none!important}\
.mission{border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:10px;background:var(--bg)}\
.mission summary{cursor:pointer;display:flex;align-items:center;gap:8px;list-style:none}\
.mission summary::-webkit-details-marker{display:none}\
.mission summary::before{content:"▸";color:var(--muted);font-size:11px}\
.mission[open] summary::before{content:"▾"}\
.mission .mcount{margin-left:auto;font-size:12px;font-weight:600;color:var(--muted)}\
.mission .mcount.all{color:var(--ok)}\
.mission .note{margin:6px 0}\
.mission .mlevel[hidden]{display:none}\
.mission .mlevel{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:8px 0 2px;font-size:13px}\
.mission .mlevel label{display:flex;align-items:center;gap:6px;font-weight:600}\
.mission .mgap{flex:1 1 220px;color:var(--muted);font-size:12.5px;line-height:1.4}\
.mission .mscore{color:var(--fg)}\
.mission .mscore b{font-weight:600}\
.mission .mscore .bad{color:var(--bad)}\
ul.goals{list-style:none;margin:0;padding:0;display:grid;gap:4px}\
ul.goals li{display:flex;gap:8px;align-items:flex-start;padding:4px 6px;border-radius:6px;cursor:pointer}\
ul.goals li:hover{background:var(--hover)}\
ul.goals li>span{flex:none;width:18px;text-align:center;font-weight:700;color:var(--muted)}\
ul.goals li.done>span{color:var(--ok)}\
ul.goals li div{min-width:0}\
ul.goals li small{display:block;color:var(--muted);font-size:12px;line-height:1.35}\
.hint{flex-basis:100%;background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--fg);font-size:12.5px}\
.root.narrow .tag,.root.narrow .legend{display:none}\
.root.narrow .credit{margin-left:0}\
.root.narrow input,.root.narrow select,.root.narrow textarea{font-size:16px}\
.root.narrow header{padding:6px 8px}\
.root.narrow .views{order:3;width:100%}\
.root.narrow .views button{flex:1;padding:5px 4px}\
.fsbtn{display:inline-flex;align-items:center}\
header{position:relative}\
.root.narrow:not(.fs) .play{width:100%;gap:4px;flex-wrap:nowrap}\
.root.narrow:not(.fs) .play .btn,.root.narrow:not(.fs) .play select{padding-left:7px;padding-right:7px;font-size:13.5px;min-width:0}\
.root.narrow:not(.fs) .play select{padding-right:2px}\
.root.narrow:not(.fs) .fsbtn{background:var(--accent);border-color:var(--accent);color:var(--accent-fg);padding-left:6px;padding-right:7px}\
.root.narrow:not(.fs) .fsbtn svg{width:16px;height:16px;flex:none}\
.root.narrow:not(.fs) .fsbtn .lbl{margin-left:4px}\
.root.tiny:not(.fs) .play{gap:3px}\
.root.tiny:not(.fs) .play .btn,.root.tiny:not(.fs) .play select{padding-left:5px;padding-right:5px;font-size:13px}\
.root.tiny:not(.fs) .fsbtn .lbl{margin-left:3px}\
.root.narrow:not(.fs) .fsbtn{margin-left:auto}\
@media (pointer:coarse){.root:not(.fs) .play{flex:1 1 auto}.root:not(.fs) .fsbtn{margin-left:auto}}\
.fsbtn .lbl{margin-left:5px}\
.root.short.driving .cell .fit{display:none}\
:host([data-fs]){contain:none}\
.root.fs{border:0;border-radius:0;width:100%;height:100%;grid-template-rows:auto minmax(0,1fr)}\
.root.fs main{grid-template-rows:minmax(0,1fr) auto!important}\
.root.fs .panel{display:none}\
.drawerbtn{display:none;align-items:center}\
.drawerbtn .lbl{margin-left:5px}\
.root.fs .drawerbtn,.root.narrow.driving .listbtn{display:inline-flex}\
.root.fs.driving header .drawerbtn{display:none}\
.root.narrow .listbtn .lbl{display:none}\
.root .dbtns .btn.listbtn,.root.narrow .dbtns .btn.listbtn{flex:none;justify-content:center;min-width:42px}\
.root.drawer:not(.fs) main{position:relative}\
.root.drawer:not(.fs) .panel{position:absolute;left:0;right:0;top:0;height:var(--dvh,60vh);z-index:8;border-top:0;box-shadow:0 8px 24px rgba(0,0,0,.18)}\
.root.drawer .tabs .drawerclose{display:inline-block}\
.tabs .drawerclose{display:none;flex:none;align-self:center;margin:0 6px;padding:0;border:0;border-radius:8px;background:var(--accent);color:var(--accent-fg);font-weight:700}\
.tabs .drawerclose:hover{background:var(--accent);color:var(--accent-fg);filter:brightness(1.08)}\
.root.fs main{position:relative}\
.root.fs.drawer .panel{display:flex;position:absolute;top:0;right:0;bottom:0;width:min(400px,62%);z-index:8;border-top:0;border-left:1px solid var(--border);box-shadow:-8px 0 24px rgba(0,0,0,.18)}\
.root.fs.drawer.narrow .panel{width:100%;border-left:0}\
.root.fs.drawer .tabs .drawerclose{display:inline-block}\
.root.short .drawerbtn .lbl,.root.short .fsbtn .lbl{font-size:12.5px}\
.root.fs-pseudo{position:fixed;inset:0;z-index:2147483000;height:100vh;height:100dvh}\
.root.short header{padding:4px 8px;gap:4px 8px;flex-wrap:nowrap}\
.root.short .brand{display:none}\
.root.short .views{order:0;width:auto}\
.root.short .views button{flex:none;padding:3px 9px}\
.root.short .btn,.root.short .seg button,.root.short select{min-height:28px;padding:2px 8px;font-size:13px}\
.root.short footer{padding:3px 10px;font-size:11.5px}\
.root.short .credit{display:none}\
.root.short .cell .cap{display:none}\
.root.short .hud{margin-top:6px;font-size:10.5px;line-height:1.4;padding:3px 6px}\
.root.short .hud [data-h="3"]{display:none}\
.root.short .dpad{flex-wrap:nowrap;padding:4px 8px 8px;row-gap:0}\
.root.short .dmid{order:0;flex-basis:auto}\
.root.short .dmid .btn{min-height:30px;padding:2px 8px;font-size:12.5px}\
.root.short .joy{width:96px;height:96px}\
.root.short .joy .halo{inset:-30px}\
.root.short .joy .knob{width:40px;height:40px;margin:-20px 0 0 -20px}\
.root.short .joy span,.root.short .keys{display:none}\
.root.short .kpad button{width:40px;height:36px}\
.root.short .kpad button span,.root.short .kcap{display:none}\
.root.short .insets{top:6px}\
.root.short .cell .fit{top:auto;bottom:6px}\
.root.fs header{flex-wrap:nowrap}\
.root.fs .brand{display:none}\
.root.fs .views{order:0;width:auto;flex:none}\
.root.fs .play{flex:1;flex-wrap:nowrap;min-width:0}\
.root.fs .fsbtn{margin-left:auto}\
.root.fs.narrow header{flex-wrap:wrap}\
.root.fs.narrow .play{flex-wrap:wrap;width:100%}\
.root.fs.narrow .views{order:3;width:100%}\
.root.fs .cell .cap,.root.fs .legend{display:none}\
.root.fs .insets{top:6px}\
.root.fs .cell .fit{top:auto;bottom:6px}\
.root.fs.driving .cell .fit{display:none}\
.root.fs footer{flex-wrap:nowrap;white-space:nowrap;overflow:hidden;padding:3px 10px;font-size:11.5px;gap:4px 12px}\
.root.fs .credit{display:none}\
.root.fs .hud,.root.narrow.driving .hud{margin:6px 8px 0;display:flex;flex-wrap:nowrap;white-space:nowrap;overflow:hidden;font-size:11px;line-height:1.5;padding:3px 8px;max-width:calc(100% - 16px)}\
.root.fs.insets-on .hud{max-width:calc(100% - var(--iw,300px) - 32px)}\
.root.fs .hud .hrow,.root.narrow.driving .hud .hrow{display:contents}\
.root.fs .hud [data-h],.root.narrow.driving .hud [data-h]{flex:none}\
.root.fs .hud [data-h="4"],.root.narrow.driving .hud [data-h="4"]{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}\
.root.fs .hud [data-h]+[data-h]::before,.root.narrow.driving .hud [data-h]+[data-h]::before,.root.fs .hud .hrow+.hrow>[data-h]:first-child::before,.root.narrow.driving .hud .hrow+.hrow>[data-h]:first-child::before{content:"·";margin:0 7px;color:var(--muted)}\
.root.fs .hud [data-h="3"],.root.narrow.driving .hud [data-h="3"]{display:none}\
.root.fs .dmid,.root.narrow.driving .dmid{flex-direction:row;flex-wrap:nowrap;align-items:center;justify-content:center;gap:5px;min-width:0}\
.root.fs .vbtns,.root.narrow.driving .vbtns,.root.fs .dbtns,.root.narrow.driving .dbtns{flex-wrap:nowrap;gap:5px}\
.root.fs .vbtns .lbl,.root.narrow.driving .vbtns .lbl{display:none}\
.root.fs .vbtns .btn,.root.narrow.driving .vbtns .btn{min-width:40px}\
.root.fs .dmid .btn,.root.narrow.driving .dmid .btn{min-height:34px;padding:2px 9px;font-size:13px;flex:none}\
.root.fs .dbtns .btn,.root.narrow.driving .dbtns .btn{flex:none}\
.root.narrow.driving .dmid{overflow-x:auto;justify-content:flex-start;padding-bottom:2px;scrollbar-width:none}\
.root.fs .keys,.root.narrow.driving .keys{display:none}\
.root.narrow.driving .hud{max-width:calc(100% - 16px)}\
.root.fs.narrow .insets{top:40px}\
.root.narrow.driving .dmid{justify-content:center}\
.root.narrow.driving .dmid .btn{padding:2px 6px;font-size:12.5px}\
.root.narrow.driving .dbtns{gap:4px}\
.root.narrow.driving .dbtns .btn.listbtn{min-width:38px}\
.root.narrow.driving .vbtns .btn{min-width:36px}\
.root.sticks.fs .dmid,.root.sticks.narrow.driving .dmid{position:static;padding-right:110px}\
.root.sticks.narrow.driving .dmid{padding-right:0}\
.root.sticks.fs .vbtns,.root.sticks.narrow.driving .vbtns{position:absolute;right:142px;bottom:20px;display:grid;grid-template-columns:repeat(2,auto);gap:6px}\
.root.sticks.narrow.driving .vbtns{right:146px;bottom:30px}\
.root.sticks.narrow.driving .vbtns .btn{min-width:42px;min-height:38px}\
.root.sticks.fs .vbtns .btn,.root.sticks.narrow.driving .vbtns .btn{min-width:42px;min-height:38px}\
/* Desktop Drive (keys, no sticks): the keys and buttons sit in one line and the HUD is a compact block, so the camera gets the height. */\
.root:not(.narrow):not(.fs) .dpad{align-items:center;padding:6px 8px}\
.root:not(.narrow):not(.fs) .kpad{flex-direction:row;gap:3px;padding:3px;border-radius:8px}\
.root:not(.narrow):not(.fs) .krow{display:contents}\
.root:not(.narrow):not(.fs) .kgap,.root:not(.narrow):not(.fs) .kcap,.root:not(.narrow):not(.fs) .keys{display:none}\
.root:not(.narrow):not(.fs) .kpad button{width:32px;height:30px;border-bottom-width:2px;border-radius:6px}\
.root:not(.narrow):not(.fs) .kpad button span{display:none}\
.root:not(.narrow):not(.fs) .kpad [data-key=ArrowUp]{order:1}\
.root:not(.narrow):not(.fs) .kpad [data-key=ArrowDown]{order:2}\
.root:not(.narrow):not(.fs) .kpad [data-key=ArrowRight]{order:3}\
/* Laptop widths: drop the key hints on the buttons (the keys still work; the start message and tooltips name them),\
   and below 1100 px tighten the keys and buttons, so the controls stay on one line. */\
@container (max-width:1300px){.root:not(.narrow):not(.fs) .dbtns kbd{display:none}}\
@container (max-width:1100px){.root:not(.narrow):not(.fs) .kpad button{width:28px}.root:not(.narrow):not(.fs) .dbtns{gap:4px}.root:not(.narrow):not(.fs) .dbtns .btn{padding-left:7px;padding-right:7px}}\
.root:not(.narrow):not(.fs) .viewport.split:not(.quad){grid-template-columns:minmax(0,min(45%,640px)) minmax(0,1fr)}\
/* Desktop Drive: always two lines (pose and the straight move; the checkpoint or target and the markers read), each cut short with an ellipsis rather than wrapping, so the camera picture below never moves. */\
.root.driving:not(.narrow):not(.fs) .hud{margin:6px 8px 0;font-size:11.5px;line-height:1.45;padding:3px 8px;max-width:calc(min(45%,640px) - 16px)}\
.root.driving:not(.narrow):not(.fs) .hud .hrow{display:flex;column-gap:14px;height:1.45em;white-space:nowrap;overflow:hidden}\
.root.driving:not(.narrow):not(.fs) .hud .hrow>[data-h]{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}\
.root.driving:not(.narrow):not(.fs) .hud .hrow>[data-h]:empty{display:none}\
.root.driving:not(.narrow):not(.fs) .hud .hrow>[data-h]+[data-h]{flex-shrink:100000}\
/* Phones (upright and full screen): the action buttons wrap onto a second row instead of running under the\
   sticks and the hold buttons or off the screen, and upright the hold buttons sit centred between the sticks. */\
.root.fs .dbtns,.root.narrow.driving .dbtns{flex-wrap:wrap;justify-content:center;row-gap:5px;flex:1 1 auto;min-width:0}\
.root.fs .dmid,.root.narrow.driving .dmid{overflow-x:visible}\
.root.narrow.driving:not(.fs) .vbtns{right:auto;left:50%;transform:translateX(-50%)}\
/* Touch screens: every control at least 44 px tall (the usual minimum touch target), icons 44 px square, and 16 px text\
   in fields (phones zoom the page into smaller text). Full-screen landscape keeps the header at 40 px. */\
@media (pointer:coarse){\
.root .btn,.root .seg button{min-height:44px;min-width:44px}\
.root .btn.small{min-height:44px;padding:4px 12px;font-size:13.5px}\
.root .cell .btn.small{min-height:40px}\
.root select,.root textarea,.root input:not([type=checkbox]):not([type=radio]):not([type=file]){min-height:44px;font-size:16px}\
.root .icon{min-width:44px;height:44px}\
.root .inset .icon{min-width:40px;height:40px}\
.root summary{padding-top:12px;padding-bottom:12px}\
.root .toast .tclose{width:44px;height:44px}\
.root .term .termbtn{width:48px}\
.root .term .termbtn::after{content:"";position:absolute;inset:-10px -6px}\
.root.fs .dmid .btn,.root.narrow.driving .dmid .btn{min-height:44px}\
.root.fs .dbtns .btn,.root.narrow.driving .dbtns .btn,.root.narrow.driving .dbtns .btn.listbtn,.root.narrow:not(.fs) .play .btn,.root .play .btn{min-width:44px}\
.root.fs .vbtns .btn,.root.narrow.driving .vbtns .btn{min-width:48px;min-height:46px}\
.root.short .btn,.root.short .seg button,.root.short select{min-height:40px;min-width:40px}\
/* Full-screen landscape: one compact row of short labels, smaller hold buttons and see-through sticks, so the\
   camera picture and the 3D view stay visible. Each button keeps its full name (screen readers, tooltips). */\
.root.short .dbtns{flex-wrap:nowrap;gap:4px}\
.root.short .dbtns .btn{min-height:40px;min-width:40px;padding:0 9px;font-size:0;justify-content:center}\
.root.short .dbtns .btn::before{font-size:14px}\
.root.short .dbtns [data-act=driveadd]::before{content:"+";font-size:22px;line-height:1}\
.root.short .dbtns .listbtn .lbl{display:none}\
.root.short .dbtns [data-act=driveupdate]::before{content:"Move"}\
.root.short .dbtns [data-act=drivefine]::before{content:"Fine"}\
.root.short .dbtns [data-act=drivereset]::before{content:"\\21BA";font-size:19px;line-height:1}\
.root.short .dbtns [data-act=drivehalt]::before{content:"Halt"}\
.root.short .dbtns{gap:3px}\
.root.short .dbtns .btn{padding:0 7px}\
.root.short .dbtns [data-act=drivezerog]{gap:6px}\
.root.short .dbtns [data-act=drivezerog]::after{content:"0g";font-size:14px}\
.root.short .vbtns{gap:4px}\
.root.short .vbtns .btn{min-width:40px;min-height:40px}\
.root.short .joy{background:color-mix(in srgb,var(--panel) 40%,transparent)}\
.root.short .joy .halo{background:color-mix(in srgb,var(--accent) 4%,transparent)}\
/* The action row gets its own strip under the views (the camera picture is limited by its width here, so it\
   keeps its size); the HUD stays over the camera half, and the log takes less of the 3D view. */\
.root.short.driving .viewport.split{padding-bottom:52px}\
.root.short .hud{max-width:calc(50% - 16px)}\
.root.short .viewport.split .term{left:auto;width:min(44%,340px)}\
}\
/* Phone held upright: the six view buttons fold into one button on the name row (it names the current view)\
   and open as a dropdown under the header, so their row goes to the camera and 3D views instead. */\
.viewswrap{display:none}\
.root.narrow:not(.fs) header{position:relative}\
.root.narrow:not(.fs) .brand{flex:1 1 0;overflow:hidden;white-space:nowrap}\
.root.narrow:not(.fs) .brand b{overflow:hidden;text-overflow:ellipsis}\
.root.narrow:not(.fs) .viewswrap{display:block;flex:none}\
.root.narrow:not(.fs) header .seg.views{display:none}\
.root.narrow.views-open:not(.fs) header .seg.views{display:grid;grid-template-columns:repeat(3,1fr);position:absolute;right:8px;top:calc(100% + 4px);z-index:12;width:min(320px,calc(100% - 16px));background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);overflow:hidden}\
.root.narrow.views-open:not(.fs) header .seg.views button{border-left:0;border-top:1px solid var(--border)}\
.root.narrow.views-open:not(.fs) header .seg.views button:nth-child(-n+3){border-top:0}\
.root.narrow.views-open:not(.fs) header .seg.views button:not(:nth-child(3n+1)){border-left:1px solid var(--border)}\
.root.narrow:not(.fs) main{grid-template-rows:min(calc(var(--vh,520px) + 54px),calc(62vh + 54px)) auto var(--ph,min(480px,75vh))}\
.root.narrow.driving:not(.fs) main{grid-template-rows:min(694px,calc(80vh + 54px)) auto var(--ph,min(480px,75vh))}\
';

export { CSS };
