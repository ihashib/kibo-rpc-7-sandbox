/* ---------- world actions ---------- */
import { Core } from '../core/index.js';
import type { Checkpoint, Leg, Settings } from '../core/types.js';
import type { KiboNavSandbox } from './sandbox.js';
import { L } from '../i18n.js';

export class WorldActions {
  _changeSetting(this: KiboNavSandbox, t: HTMLInputElement) {
    const k = t.getAttribute('data-s') as keyof Settings, v = parseFloat(t.value), err = this.$('[data-err=json]');
    const cfg = Core.copy(this._config);
    cfg.settings[k] = v;

    try { this._config = Core.normalizeWorld(cfg); err.textContent = ''; }
    catch (ex) { err.textContent = (ex as Error).message; t.value = this._config.settings[k] as unknown as string; return; } // the input shows the number

    this._afterConfig({ world: false });
    this._renderJson();
  }

  _changeKoz(this: KiboNavSandbox, t: HTMLInputElement) {
    const k = +t.getAttribute('data-k')!, f = t.getAttribute('data-kf')!, z = this._config.koz[k];
    if (!z) return;

    if (f === 'name') { z.name = t.value || ('KOZ ' + (k + 1)); }
    else {
      const v = parseFloat(t.value);
      if (!isFinite(v)) return;
      const c = Core.boxCenter(z), s = Core.boxSize(z), a = +f.charAt(1);
      if (f.charAt(0) === 'c') c[a] = v; else s[a] = Math.max(0.01, v);
      z.min = [0, 1, 2].map(function (j) { return Core.round(c[j] - s[j] / 2, 4); });
      z.max = [0, 1, 2].map(function (j) { return Core.round(c[j] + s[j] / 2, 4); });
    }

    this._afterConfig({ world: false });
    this._renderJson();
  }

  _addKoz(this: KiboNavSandbox) {
    let a = this._analysis, best = null as Leg | null;

    // Put it in the middle of the longest clear move so there is something to route around.
    a.legs.forEach(function (l) { if (l.clear && (!best || l.dist > best.dist)) best = l; });
    let c = best && best.dist > 0.4 ? Core.lerp(best.from, best.to, 0.5) : Core.boxCenter(this._config.kiz[0]);
    c = c.map(function (v) { return Core.round(v, 3); });
    const n = this._config.koz.length + 1, h = 0.15;
    this._config.koz.push({ name: 'KOZ ' + n, min: Core.sub(c, [h, h, h]), max: Core.add(c, [h, h, h]) });
    this._afterConfig();
    this._toast(L('Added KOZ ' + n + ' (30 cm cube). Edit it in the World tab, then fix the red moves.', 'KOZ ' + n + ' যোগ হয়েছে (30 সেমি কিউব)। ওয়ার্ল্ড ট্যাবে এটা বদলাতে পারো, তারপর লাল পথগুলো ঠিক করো।'));
  }

  // Replace the checkpoint layout, keep the rest of the world.
  // `layout` is raw: checkpoints in either form and the goal (or goalpoint_id); normalizeWorld checks them.
  _setCheckpoints(this: KiboNavSandbox, layout: { checkpoints: unknown; goal?: unknown; goalpoint_id?: unknown }, msg: string) {
    const cfg = Core.copy(this._config);
    cfg.checkpoints = layout.checkpoints as Checkpoint[];
    cfg.goal = (layout.goal != null ? layout.goal : layout.goalpoint_id) as number | null;
    cfg.mission = [];
    this._config = Core.normalizeWorld(cfg);
    this.$('[data-err=json]').textContent = '';
    this._afterConfig();
    if (msg) this._toast(msg);
  }

  // A new random layout at difficulty `key` (default: the current layout's level, else Normal).
  _newCheckpoints(this: KiboNavSandbox, key?: string) {
    if (!this._config.targets.some(function (t) { return Core.markerNumber(t) != null && t.pos; })) { this._toast(L('This world has no AR markers to place checkpoints at.', 'এই ওয়ার্ল্ডে চেকপয়েন্ট বসানোর মতো কোনো AR মার্কার নেই।')); return; }
    const lv = Core.levelFor(key) || Core.levelFor(this._config.checkpoints.length) || Core.levelFor('normal');
    const seed = Math.floor(Math.random() * 1e6), layout = Core.makeCheckpoints(this._config, { seed: seed, count: lv!.count });
    this._setCheckpoints(layout, L('New ' + lv!.name + ' layout (seed ' + seed + '): ' + layout.checkpoints.length + ' checkpoints, goal CP ' + layout.goal + '. Your waypoints stay where they were: plan the route again.',
      'নতুন ' + lv!.name + ' লেআউট (seed ' + seed + '): ' + layout.checkpoints.length + 'টা চেকপয়েন্ট, গোল CP ' + layout.goal + '। তোমার ওয়েপয়েন্টগুলো আগের জায়গাতেই আছে: রুটটা আবার সাজাও।'));
  }

  _sampleCheckpoints(this: KiboNavSandbox) {
    const d = Core.normalizeWorld(Core.DEFAULT_WORLD);
    this._setCheckpoints({ checkpoints: d.checkpoints, goal: d.goal }, L('Back to the sample checkpoint layout.', 'নমুনা চেকপয়েন্ট লেআউটে ফেরা হলো।'));
  }

  _applyJson(this: KiboNavSandbox) {
    const err = this.$('[data-err=json]'), ta = this.$<HTMLTextAreaElement>('textarea.json');
    try {
      let json = JSON.parse(ta.value);

      // A /mission/get_checkpoints response (or its "message" string) pasted from a simulator log.
      if (json && typeof json.message === 'string' && /checkpoints/.test(json.message)) json = JSON.parse(json.message);

      if (json && !Array.isArray(json) && !json.kiz && (json.checkpoint_count != null || (Array.isArray(json.checkpoints) && !json.targets))) {
        this._setCheckpoints({ checkpoints: json.checkpoints, goal: json.goalpoint_id != null ? json.goalpoint_id : json.goal },
          L('Loaded ' + json.checkpoints.length + ' checkpoints from the pasted response.', 'পেস্ট করা রেসপন্স থেকে ' + json.checkpoints.length + 'টা চেকপয়েন্ট লোড হয়েছে।'));
        return;
      }

      this._config = Core.normalizeWorld(json);
      err.textContent = '';
      this._afterConfig();
      this._toast(L('World applied.', 'ওয়ার্ল্ড প্রয়োগ করা হয়েছে।'));
    } catch (ex) { err.textContent = (ex as Error).message; }
  }
}
