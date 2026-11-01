/*! KIBO RPC 7 Nav Sandbox v0.1.0 | by ihashib (https://ihashib.github.io) | PolyForm Noncommercial License 1.0.0: no commercial use without permission | Inspired by Kibo-RPC. Not affiliated with JAXA or UNOOSA; contains no JAXA assets. */
(function () {
    'use strict';

    function lang() {
        if (typeof document === 'undefined')
            return 'en'; // Node (the tests)
        const d = document.documentElement, v = d.getAttribute('data-lang') || d.lang || '';
        return /^bn/i.test(v) ? 'bn' : 'en';
    }
    /** The text in the page's language. */
    function L(en, bn) { return lang() === 'bn' ? bn : en; }
    const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
    /** A number (or text with numbers) in the page's digits: Bangla digits in Bangla. Codes, coordinates and other
     * technical values stay as they are; this is for counts, times and distances people read. */
    function N(v) {
        const s = String(v);
        return lang() === 'bn' ? s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; }) : s;
    }
    // Fonts: the system's own for Latin letters, then Noto Sans Bengali (Google's, loaded by the pages) for Bangla, in
    // every font stack (CSS and canvas).
    /** In Bangla, once the Bangla font has loaded (or after 2.5 s without it), so text drawn into canvases uses it. */
    function fontReady() {
        if (lang() !== 'bn' || typeof document === 'undefined' || !document.fonts || !document.fonts.load)
            return Promise.resolve();
        const wait = Promise.all([document.fonts.load('400 16px "Noto Sans Bengali"', 'অ'), document.fonts.load('700 16px "Noto Sans Bengali"', 'অ')]).catch(function () { return null; });
        return Promise.race([wait, new Promise(function (r) { setTimeout(r, 2500); })]);
    }

    const X_AXIS = [1, 0, 0];
    const Z_AXIS = [0, 0, 1];
    const EPS = 1e-9;
    // Margins from the 7th Kibo-RPC programming manual (/mission/get_checkpoints example).
    const SCORE_BANDS = [{ radius: 0.1, level: 3 }, { radius: 0.2, level: 2 }, { radius: 0.3, level: 1 }];
    const ANGLE_BANDS = [{ angle: 10, level: 3 }, { angle: 20, level: 2 }, { angle: 30, level: 1 }];
    // The web simulator's difficulty levels. The documents name them and say a run has 6 to 12
    // checkpoints by level, but not how many each level has: these counts are assumed (spread evenly).
    const LEVELS = [{ key: 'easy', name: L('Easy', 'সহজ'), count: 6 }, { key: 'normal', name: L('Normal', 'মাঝারি'), count: 8 }, { key: 'hard', name: L('Hard', 'কঠিন'), count: 10 }, { key: 'veryhard', name: L('Very Hard', 'খুব কঠিন'), count: 12 }];
    function levelFor(key) { for (let i = 0; i < LEVELS.length; i++)
        if (LEVELS[i].key === key || LEVELS[i].count === key)
            return LEVELS[i]; return null; }
    function cpDef(n, pos, marker, q) {
        return { id: n, name: 'CP ' + n, pos: pos, q: q, marker: marker, scoreBands: SCORE_BANDS, centeringBands: ANGLE_BANDS, rollBands: ANGLE_BANDS };
    }
    const WALL_Y = [-0.707, 0, 0, 0.707];
    const DEFAULT_WORLD = {
        name: '7th Kibo-RPC layout (Int-Ball2, sample checkpoints)',
        robot: { name: 'Int-Ball2', size: 0.2, shape: 'sphere' },
        settings: {
            clearance: 0.1, standoff: 0.5, speed: 0.1, turnRate: 30, gridRes: 0.05, snap: 0.01,
            aimTolerance: 10, rangeTolerance: 0.1, poseTolerance: 0.1
        },
        // Not published: one box spanning the walls the AR markers are mounted on.
        kiz: [{ name: 'Kibo (approx.)', min: [0, -1.001, -0.208], max: [7.195, 1.046, 1.884] }],
        koz: [],
        oasis: [],
        // AR markers (rulebook table 2.2.2-2). Each faces along its own +z; size is the 2 cm side length.
        targets: [
            { id: 'ar1', name: 'AR1 SAIBO', pos: [1.451, -1.001, 0.681], q: WALL_Y },
            { id: 'ar2', name: 'AR2 RYUTAI', pos: [2.973, -1.001, 0.718], q: WALL_Y },
            { id: 'ar3', name: 'AR3 MSPR_1', pos: [3.313, -1.001, 0.523], q: WALL_Y },
            { id: 'ar4', name: 'AR4 MSPR_2', pos: [4.181, -1.001, 0.523], q: WALL_Y },
            { id: 'ar5', name: 'AR5 RMS Console', pos: [5.754, -1.001, 0.838], q: WALL_Y },
            { id: 'ar6', name: 'AR6 EPS1', pos: [1.895, -0.282, -0.208], q: [0, 0, 0.707, -0.707] },
            { id: 'ar7', name: 'AR7 MELFI1', pos: [1.451, -1.001, 0.372], q: WALL_Y },
            { id: 'ar8', name: 'AR8 EPS2_2', pos: [4.779, 0.112, 1.884], q: [-0.707, 0.707, 0, 0] },
            { id: 'ar9', name: 'AR9 EPS2_1', pos: [2.066, 1.046, -0.014], q: [0, 0.707, -0.707, 0] },
            { id: 'ar10', name: 'AR10 ECLSS_TCS2', pos: [5.851, 0.01, 1.884], q: [-0.707, 0.707, 0, 0] },
            { id: 'ar11', name: 'AR11 Airlock', pos: [7.195, 0.363, 1.23], q: [0.5, 0.5, -0.5, -0.5] },
            { id: 'ar12', name: 'AR12 Bay 0 panel', pos: [0, -0.059, -0.102], q: [-0.5, 0.5, -0.5, 0.5] }
        ].map(function (t) { t.size = 0.02; return t; }),
        start: { name: 'Dock', pos: [0.2, 0, 0], q: [0, 0, 0, 1] },
        // Plain names for the six sides, shown around the views.
        sides: { '-x': 'Dock end', '+x': 'Airlock end', '-y': 'SAIBO wall', '+y': 'EPS2 wall', '-z': 'Overhead', '+z': 'Deck' },
        poses: [],
        // One sample layout, as /mission/get_checkpoints would return it. CP 1 is the manual's example;
        // the rest come from Core.makeCheckpoints(world, { seed: 9 }). The real simulator draws a new layout every run.
        checkpoints: [
            cpDef(1, [1.4421152111823452, -0.5013235815457989, 0.6649623093633403], [1.451, -1.001, 0.6806], [0.705928907230986, -0.689998801417597, 0.12254331978784033, -0.10270913665940805]),
            cpDef(4, [4.0802, -0.4642, 0.5104], [4.181, -1.001, 0.523], [-0.312418, 0.245508, -0.589473, 0.703308]),
            cpDef(5, [5.666, -0.44, 0.9551], [5.754, -1.001, 0.838], [-0.106153, 0.220959, -0.612602, 0.751417]),
            cpDef(6, [1.7307, -0.2167, 0.3145], [1.895, -0.282, -0.208], [-0.402285, 0.546056, 0.22997, 0.697928]),
            cpDef(8, [4.7532, 0.1382, 1.4047], [4.779, 0.112, 1.884], [0.06003, -0.687611, 0.019377, 0.723334]),
            cpDef(10, [5.9142, 0.1346, 1.3261], [5.851, 0.01, 1.884], [0.398408, -0.680114, 0.303982, 0.53508]),
            cpDef(11, [6.6779, 0.3966, 1.3034], [7.195, 0.363, 1.23], [-0.561175, 0.076253, 0.012972, 0.824075]),
            cpDef(12, [0.5118, -0.2028, -0.108], [0, -0.059, -0.102], [0.135406, 0.975217, 0.174008, 0.018374])
        ],
        goal: 12,
        // Goals: every checkpoint, goal last (filled in from the checkpoints when left empty).
        mission: [],
        // The robot camera, OpenCV pinhole model. Resolution and intrinsics are not published (read the real
        // ones from /camera_main/camera_info); the 0.14 m forward mount is from the manual (5.13).
        camera: {
            width: 1280, height: 720, fx: 900, fy: 900, cx: 640, cy: 360, D: [0, 0, 0, 0, 0], offset: [0.14, 0, 0],
            dictionary: 'DICT_4X4_50', minPerimeterRate: 0.03, maxViewAngle: 75,
            maxDistance: 1 // metres; the robot must be this close to read a marker (0 = no limit)
        },
        scoring: {
            timeLimit: 300, // seconds, from undocking to the mission completion report
            points: [0, 5, 7.5, 10], // per checkpoint level; Lv1 and Lv3 match the sample results, Lv2 is a guess
            goalPoints: 30,
            checkTime: 3 // seconds spent settling and asking the judge at each checkpoint
        },
        // C++ (ROS, roscpp + actionlib). Template placeholders: {x} {y} {z} {qx} {qy} {qz} {qw} {name} {i};
        // `pass` runs after a waypoint that passes a checkpoint, with {cp} = checkpoint_id.
        export: {
            prefix: '//',
            header: '// KIBO RPC 7 Nav Sandbox route for: {world} (inspired by Kibo-RPC; check every value in the simulator)\n' +
                '// Paste into the mission flow of src/user_template_node.cpp, after mission_start.\n' +
                '// Checkpoints change every run: a real program reads them from /mission/get_checkpoints.\n' +
                '// Needs <actionlib/client/simple_action_client.h>, <ib2_msgs/CtlCommandAction.h> and\n' +
                '// <krpc_ib2_msgs/CheckpointPassedAction.h>. If your template already has these Action clients, use\n' +
                '// them instead, and make your /ib2_user/stop handler cancel their goals.\n' +
                'actionlib::SimpleActionClient<ib2_msgs::CtlCommandAction> move_client("/ctl/command", true);\n' +
                'actionlib::SimpleActionClient<krpc_ib2_msgs::CheckpointPassedAction> cp_client("/event/checkpoint_passed", true);\n' +
                'move_client.waitForServer(ros::Duration(10.0));\n' +
                'cp_client.waitForServer(ros::Duration(10.0));\n' +
                'auto move_to = [&](double x, double y, double z, double qx, double qy, double qz, double qw) {\n' +
                '  ib2_msgs::CtlCommandGoal goal;\n' +
                '  goal.target.header.frame_id = "iss_body";\n' +
                '  goal.target.header.stamp = ros::Time::now();\n' +
                '  goal.target.pose.position.x = x;\n' +
                '  goal.target.pose.position.y = y;\n' +
                '  goal.target.pose.position.z = z;\n' +
                '  goal.target.pose.orientation.x = qx;\n' +
                '  goal.target.pose.orientation.y = qy;\n' +
                '  goal.target.pose.orientation.z = qz;\n' +
                '  goal.target.pose.orientation.w = qw;\n' +
                '  goal.type.type = ib2_msgs::CtlStatusType::MOVE_TO_ABSOLUTE_TARGET;\n' +
                '  move_client.sendGoal(goal);\n' +
                '  if (!move_client.waitForResult(ros::Duration(60.0))) { move_client.cancelGoal(); return false; }\n' +
                '  return move_client.getResult()->type == ib2_msgs::CtlCommandResult::TERMINATE_SUCCESS;\n' +
                '};\n' +
                'auto pass_checkpoint = [&](int id) {\n' +
                '  ros::Duration(1.0).sleep();  // let it settle before the judge looks\n' +
                '  krpc_ib2_msgs::CheckpointPassedGoal goal;\n' +
                '  goal.checkpoint_id = id;\n' +
                '  cp_client.sendGoal(goal);\n' +
                '  if (!cp_client.waitForResult(ros::Duration(10.0))) { cp_client.cancelGoal(); return false; }\n' +
                '  bool ok = cp_client.getResult()->success;\n' +
                '  ROS_INFO("checkpoint %d passed: %s", id, ok ? "yes" : "no");\n' +
                '  return ok;\n' +
                '};',
            comment: '// {i}. {name}',
            line: 'if (!move_to({x}, {y}, {z}, {qx}, {qy}, {qz}, {qw})) ROS_WARN("move {i} did not finish");',
            pass: 'pass_checkpoint({cp});',
            footer: '// Then call /event/mission_finished (the template does this after the flow).'
        },
        // Python (ROS, rospy + actionlib). Indented to paste straight into the template's USER EDIT AREA.
        exportPython: {
            prefix: '            #',
            header: '            # KIBO RPC 7 Nav Sandbox route for: {world} (inspired by Kibo-RPC; check every value in the simulator)\n' +
                '            # Paste between the USER EDIT AREA markers in __run_user_flow() (scripts/user_template.py).\n' +
                '            # Checkpoints change every run: a real program reads them from /mission/get_checkpoints.\n' +
                '            def move_to(x, y, z, qx, qy, qz, qw, timeout=60.0):\n' +
                '                if not self.__command.wait_for_server(rospy.Duration(10.0)):\n' +
                '                    return False\n' +
                '                target = PoseStamped()\n' +
                '                target.header.frame_id = \'iss_body\'\n' +
                '                target.header.stamp = rospy.Time.now()\n' +
                '                p, o = target.pose.position, target.pose.orientation\n' +
                '                p.x, p.y, p.z = x, y, z\n' +
                '                o.x, o.y, o.z, o.w = qx, qy, qz, qw\n' +
                '                goal = CtlCommandGoal(target=target, type=CtlStatusType(type=CtlStatusType.MOVE_TO_ABSOLUTE_TARGET))\n' +
                '                self.__action_active = True  # so /ib2_user/stop cancels it\n' +
                '                try:\n' +
                '                    self.__command.send_goal(goal)\n' +
                '                    if not self.__command.wait_for_result(rospy.Duration(timeout)):\n' +
                '                        self.__command.cancel_goal()\n' +
                '                        return False\n' +
                '                    return self.__command.get_result().type == CtlCommandResult.TERMINATE_SUCCESS\n' +
                '                finally:\n' +
                '                    self.__action_active = False\n',
            comment: '            # {i}. {name}',
            line: '            if not move_to({x}, {y}, {z}, {qx}, {qy}, {qz}, {qw}):\n' +
                '                rospy.logwarn(\'move {i} did not finish\')',
            pass: '            rospy.sleep(1.0)  # let it settle before the judge looks\n' +
                '            self.__notify_checkpoint_passed({cp})',
            footer: '            # The template calls /event/mission_finished after this block.'
        }
    };

    /* ---------- small helpers ---------- */
    function copy(o) { return JSON.parse(JSON.stringify(o)); }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function len(a) { return Math.sqrt(dot(a, a)); }
    function dist(a, b) { return len(sub(a, b)); }
    function norm(a) { const l = len(a); return l < EPS ? [0, 0, 0] : scale(a, 1 / l); }
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function round(n, d) { const f = Math.pow(10, d); const v = Math.round(n * f) / f; return v === 0 ? 0 : v; }
    function roundVec(v, d) { return v.map(function (n) { return round(n, d); }); }
    function fmt(n, d) {
        const v = round(n, d == null ? 4 : d);
        return String(v);
    }
    function isNum(n) { return typeof n === 'number' && isFinite(n); }
    function isVec(v, n) {
        if (!Array.isArray(v) || v.length !== (n || 3))
            return false;
        for (let i = 0; i < v.length; i++)
            if (!isNum(v[i]))
                return false;
        return true;
    }
    function vecFmt(p) { return '(' + p.map(function (v) { return fmt(v, 4); }).join(', ') + ')'; }

    /* ---------- quaternions [x, y, z, w] ---------- */
    function qNorm(q) {
        const l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
        return l < EPS ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    }
    function qDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }
    function qMul(a, b) {
        return [
            a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
            a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
            a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
            a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
        ];
    }
    function qFromAxisAngle(axis, rad) {
        const a = norm(axis), s = Math.sin(rad / 2);
        return [a[0] * s, a[1] * s, a[2] * s, Math.cos(rad / 2)];
    }
    // Shortest rotation that turns direction u into direction v.
    function qFromTo(u, v) {
        u = norm(u);
        v = norm(v);
        const d = dot(u, v);
        if (d >= 1 - 1e-12)
            return [0, 0, 0, 1];
        if (d <= -1 + 1e-9) {
            // Half turn. Prefer spinning about the deck axis (z) so the robot stays upright.
            let axis = sub([0, 0, 1], scale(u, u[2]));
            if (len(axis) < 1e-6)
                axis = sub([0, 1, 0], scale(u, u[1]));
            axis = norm(axis);
            return [axis[0], axis[1], axis[2], 0];
        }
        const c = cross(u, v);
        return qNorm([c[0], c[1], c[2], 1 + d]);
    }
    function qRotate(q, v) {
        const u = [q[0], q[1], q[2]], w = q[3];
        const t = scale(cross(u, v), 2);
        return add(add(v, scale(t, w)), cross(u, t));
    }
    function qSlerp(a, b, t) {
        a = qNorm(a);
        b = qNorm(b);
        let d = qDot(a, b);
        if (d < 0) {
            b = [-b[0], -b[1], -b[2], -b[3]];
            d = -d;
        }
        if (d > 0.9995)
            return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
        const th = Math.acos(d), s = Math.sin(th);
        const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
        return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
    }
    // Angle in degrees between two orientations.
    function qAngleDeg(a, b) {
        const d = Math.abs(qDot(qNorm(a), qNorm(b)));
        return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
    }
    function qConj(q) { return [-q[0], -q[1], -q[2], q[3]]; }
    // Angle in degrees between two directions.
    function angleDeg(a, b) {
        const la = len(a), lb = len(b);
        if (la < EPS || lb < EPS)
            return 180;
        return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb)))) * 180 / Math.PI;
    }
    function wrapDeg(a) { return ((a % 360) + 540) % 360 - 180; }
    // Orientation from heading (yaw, about +z, 0 = facing +x, 90 = facing +y), pitch (about the body y
    // axis, +90 = camera looking overhead at -z) and roll (about the camera axis, + = clockwise seen
    // from behind the camera). Roll 0 is upright: the robot's top (body +Z) toward overhead (-z), so the
    // camera picture is the right way up. (The dock pose, q = identity, is roll 180 by this measure.)
    function qFromYawPitch(yawDeg, pitchDeg, rollDeg) {
        const r = Math.PI / 180;
        const q = qMul(qFromAxisAngle(Z_AXIS, yawDeg * r), qFromAxisAngle([0, 1, 0], pitchDeg * r));
        return qNorm(qMul(q, qFromAxisAngle(X_AXIS, (180 + (rollDeg || 0)) * r)));
    }
    function yawPitchFromQ(q) {
        const d = cameraDir(q), r = 180 / Math.PI;
        const yaw = Math.hypot(d[0], d[1]) > 1e-6 ? Math.atan2(d[1], d[0]) * r : 0;
        const pitch = Math.asin(Math.max(-1, Math.min(1, -d[2]))) * r;
        const rel = qMul(qConj(qFromYawPitch(yaw, pitch)), qNorm(q)); // what is left is a turn about +X
        return { yaw: yaw, pitch: pitch, roll: wrapDeg(2 * Math.atan2(rel[0], rel[3]) * r) };
    }
    // Orientation whose camera (+X) points from `from` toward `to`.
    function faceQuat(from, to) { return qFromTo(X_AXIS, sub(to, from)); }
    function cameraDir(q) { return qRotate(qNorm(q), X_AXIS); }
    function topDir(q) { return qRotate(qNorm(q), Z_AXIS); }
    // Roll error about the line of sight, in degrees: how far `q` must turn about its own camera axis
    // (+ = clockwise seen from behind the camera) for its top (+Z) to line up with the top of `want`.
    function rollErrorDeg(q, want) {
        let d = cameraDir(q), up = topDir(q), wu = topDir(want);
        let p = sub(wu, scale(d, dot(wu, d)));
        if (len(p) < 1e-6) { // the wanted top lies along our line of sight: compare the y axes instead
            up = qRotate(qNorm(q), [0, 1, 0]);
            const wy = qRotate(qNorm(want), [0, 1, 0]);
            p = sub(wy, scale(d, dot(wy, d)));
        }
        p = norm(p);
        return Math.atan2(dot(d, cross(up, p)), dot(up, p)) * 180 / Math.PI;
    }
    // Keep q's roll but turn the camera to look along `dir` (the smallest swing).
    function aimQuat(q, dir) { return qNorm(qMul(qFromTo(cameraDir(q), dir), qNorm(q))); }

    /* ---------- world ---------- */
    function fail(msg) { throw new Error(msg); }
    // `b`, `p`, `input` and `c` below are raw JSON from a world file or the page: checked here by hand.
    function normBox(b, path, defName) {
        if (!b || typeof b !== 'object')
            fail(L(path + ' must be an object with min and max', path + ' এমন একটা অবজেক্ট হতে হবে, যাতে min আর max আছে'));
        if (!isVec(b.min) || !isVec(b.max))
            fail(L(path + ' needs "min" and "max" as [x, y, z] numbers', path + '-এ "min" আর "max" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
        const min = [], max = [];
        for (let k = 0; k < 3; k++) {
            min.push(Math.min(b.min[k], b.max[k]));
            max.push(Math.max(b.min[k], b.max[k]));
        }
        const out = { name: b.name ? String(b.name) : defName, min: min, max: max };
        if (b.id != null)
            out.id = String(b.id);
        return out;
    }
    function normPose(p, path, defName) {
        if (!p || !isVec(p.pos))
            fail(L(path + ' needs "pos" as [x, y, z] numbers', path + '-এ "pos" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
        if (p.q != null && !isVec(p.q, 4))
            fail(L(path + '.q must be [x, y, z, w] numbers', path + '.q হতে হবে [x, y, z, w] সংখ্যা'));
        return { name: p.name ? String(p.name) : defName, pos: p.pos.slice(), q: qNorm(p.q || [0, 0, 0, 1]) };
    }
    function normalizeWorld(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            fail(L('The world config must be a JSON object', 'ওয়ার্ল্ড কনফিগ একটা JSON অবজেক্ট হতে হবে'));
        const d = copy(DEFAULT_WORLD);
        const w = {};
        w.name = input.name != null ? String(input.name) : (input.kiz ? 'Custom world' : d.name);
        w.robot = Object.assign({}, d.robot, input.robot || {});
        if (!isNum(w.robot.size) || w.robot.size <= 0)
            w.robot.size = d.robot.size;
        w.settings = Object.assign({}, d.settings, input.settings || {});
        const s = w.settings;
        ['clearance', 'standoff', 'speed', 'turnRate', 'gridRes', 'snap', 'aimTolerance', 'rangeTolerance', 'poseTolerance'].forEach(function (k) {
            if (!isNum(s[k]))
                fail(L('settings.' + k + ' must be a number', 'settings.' + k + ' একটা সংখ্যা হতে হবে'));
            if (s[k] < 0)
                fail(L('settings.' + k + ' cannot be negative', 'settings.' + k + ' ঋণাত্মক হতে পারবে না'));
        });
        if (s.clearance < 0)
            fail(L('settings.clearance cannot be negative', 'settings.clearance ঋণাত্মক হতে পারবে না'));
        if (s.speed <= 0)
            fail(L('settings.speed must be above 0', 'settings.speed 0-এর বেশি হতে হবে'));
        if (s.turnRate <= 0)
            fail(L('settings.turnRate must be above 0', 'settings.turnRate 0-এর বেশি হতে হবে'));
        if (s.gridRes < 0.01)
            fail(L('settings.gridRes must be at least 0.01', 'settings.gridRes কমপক্ষে 0.01 হতে হবে'));
        if (s.snap < 0)
            fail(L('settings.snap cannot be negative', 'settings.snap ঋণাত্মক হতে পারবে না'));
        const kiz = input.kiz != null ? input.kiz : d.kiz;
        if (!Array.isArray(kiz) || !kiz.length)
            fail(L('"kiz" must be a list with at least one Keep-In Zone', '"kiz" একটা তালিকা হতে হবে, যাতে অন্তত একটা কিপ-ইন জোন আছে'));
        w.kiz = kiz.map(function (b, i) { return normBox(b, 'kiz[' + i + ']', 'KIZ ' + (i + 1)); });
        [['koz', 'KOZ '], ['oasis', 'Oasis ']].forEach(function (kv) {
            const key = kv[0], list = input[key] != null ? input[key] : d[key];
            if (!Array.isArray(list))
                fail(L('"' + key + '" must be a list', '"' + key + '" একটা তালিকা হতে হবে'));
            w[key] = list.map(function (b, i) { return normBox(b, key + '[' + i + ']', kv[1] + (i + 1)); });
        });
        const targets = input.targets != null ? input.targets : d.targets;
        if (!Array.isArray(targets))
            fail(L('"targets" must be a list', '"targets" একটা তালিকা হতে হবে'));
        const ids = {};
        w.targets = targets.map(function (t, i) {
            let path = 'targets[' + i + ']', b;
            if (t && isVec(t.pos)) {
                // A marker given by its pose: it faces along its own +z, `size` is the side length.
                if (!isVec(t.q, 4))
                    fail(L(path + ' needs "q" as [x, y, z, w] numbers next to "pos"', path + '-এ "pos"-এর সঙ্গে "q" লাগবে, [x, y, z, w] সংখ্যা হিসেবে'));
                const q = qNorm(t.q), size = isNum(t.size) && t.size > 0 ? t.size : 0.02;
                const ext = add(scale(map3(qRotate(q, X_AXIS), Math.abs), size / 2), scale(map3(qRotate(q, [0, 1, 0]), Math.abs), size / 2));
                b = { name: t.name ? String(t.name) : 'Target ' + (i + 1), min: sub(t.pos, ext), max: add(t.pos, ext), pos: t.pos.slice(), q: q, size: size };
                b.normal = topDir(q);
            }
            else {
                b = normBox(t, path, 'Target ' + (i + 1));
                if (t.normal != null && !isVec(t.normal))
                    fail(L(path + '.normal must be [x, y, z] numbers', path + '.normal হতে হবে [x, y, z] সংখ্যা'));
                b.normal = norm(t.normal || [0, 0, 1]);
                if (len(b.normal) < 0.5)
                    fail(L(path + '.normal cannot be [0, 0, 0]', path + '.normal [0, 0, 0] হতে পারবে না'));
            }
            b.id = t.id != null ? String(t.id) : 'target' + (i + 1);
            if (ids[b.id])
                fail(L('Two items share the id "' + b.id + '"', 'দুটো জিনিসের id একই: "' + b.id + '"'));
            ids[b.id] = 1;
            return b;
        });
        // Checkpoints: the sandbox's own form, or entries straight from /mission/get_checkpoints
        // (or that whole response). Worlds that bring their own zones or targets don't inherit the default ones.
        let cps = input.checkpoints != null ? input.checkpoints : (input.kiz || input.targets ? [] : d.checkpoints);
        let goalIn = input.goal != null ? input.goal : input.goalpoint_id != null ? input.goalpoint_id : null;
        if (cps && !Array.isArray(cps) && Array.isArray(cps.checkpoints)) {
            if (goalIn == null)
                goalIn = cps.goalpoint_id;
            cps = cps.checkpoints;
        }
        if (!Array.isArray(cps))
            fail(L('"checkpoints" must be a list', '"checkpoints" একটা তালিকা হতে হবে'));
        if (goalIn == null && input.checkpoints == null && !(input.kiz || input.targets))
            goalIn = d.goal;
        w.checkpoints = cps.map(function (c, i) { return normCheckpoint(c, i, w.targets); });
        w.checkpoints.forEach(function (c) {
            if (ids[c.key])
                fail(L('Two items share the id "' + c.key + '"', 'দুটো জিনিসের id একই: "' + c.key + '"'));
            ids[c.key] = 1;
        });
        w.goal = null;
        if (goalIn != null && goalIn !== '') {
            const gcp = findCheckpoint(w, goalIn);
            if (!gcp)
                fail(L('"goal" is ' + JSON.stringify(goalIn) + ', but no checkpoint has that id', '"goal" হলো ' + JSON.stringify(goalIn) + ', কিন্তু এই id-র কোনো চেকপয়েন্ট নেই'));
            w.goal = gcp.id;
        }
        w.camera = Object.assign({}, d.camera, input.camera || {});
        const cm = w.camera;
        ['width', 'height', 'fx', 'fy', 'cx', 'cy', 'minPerimeterRate', 'maxViewAngle', 'maxDistance'].forEach(function (k) {
            if (!isNum(cm[k]) || cm[k] < 0)
                fail(L('camera.' + k + ' must be a number, 0 or more', 'camera.' + k + ' একটা সংখ্যা হতে হবে, 0 বা তার বেশি'));
        });
        if (!cm.width || !cm.height || !cm.fx || !cm.fy)
            fail(L('camera width, height, fx and fy must be above 0', 'camera-র width, height, fx আর fy 0-এর বেশি হতে হবে'));
        if (!isVec(cm.offset))
            fail(L('camera.offset must be [x, y, z] in the body frame', 'camera.offset হতে হবে বডি ফ্রেমে [x, y, z]'));
        w.scoring = Object.assign({}, d.scoring, input.scoring || {});
        const sc = w.scoring;
        ['timeLimit', 'goalPoints', 'checkTime'].forEach(function (k) {
            if (!isNum(sc[k]) || sc[k] < 0)
                fail(L('scoring.' + k + ' must be a number, 0 or more', 'scoring.' + k + ' একটা সংখ্যা হতে হবে, 0 বা তার বেশি'));
        });
        if (sc.timeLimit <= 0)
            fail(L('scoring.timeLimit must be above 0', 'scoring.timeLimit 0-এর বেশি হতে হবে'));
        if (!Array.isArray(sc.points) || !sc.points.every(isNum))
            fail(L('scoring.points must be a list of numbers (points per level, from level 0)', 'scoring.points সংখ্যার একটা তালিকা হতে হবে (প্রতি লেভেলের পয়েন্ট, লেভেল 0 থেকে)'));
        w.start = normPose(input.start || d.start, 'start', 'Start');
        // Overhead and deck hold in every world; the other names only come with the default world.
        w.sides = Object.assign({ '-z': 'Overhead', '+z': 'Deck' }, input.sides || (input.kiz ? {} : d.sides));
        Object.keys(w.sides).forEach(function (k) {
            if (!/^[+-][xyz]$/.test(k))
                fail(L('sides keys are "-x", "+x", "-y", "+y", "-z" and "+z"', 'sides-এর key শুধু "-x", "+x", "-y", "+y", "-z" আর "+z" হতে পারে'));
            w.sides[k] = String(w.sides[k]);
        });
        const poses = input.poses != null ? input.poses : d.poses;
        if (!Array.isArray(poses))
            fail(L('"poses" must be a list', '"poses" একটা তালিকা হতে হবে'));
        w.poses = poses.map(function (p, i) {
            const o = normPose(p, 'poses[' + i + ']', 'Pose ' + (i + 1));
            o.id = p.id != null ? String(p.id) : 'pose' + (i + 1);
            if (ids[o.id])
                fail(L('Two items share the id "' + o.id + '"', 'দুটো জিনিসের id একই: "' + o.id + '"'));
            ids[o.id] = 1;
            return o;
        });
        // "example" is the old name for "mission". An empty mission means: every checkpoint, goal last.
        let ex = input.mission != null ? input.mission : input.example != null ? input.example : (input.targets || input.poses ? null : d.mission);
        if (Array.isArray(ex) && !ex.length && w.checkpoints.length)
            ex = null;
        w.mission = Array.isArray(ex) ? ex.map(String).filter(function (id) { return ids[id]; })
            : w.checkpoints.length ? w.checkpoints.filter(function (c) { return c.id !== w.goal; }).concat(w.checkpoints.filter(function (c) { return c.id === w.goal; })).map(function (c) { return c.key; })
                : w.targets.map(function (t) { return t.id; }).concat(w.poses.map(function (p) { return p.id; }));
        ['export', 'exportPython'].forEach(function (key) {
            // A world's own template does not inherit the default `pass` and `footer` (it may be another language).
            const own = input[key] || {}, ex = w[key] = Object.assign({}, d[key], input[key] ? { pass: '', footer: '' } : {}, own);
            ['prefix', 'header', 'comment', 'line', 'pass', 'footer'].forEach(function (k) { ex[k] = ex[k] == null ? '' : String(ex[k]); });
        });
        return w;
    }
    function map3(v, f) { return [f(v[0]), f(v[1]), f(v[2])]; }
    // The AR marker number in a target id such as "ar12", or null.
    function markerNumber(t) { const m = /(\d+)$/.exec(t.id); return m ? +m[1] : null; }
    function normBands(list, key, path) {
        if (list == null)
            return [];
        if (!Array.isArray(list))
            fail(L(path + ' must be a list of { ' + key + ', level }', path + ' হতে হবে { ' + key + ', level }-এর তালিকা'));
        return list.map(function (b, i) {
            if (!b || !isNum(b[key]) || !isNum(b.level))
                fail(L(path + '[' + i + '] needs "' + key + '" and "level" numbers', path + '[' + i + ']-এ "' + key + '" আর "level" সংখ্যা লাগবে'));
            const o = { level: b.level };
            o[key] = b[key];
            return o;
        }).sort(function (a, b) { return a[key] - b[key]; });
    }
    // One checkpoint, in the sandbox form { id, name, pos, q, marker, scoreBands, centeringBands, rollBands }
    // or the /mission/get_checkpoints form { checkpoint_id, position, marker_pose, score_bands, attitude }.
    function normCheckpoint(c, i, targets) {
        const path = 'checkpoints[' + i + ']';
        if (!c || typeof c !== 'object')
            fail(L(path + ' must be an object', path + ' একটা অবজেক্ট হতে হবে'));
        const att = c.attitude || {};
        const id = c.id != null ? c.id : c.checkpoint_id;
        if (!isNum(id))
            fail(L(path + ' needs a number "id" (the checkpoint_id)', path + '-এ একটা সংখ্যা "id" লাগবে (checkpoint_id)'));
        const pos = c.pos || c.position, q = c.q || att.quaternion;
        if (!isVec(pos))
            fail(L(path + ' needs "pos" as [x, y, z] numbers', path + '-এ "pos" লাগবে, [x, y, z] সংখ্যা হিসেবে'));
        if (q != null && !isVec(q, 4))
            fail(L(path + '.q must be [x, y, z, w] numbers', path + '.q হতে হবে [x, y, z, w] সংখ্যা'));
        let marker = c.marker != null ? c.marker : c.marker_pose && c.marker_pose.position;
        if (marker == null) {
            // Fall back to the AR marker with the same number.
            targets.forEach(function (t) { if (marker == null && t.pos && markerNumber(t) === id)
                marker = t.pos; });
        }
        if (marker != null && !isVec(marker))
            fail(L(path + '.marker must be [x, y, z] numbers', path + '.marker হতে হবে [x, y, z] সংখ্যা'));
        const o = {
            id: id, key: 'cp' + id, name: c.name ? String(c.name) : 'CP ' + id, pos: pos.slice(),
            q: q ? qNorm(q) : null, marker: marker ? marker.slice() : null,
            scoreBands: normBands(c.scoreBands || c.score_bands || SCORE_BANDS, 'radius', path + '.scoreBands'),
            centeringBands: normBands(c.centeringBands || att.centering_bands, 'angle', path + '.centeringBands'),
            rollBands: normBands(c.rollBands || att.roll_bands, 'angle', path + '.rollBands')
        };
        if (!o.scoreBands.length)
            fail(L(path + '.scoreBands needs at least one band', path + '.scoreBands-এ অন্তত একটা band লাগবে'));
        if (o.rollBands.length && !o.q)
            fail(L(path + ' has rollBands, so it needs "q" (the attitude to match)', path + '-এ rollBands আছে, তাই "q" লাগবে (যে দিক মেলাতে হবে)'));
        if (o.centeringBands.length && !o.marker)
            fail(L(path + ' has centeringBands, so it needs "marker" (the AR marker position)', path + '-এ centeringBands আছে, তাই "marker" লাগবে (AR মার্কারের অবস্থান)'));
        return o;
    }
    // A checkpoint by number (12), sandbox key ("cp12") or numeric string ("12").
    function findCheckpoint(world, id) {
        const list = world.checkpoints || [];
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (c.key === id || c.id === id || String(c.id) === String(id))
                return c;
        }
        return null;
    }
    function boxCenter(b) { return lerp(b.min, b.max, 0.5); }
    function boxSize(b) { return sub(b.max, b.min); }
    function findTarget(world, id) {
        for (let i = 0; i < world.targets.length; i++)
            if (world.targets[i].id === id)
                return world.targets[i];
        return null;
    }
    function findPose(world, id) {
        for (let i = 0; i < world.poses.length; i++)
            if (world.poses[i].id === id)
                return world.poses[i];
        return null;
    }
    function kizBounds(world) {
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        world.kiz.forEach(function (b) {
            for (let k = 0; k < 3; k++) {
                min[k] = Math.min(min[k], b.min[k]);
                max[k] = Math.max(max[k], b.max[k]);
            }
        });
        return { min: min, max: max };
    }
    // Everything worth showing: zones, targets, start and poses.
    function worldBounds(world) {
        const bb = kizBounds(world), min = bb.min.slice(), max = bb.max.slice();
        function grow(p) { for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k]);
            max[k] = Math.max(max[k], p[k]);
        } }
        world.targets.concat(world.koz).forEach(function (b) { grow(b.min); grow(b.max); });
        (world.checkpoints || []).forEach(function (c) { grow(c.pos); });
        grow(world.start.pos);
        world.poses.concat(world.checkpoints || []).forEach(function (p) { grow(p.pos); });
        return { min: min, max: max };
    }
    function targetCenter(t) { return boxCenter(t); }

    /* ---------- AR markers and the robot camera (OpenCV conventions) ---------- */
    // OpenCV aruco DICT_4X4_50, IDs 0-12 (the 7th Kibo-RPC uses IDs 1-12): the 4x4 inner bits, row by
    // row from the marker's top, 1 = white. Generated with cv.generateImageMarker. Inside the 2 cm marker
    // the bits sit in a one-cell black border, so the marker is 6 x 6 cells.
    const ARUCO_4X4 = [
        '1011010100110010',
        '0000111110011010',
        '0011001100101101',
        '1001100101000110',
        '0101010010011110',
        '0111100111001101',
        '1001111000101110',
        '1100010011110010',
        '1111111011011010',
        '1100111101010110',
        '1111100110010001',
        '0001000110100111',
        '0000111010110111'
    ];
    function markerBits(t) {
        const n = t && t.pos && t.q ? markerNumber(t) : null;
        return n != null && n < ARUCO_4X4.length ? ARUCO_4X4[n] : null;
    }
    // Marker axes in the world: x to the right and y up in the marker picture, z out of its face.
    function markerFrame(t) { return { x: qRotate(t.q, X_AXIS), y: qRotate(t.q, [0, 1, 0]), z: qRotate(t.q, Z_AXIS) }; }
    function markerPoint(t, mx, my) { const f = markerFrame(t); return add(t.pos, add(scale(f.x, mx), scale(f.y, my))); }
    // The four corners in OpenCV's order: top-left, top-right, bottom-right, bottom-left.
    function markerCorners(t) {
        const h = t.size / 2;
        return [[-h, h], [h, h], [h, -h], [-h, -h]].map(function (c) { return markerPoint(t, c[0], c[1]); });
    }
    // The camera in the world, as OpenCV sees it: x right, y down, z forward (the optical axis).
    // Body frame: +X front (the camera), +Y left, +Z top, so x = -Y, y = -Z, z = +X.
    function cameraFrame(world, pose) {
        const q = qNorm(pose.q);
        return { pos: add(pose.pos, qRotate(q, world.camera.offset)), x: qRotate(q, [0, -1, 0]), y: qRotate(q, [0, 0, -1]), z: qRotate(q, X_AXIS) };
    }
    function camDir(cf, v) { return [dot(v, cf.x), dot(v, cf.y), dot(v, cf.z)]; }
    function toCamera(cf, p) { return camDir(cf, sub(p, cf.pos)); }
    // Pinhole projection to pixels (no lens distortion in the sandbox).
    function projectPx(cam, pc) { return [cam.fx * pc[0] / pc[2] + cam.cx, cam.fy * pc[1] / pc[2] + cam.cy]; }
    // Rotation (columns = the marker's x, y, z axes in camera coordinates) as an OpenCV rvec (axis * angle).
    function rvecFromAxes(a, b, c) {
        let m00 = a[0], m11 = b[1], m22 = c[2], tr = m00 + m11 + m22, q;
        if (tr > 0) {
            const s0 = Math.sqrt(tr + 1) * 2;
            q = [(b[2] - c[1]) / s0, (c[0] - a[2]) / s0, (a[1] - b[0]) / s0, 0.25 * s0];
        }
        else if (m00 > m11 && m00 > m22) {
            const s1 = Math.sqrt(1 + m00 - m11 - m22) * 2;
            q = [0.25 * s1, (b[0] + a[1]) / s1, (c[0] + a[2]) / s1, (b[2] - c[1]) / s1];
        }
        else if (m11 > m22) {
            const s2 = Math.sqrt(1 + m11 - m00 - m22) * 2;
            q = [(b[0] + a[1]) / s2, 0.25 * s2, (c[1] + b[2]) / s2, (c[0] - a[2]) / s2];
        }
        else {
            const s3 = Math.sqrt(1 + m22 - m00 - m11) * 2;
            q = [(c[0] + a[2]) / s3, (c[1] + b[2]) / s3, 0.25 * s3, (a[1] - b[0]) / s3];
        }
        q = qNorm(q);
        if (q[3] < 0)
            q = q.map(function (v) { return -v; });
        const sv = Math.hypot(q[0], q[1], q[2]), ang = 2 * Math.atan2(sv, q[3]);
        return sv < 1e-12 ? [0, 0, 0] : [q[0] / sv * ang, q[1] / sv * ang, q[2] / sv * ang];
    }
    // What the robot camera reads at `pose`, like cv2.aruco.detectMarkers + estimatePoseSingleMarkers:
    // seen: [{ id, name, corners (px, TL TR BR BL), center (px), rvec, tvec (m, camera frame), distance,
    // perimeter (px), viewAngle (0 = head on), offCentre (deg from the optical axis), imageRoll (deg the
    // marker looks turned in the picture, + = clockwise) }], sorted nearest first.
    // missed: markers in the picture that a detector would miss, each with `why`.
    function readMarkers(world, pose) {
        const cam = world.camera, cf = cameraFrame(world, pose), seen = [], missed = [];
        const minPerim = cam.minPerimeterRate * Math.max(cam.width, cam.height);
        function inside(p) { return p[0] >= 0 && p[0] <= cam.width && p[1] >= 0 && p[1] <= cam.height; }
        world.targets.forEach(function (t) {
            if (!markerBits(t))
                return;
            const cc = markerCorners(t).map(function (c) { return toCamera(cf, c); });
            if (cc.some(function (c) { return c[2] < 0.02; }))
                return; // not in front of the camera
            const px = cc.map(function (c) { return projectPx(cam, c); });
            if (!px.some(inside))
                return; // not in the picture
            let pc = toCamera(cf, t.pos), perim = 0;
            for (let k = 0; k < 4; k++)
                perim += Math.hypot(px[(k + 1) % 4][0] - px[k][0], px[(k + 1) % 4][1] - px[k][1]);
            const view = angleDeg(t.normal, sub(cf.pos, t.pos));
            const up = sub(lerp(px[0], px[1], 0.5).concat(0), lerp(px[3], px[2], 0.5).concat(0));
            const rec = {
                id: markerNumber(t), target: t.id, name: t.name, corners: px, center: projectPx(cam, pc), tvec: pc, distance: len(pc),
                perimeter: perim, viewAngle: view, offCentre: angleDeg([0, 0, 1], pc), imageRoll: Math.atan2(up[0], -up[1]) * 180 / Math.PI
            };
            if (view >= 90)
                rec.why = L('seen from behind', 'পেছন দিক থেকে দেখা যাচ্ছে');
            else if (cam.maxDistance && rec.distance > cam.maxDistance)
                rec.why = L('too far away (' + fmt(rec.distance, 2) + ' m, read within ' + fmt(cam.maxDistance, 2) + ' m)', 'বেশি দূরে (' + fmt(rec.distance, 2) + ' মি; পড়া যায় ' + fmt(cam.maxDistance, 2) + ' মি-র মধ্যে)');
            else if (!px.every(inside))
                rec.why = L('partly outside the picture', 'কিছুটা ছবির বাইরে');
            else if (view > cam.maxViewAngle)
                rec.why = L('seen too edge-on (' + Math.round(view) + '°, needs under ' + fmt(cam.maxViewAngle, 0) + '°)', 'খুব কাত হয়ে দেখা যাচ্ছে (' + Math.round(view) + '°; লাগবে ' + fmt(cam.maxViewAngle, 0) + '°-এর কম)');
            else if (perim < minPerim)
                rec.why = L('too small in the picture (' + Math.round(perim) + ' px around, needs ' + Math.round(minPerim) + ')', 'ছবিতে খুব ছোট (চারপাশ মিলিয়ে ' + Math.round(perim) + ' px; লাগবে ' + Math.round(minPerim) + ')');
            if (rec.why) {
                missed.push(rec);
                return;
            }
            const f = markerFrame(t);
            rec.rvec = rvecFromAxes(camDir(cf, f.x), camDir(cf, f.y), camDir(cf, f.z));
            seen.push(rec);
        });
        seen.sort(function (a, b) { return a.distance - b.distance; });
        return { seen: seen, missed: missed, camera: cf };
    }
    // What a program works out from a tvec: the marker centre in the body frame, then in the world.
    function markerFromTvec(world, pose, tvec) {
        const o = world.camera.offset, body = [o[0] + tvec[2], o[1] - tvec[0], o[2] - tvec[1]];
        return { body: body, world: add(pose.pos, qRotate(qNorm(pose.q), body)) };
    }
    // How well a pose can photograph target t.
    function captureCheck(world, t, pose) {
        const s = world.settings, c = targetCenter(t), toT = sub(c, pose.pos), d = len(toT);
        const aim = d > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, dot(cameraDir(pose.q), norm(toT))))) * 180 / Math.PI : 180;
        const lo = Math.max(0, s.standoff - s.rangeTolerance), hi = s.standoff + s.rangeTolerance;
        return {
            dist: d, aim: aim, lo: lo, hi: hi,
            front: dot(sub(pose.pos, c), t.normal) > 0,
            inRange: d >= lo - 1e-9 && d <= hi + 1e-9,
            aimed: aim <= s.aimTolerance + 1e-9
        };
    }

    /* ---------- checkpoints (7th Kibo-RPC) ---------- */
    // Highest level whose margin covers `v`; 0 = outside every band.
    function bandLevel(v, bands, key) {
        let lv = 0;
        bands.forEach(function (b) { if (v <= b[key] + 1e-9 && b.level > lv)
            lv = b.level; });
        return lv;
    }
    function outerBand(bands, key) { return bands.reduce(function (m, b) { return Math.max(m, b[key]); }, 0); }
    function bandFor(bands, key, level) { for (let i = 0; i < bands.length; i++)
        if (bands[i].level === level)
            return bands[i][key]; return null; }
    function topLevel(c) { return c.scoreBands.reduce(function (m, b) { return Math.max(m, b.level); }, 0); }
    // How the judge rates `pose` at checkpoint c. Position, camera centring on the marker and roll about
    // the line of sight each get a level from their bands; the lowest one counts (0 = not passed).
    function checkpointCheck(world, c, pose) {
        const max = topLevel(c), d = dist(pose.pos, c.pos);
        const centering = c.marker ? angleDeg(cameraDir(pose.q), sub(c.marker, pose.pos)) : 0;
        const roll = c.q ? rollErrorDeg(pose.q, c.q) : 0;
        const lv = {
            pos: bandLevel(d, c.scoreBands, 'radius'),
            centering: c.centeringBands.length ? bandLevel(centering, c.centeringBands, 'angle') : max,
            roll: c.rollBands.length ? bandLevel(Math.abs(roll), c.rollBands, 'angle') : max
        };
        const level = Math.min(lv.pos, lv.centering, lv.roll);
        return { dist: d, centering: centering, roll: roll, levels: lv, level: level, passed: level > 0 };
    }
    function checkpointRun(world, route, analysis, reach) {
        const sc = world.scoring, per = {}, holds = {};
        world.checkpoints.forEach(function (c) {
            // Assigned in the callback below, so typed with `as` (a plain annotation would narrow them to null).
            let best = null, near = null, blocked = null;
            route.forEach(function (w, i) {
                const ck = checkpointCheck(world, c, analysis.poses[i]);
                if (ck.passed && reach[i] && (!best || ck.level > best.ck.level))
                    best = { i: i, ck: ck };
                if (ck.passed && !reach[i] && !blocked)
                    blocked = { i: i, ck: ck };
                // The waypoint to give advice about: close to the checkpoint and looking roughly at its marker.
                const cost = ck.dist / outerBand(c.scoreBands, 'radius') + (c.centeringBands.length ? ck.centering / outerBand(c.centeringBands, 'angle') : 0);
                if (!near || cost < near.cost)
                    near = { i: i, ck: ck, cost: cost };
            });
            per[c.key] = { best: best, near: near, blocked: blocked };
            if (best)
                holds[best.i] = (holds[best.i] || 0) + 1;
        });
        let t = 0, arrive = [];
        analysis.legs.forEach(function (l, i) { t += l.time; arrive.push(t); t += (holds[i] || 0) * sc.checkTime; });
        Object.keys(per).forEach(function (k) {
            const b = per[k].best;
            if (b) {
                b.at = arrive[b.i] + sc.checkTime;
                b.inTime = b.at <= sc.timeLimit + 1e-9;
            }
        });
        return { per: per, arrive: arrive, finish: t, limit: sc.timeLimit };
    }
    function markerName(world, c) {
        const t = world.targets.filter(function (x) { return markerNumber(x) === c.id; })[0];
        return t && c.marker && dist(t.pos, c.marker) < 0.05 ? t.name : null;
    }
    function levelsText(ck) {
        return L('position ', 'অবস্থান ') + fmt(ck.dist, 2) + L(' m (Lv', ' মি (Lv') + ck.levels.pos + L('), centring ', '), কেন্দ্রে রাখা ') + Math.round(ck.centering) + '° (Lv' + ck.levels.centering +
            L('), roll ', '), রোল ') + Math.round(Math.abs(ck.roll)) + '° (Lv' + ck.levels.roll + ')';
    }
    // + roll error = the robot must turn clockwise (seen from behind the camera), so the camera picture turns
    // anticlockwise: that is the ⟲ button (Q) in Drive.
    function rollWay(roll) {
        const n = Math.round(Math.abs(roll));
        return roll > 0 ? L('roll it ' + n + '° with ⟲ (Q): the camera picture turns anticlockwise', '⟲ (Q) দিয়ে ' + n + '° রোল করো: ক্যামেরার ছবি ঘড়ির কাঁটার উল্টো দিকে ঘুরবে')
            : L('roll it ' + n + '° with ⟳ (E): the camera picture turns clockwise', '⟳ (E) দিয়ে ' + n + '° রোল করো: ক্যামেরার ছবি ঘড়ির কাঁটার দিকে ঘুরবে');
    }
    // Metres, with a third decimal when two would hide which side of `limit` it is on.
    function mText(v, limit) { return fmt(v, Math.abs(v - limit) < 0.01 ? 3 : 2); }
    // What stands between `ck` and `level`, e.g. "For Lv3: get within 0.1 m and centre the marker within 10°."
    function improveText(c, ck, level) {
        const out = [], r = bandFor(c.scoreBands, 'radius', level), a = bandFor(c.centeringBands, 'angle', level), ro = bandFor(c.rollBands, 'angle', level);
        if (r != null && ck.levels.pos < level)
            out.push(L('get within ' + fmt(r, 2) + ' m of its centre', 'কেন্দ্রের ' + fmt(r, 2) + ' মি-র মধ্যে যাও'));
        if (a != null && ck.levels.centering < level)
            out.push(L('centre the marker within ' + fmt(a, 1) + '°', 'মার্কারটা ' + fmt(a, 1) + '°-এর মধ্যে মাঝখানে আনো'));
        if (ro != null && ck.levels.roll < level)
            out.push(rollWay(ck.roll) + L(' (within ' + fmt(ro, 1) + '°)', ' (' + fmt(ro, 1) + '°-এর মধ্যে)'));
        return out.length ? L('For Lv' + level + ': ' + out.join('; ') + '.', 'Lv' + level + '-এর জন্য: ' + out.join('; ') + '।') : '';
    }
    function checkpointGoal(world, c, run) {
        const r = run.per[c.key], b = r.best, sc = world.scoring, counted = !!(b && b.inTime), isGoal = c.id === world.goal;
        const r1 = outerBand(c.scoreBands, 'radius');
        const g = {
            id: c.key, number: c.id, name: c.name + (isGoal ? L(' (goal)', ' (গোল)') : ''), kind: 'checkpoint', goal: isGoal, done: counted,
            level: counted ? b.ck.level : 0, points: counted ? (sc.points[b.ck.level] || 0) : 0,
            index: b ? b.i : r.near ? r.near.i : -1,
            // Where an exported program would ask the judge about this checkpoint.
            notify: b ? b.i : r.near && r.near.ck.dist <= 2 * r1 ? r.near.i : -1
        };
        if (counted) {
            g.message = L('Waypoint ' + (b.i + 1) + ' passes it at Lv' + b.ck.level + ' (' + fmt(g.points, 1) + ' pt): ' + levelsText(b.ck) + '.', 'ওয়েপয়েন্ট ' + (b.i + 1) + ' এটা Lv' + b.ck.level + '-এ পার হয় (' + fmt(g.points, 1) + ' পয়েন্ট): ' + levelsText(b.ck) + '।');
            if (b.ck.level < topLevel(c))
                g.message += ' ' + improveText(c, b.ck, b.ck.level + 1);
        }
        else if (b) {
            g.message = L('Waypoint ' + (b.i + 1) + ' would pass it at Lv' + b.ck.level + ', but only after the ' + fmt(sc.timeLimit / 60, 1) + ' min limit. Save time earlier in the route.', 'ওয়েপয়েন্ট ' + (b.i + 1) + ' এটা Lv' + b.ck.level + '-এ পার হতো, কিন্তু ' + fmt(sc.timeLimit / 60, 1) + ' মিনিটের সময়সীমা পেরিয়ে যাওয়ার পরে। রুটের আগের অংশে সময় বাঁচাও।');
        }
        else if (r.blocked) {
            g.message = L('Waypoint ' + (r.blocked.i + 1) + ' would pass it, but a move before it is blocked.', 'ওয়েপয়েন্ট ' + (r.blocked.i + 1) + ' এটা পার হতো, কিন্তু এর আগের একটা পথ আটকে আছে।');
        }
        else if (!r.near || r.near.ck.dist > 1) {
            const mk = markerName(world, c);
            g.message = L('No waypoint near it yet. It is at ' + vecFmt(c.pos) + (mk ? ', in front of ' + mk : '') + '. Stand inside its sphere, look at the marker and match its roll.', 'এখনো এর কাছে কোনো ওয়েপয়েন্ট নেই। এটা আছে ' + vecFmt(c.pos) + '-এ' + (mk ? ', ' + mk + '-এর সামনে' : '') + '। এর গোলকের ভেতরে দাঁড়াও, মার্কারের দিকে তাকাও আর রোল মেলাও।');
        }
        else {
            const ck = r.near.ck, wp = L('Waypoint ', 'ওয়েপয়েন্ট ') + (r.near.i + 1), out = [];
            const aMax = fmt(outerBand(c.centeringBands, 'angle'), 1), rMax = fmt(outerBand(c.rollBands, 'angle'), 1);
            if (!ck.levels.pos)
                out.push(L(wp + ' is ' + mText(ck.dist, r1) + ' m from its centre (Lv1 needs ' + fmt(r1, 2) + ' m or less).', wp + ' কেন্দ্র থেকে ' + mText(ck.dist, r1) + ' মি দূরে (Lv1-এর জন্য ' + fmt(r1, 2) + ' মি বা তার কম লাগবে)।'));
            if (!ck.levels.centering)
                out.push(L((out.length ? 'Its' : wp + '\'s') + ' camera is ' + Math.round(ck.centering) + '° off the marker (Lv1 needs ' + aMax + '° or less).', (out.length ? 'এর' : wp + '-এর') + ' ক্যামেরা মার্কার থেকে ' + Math.round(ck.centering) + '° সরে আছে (Lv1-এর জন্য ' + aMax + '° বা তার কম লাগবে)।'));
            if (!ck.levels.roll)
                out.push(L((out.length ? 'And its' : wp + '\'s') + ' roll is off: ' + rollWay(ck.roll) + ' (Lv1 needs ' + rMax + '° or less).', (out.length ? 'আর এর' : wp + '-এর') + ' রোল মিলছে না: ' + rollWay(ck.roll) + ' (Lv1-এর জন্য ' + rMax + '° বা তার কম লাগবে)।'));
            g.message = out.join(' ');
        }
        return g;
    }
    // The goal checkpoint must be the last one passed; the goal points also need every checkpoint.
    function scoreRun(world, goals, run) {
        const sc = world.scoring, cps = goals.filter(function (g) { return g.kind === 'checkpoint'; });
        const goal = cps.filter(function (g) { return g.goal; })[0];
        if (goal && goal.done) {
            const later = cps.filter(function (g) { return !g.goal && g.done && g.index > goal.index; });
            if (later.length) {
                goal.done = false;
                const names = later.map(function (g) { return g.name; }).join(', ');
                goal.message = L('Waypoint ' + (goal.index + 1) + ' passes it at Lv' + goal.level + ', but the goal must be the last checkpoint: ' + names + (later.length > 1 ? ' come' : ' comes') + ' after it.', 'ওয়েপয়েন্ট ' + (goal.index + 1) + ' এটা Lv' + goal.level + '-এ পার হয়, কিন্তু গোলকে সবশেষ চেকপয়েন্ট হতে হবে: ' + names + ' এর পরে আসে।');
            }
        }
        const inTime = run.finish <= run.limit + 1e-9;
        const cpPts = cps.reduce(function (s, g) { return s + g.points; }, 0);
        const goalPts = goal && goal.done && inTime && cps.every(function (g) { return g.done; }) ? sc.goalPoints : 0;
        if (goal && goal.done && !goalPts)
            goal.message += L(' The goal points (' + fmt(sc.goalPoints, 1) + ') also need ' + (inTime ? 'every other checkpoint.' : 'the mission to end within the time limit.'), ' গোলের পয়েন্ট (' + fmt(sc.goalPoints, 1) + ') পেতে ' + (inTime ? 'বাকি সব চেকপয়েন্টও পার হতে হবে।' : 'মিশনটাও সময়সীমার মধ্যে শেষ হতে হবে।'));
        const bonus = inTime ? Math.min(2, 1 + (run.limit - run.finish) / run.limit) : 1;
        return { checkpoints: cpPts, goal: goalPts, bonus: bonus, total: (cpPts + goalPts) * bonus, time: run.finish, limit: run.limit, inTime: inTime };
    }

    /* ---------- allowed space ---------- */
    // Inside a box shrunk by `pad` (boundary counts as inside).
    function inShrunk(p, b, pad) {
        return p[0] >= b.min[0] + pad - EPS && p[0] <= b.max[0] - pad + EPS &&
            p[1] >= b.min[1] + pad - EPS && p[1] <= b.max[1] - pad + EPS &&
            p[2] >= b.min[2] + pad - EPS && p[2] <= b.max[2] - pad + EPS;
    }
    // Strictly inside a box grown by `pad` (boundary counts as outside).
    function inGrown(p, b, pad) {
        return p[0] > b.min[0] - pad + EPS && p[0] < b.max[0] + pad - EPS &&
            p[1] > b.min[1] - pad + EPS && p[1] < b.max[1] + pad - EPS &&
            p[2] > b.min[2] - pad + EPS && p[2] < b.max[2] + pad - EPS;
    }
    function inBox(p, b) { return inShrunk(p, b, 0); }
    function pointStatus(world, p) {
        let c = world.settings.clearance, i;
        for (i = 0; i < world.koz.length; i++) {
            if (inGrown(p, world.koz[i], c))
                return { free: false, why: 'koz', zone: world.koz[i].name };
        }
        for (i = 0; i < world.kiz.length; i++)
            if (inShrunk(p, world.kiz[i], c))
                return { free: true, zone: world.kiz[i].name };
        return { free: false, why: 'outside' };
    }
    function isFree(world, p) { return pointStatus(world, p).free; }
    // One step of manual driving: never enter disallowed space; when the full step is blocked,
    // slide along the wall by keeping the axis moves that stay allowed.
    function driveStep(world, p, delta) {
        return slideStep(function (q) { return isFree(world, q); }, p, delta);
    }
    // The same for any allowed space, given by `free(point)`.
    function slideStep(free, p, delta) {
        const full = add(p, delta);
        if (!free(p))
            return full; // already outside: let the student drive back in
        if (free(full))
            return full;
        let q = p.slice();
        for (let k = 0; k < 3; k++) {
            if (!delta[k])
                continue;
            const t = q.slice();
            t[k] += delta[k];
            if (free(t))
                q = t;
        }
        return q;
    }
    function whyText(st) {
        if (!st || st.free)
            return L('allowed', 'ঠিক জায়গায়');
        if (st.why === 'koz')
            return L('inside ' + st.zone + ' (plus clearance)', st.zone + '-এর ভেতরে (চারপাশের ফাঁকসহ)');
        return L('outside the Keep-In Zones (minus clearance)', 'কিপ-ইন জোনের বাইরে (দেয়াল থেকে ফাঁক ধরে)');
    }
    // Sample the straight move every `step` metres (1 cm by default).
    function checkSegment(world, a, b, step) {
        step = step || 0.01;
        const L = dist(a, b), n = Math.max(1, Math.ceil(L / step - 1e-9));
        for (let i = 0; i <= n; i++) {
            const t = i / n, p = lerp(a, b, t), st = pointStatus(world, p);
            if (!st.free)
                return { clear: false, hit: p, t: t, why: st.why, zone: st.zone };
        }
        return { clear: true };
    }
    function oasisLength(world, a, b) {
        if (!world.oasis.length)
            return 0;
        let L = dist(a, b), n = Math.max(1, Math.ceil(L / 0.01 - 1e-9)), inside = 0;
        for (let i = 0; i < n; i++) {
            const p = lerp(a, b, (i + 0.5) / n);
            for (let k = 0; k < world.oasis.length; k++) {
                if (inBox(p, world.oasis[k])) {
                    inside++;
                    break;
                }
            }
        }
        return L * inside / n;
    }

    /* ---------- voxel grid + A* ---------- */
    let gridCache = null;
    function getGrid(world) {
        const s = world.settings;
        const key = JSON.stringify([world.kiz, world.koz, s.clearance, s.gridRes]);
        if (gridCache && gridCache.key === key)
            return gridCache;
        const res = s.gridRes, bb = kizBounds(world);
        const nx = Math.floor((bb.max[0] - bb.min[0]) / res + 1e-6) + 1;
        const ny = Math.floor((bb.max[1] - bb.min[1]) / res + 1e-6) + 1;
        const nz = Math.floor((bb.max[2] - bb.min[2]) / res + 1e-6) + 1;
        const n = nx * ny * nz;
        if (n > 4e6)
            fail(L('The grid is too fine for a world this big. Raise settings.gridRes.', 'এত বড় ওয়ার্ল্ডের জন্য গ্রিড খুব সূক্ষ্ম। settings.gridRes বাড়াও।'));
        const free = new Uint8Array(n);
        const g = { key: key, res: res, min: bb.min, nx: nx, ny: ny, nz: nz, n: n, free: free };
        for (let i = 0; i < n; i++)
            free[i] = isFree(world, gridPos(g, i)) ? 1 : 0;
        gridCache = g;
        return g;
    }
    function gridPos(g, i) {
        const ix = i % g.nx, iy = Math.floor(i / g.nx) % g.ny, iz = Math.floor(i / (g.nx * g.ny));
        return [g.min[0] + ix * g.res, g.min[1] + iy * g.res, g.min[2] + iz * g.res];
    }
    function gridIdx(g, ix, iy, iz) {
        if (ix < 0 || iy < 0 || iz < 0 || ix >= g.nx || iy >= g.ny || iz >= g.nz)
            return -1;
        return ix + g.nx * (iy + g.ny * iz);
    }
    // Free grid nodes near p that p can reach in a straight, clear line.
    function nearNodes(world, g, p) {
        const c = [0, 1, 2].map(function (k) { return Math.round((p[k] - g.min[k]) / g.res); });
        for (let R = 1; R <= 4; R++) {
            const out = [];
            for (let dz = -R; dz <= R; dz++)
                for (let dy = -R; dy <= R; dy++)
                    for (let dx = -R; dx <= R; dx++) {
                        const idx = gridIdx(g, c[0] + dx, c[1] + dy, c[2] + dz);
                        if (idx < 0 || !g.free[idx])
                            continue;
                        const q = gridPos(g, idx);
                        if (checkSegment(world, p, q).clear)
                            out.push({ idx: idx, d: dist(p, q) });
                    }
            if (out.length)
                return out;
        }
        return [];
    }
    function Heap() { this.k = []; this.v = []; }
    Heap.prototype.push = function (key, val) {
        let k = this.k, v = this.v, i = k.length;
        k.push(key);
        v.push(val);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (k[p] <= key)
                break;
            k[i] = k[p];
            v[i] = v[p];
            i = p;
        }
        k[i] = key;
        v[i] = val;
    };
    Heap.prototype.pop = function () {
        const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
        if (n) {
            let i = 0;
            for (;;) {
                let l = 2 * i + 1, r = l + 1, m = i, mk = lk;
                if (l < n && k[l] < mk) {
                    m = l;
                    mk = k[l];
                }
                if (r < n && k[r] < mk) {
                    m = r;
                    mk = k[r];
                }
                if (m === i)
                    break;
                k[i] = k[m];
                v[i] = v[m];
                i = m;
            }
            k[i] = lk;
            v[i] = lv;
        }
        return top;
    };
    Heap.prototype.size = function () { return this.k.length; };
    const NEIGHBOURS = (function () {
        const out = [];
        for (let dz = -1; dz <= 1; dz++)
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx || dy || dz)
                        out.push([dx, dy, dz, Math.sqrt(dx * dx + dy * dy + dz * dz)]);
                }
        return out;
    })();
    // Plan a clear path from a to b. Returns { ok, points: [a, ...via, b] } or { ok: false, reason }.
    function planPath(world, a, b) {
        const sa = pointStatus(world, a), sb = pointStatus(world, b);
        if (!sa.free)
            return { ok: false, reason: L('The start of this move is ' + whyText(sa) + '.', 'এই পথের শুরুটা ' + whyText(sa) + '।') };
        if (!sb.free)
            return { ok: false, reason: L('The end of this move is ' + whyText(sb) + '.', 'এই পথের শেষটা ' + whyText(sb) + '।') };
        if (checkSegment(world, a, b).clear)
            return { ok: true, points: [a.slice(), b.slice()] };
        const g = getGrid(world);
        const seeds = nearNodes(world, g, a), goals = nearNodes(world, g, b);
        if (!seeds.length || !goals.length)
            return { ok: false, reason: L('No grid point is reachable here. Try a smaller grid size.', 'এখানে গ্রিডের কোনো বিন্দুতে পৌঁছানো যাচ্ছে না। গ্রিড আরও ছোট করে দেখো।') };
        const goalD = new Map();
        goals.forEach(function (o) { goalD.set(o.idx, o.d); });
        const gScore = new Float64Array(g.n).fill(Infinity), came = new Int32Array(g.n).fill(-1), closed = new Uint8Array(g.n);
        const heap = new Heap();
        seeds.forEach(function (o) {
            if (o.d < gScore[o.idx]) {
                gScore[o.idx] = o.d;
                came[o.idx] = -2;
                heap.push(o.d + dist(gridPos(g, o.idx), b), o.idx);
            }
        });
        let found = -1, nxy = g.nx * g.ny;
        while (heap.size()) {
            const cur = heap.pop();
            if (closed[cur])
                continue;
            closed[cur] = 1;
            if (goalD.has(cur)) {
                found = cur;
                break;
            }
            const cx = cur % g.nx, cy = Math.floor(cur / g.nx) % g.ny, cz = Math.floor(cur / nxy), cp = gridPos(g, cur);
            for (let i = 0; i < NEIGHBOURS.length; i++) {
                const o = NEIGHBOURS[i], ni = gridIdx(g, cx + o[0], cy + o[1], cz + o[2]);
                if (ni < 0 || closed[ni] || !g.free[ni])
                    continue;
                const ng = gScore[cur] + o[3] * g.res;
                if (ng >= gScore[ni])
                    continue;
                const np = gridPos(g, ni);
                if (!checkSegment(world, cp, np).clear)
                    continue;
                gScore[ni] = ng;
                came[ni] = cur;
                heap.push(ng + dist(np, b), ni);
            }
        }
        if (found < 0)
            return { ok: false, reason: L('No clear route exists between these points.', 'এই দুই বিন্দুর মাঝে বাধাহীন কোনো রুট নেই।') };
        const nodes = [];
        for (let at = found; at >= 0; at = came[at])
            nodes.push(gridPos(g, at));
        nodes.reverse();
        const pts = [a.slice()].concat(nodes, [b.slice()]);
        return { ok: true, points: shortcut(world, pts) };
    }
    // Greedy line-of-sight shortcutting: from each point jump to the farthest point it can see.
    function shortcut(world, pts) {
        let out = [pts[0]], i = 0;
        while (i < pts.length - 1) {
            let j = pts.length - 1;
            while (j > i + 1 && !checkSegment(world, pts[i], pts[j]).clear)
                j--;
            out.push(pts[j]);
            i = j;
        }
        // Tidy via points to the millimetre when that keeps every move clear.
        const tidy = out.map(function (p, k) { return k === 0 || k === out.length - 1 ? p : roundVec(p, 3); });
        for (let k = 1; k < tidy.length; k++)
            if (!checkSegment(world, tidy[k - 1], tidy[k]).clear)
                return out;
        return tidy;
    }
    // Closest allowed point to p (p itself when it is already allowed), or null.
    function nearestFree(world, p) {
        if (isFree(world, p))
            return p.slice();
        let c = world.settings.clearance, best = null, bd = Infinity;
        world.kiz.forEach(function (b) {
            const q = [];
            for (let k = 0; k < 3; k++) {
                const lo = b.min[k] + c, hi = b.max[k] - c;
                if (lo > hi)
                    return;
                q.push(Math.min(hi, Math.max(lo, p[k])));
            }
            const d = dist(p, q);
            if (d < bd && isFree(world, q)) {
                bd = d;
                best = q;
            }
        });
        if (best)
            return best;
        const g = getGrid(world);
        for (let i = 0; i < g.n; i++) {
            if (!g.free[i])
                continue;
            const q = gridPos(g, i), d = dist(p, q);
            if (d < bd) {
                bd = d;
                best = q;
            }
        }
        return best;
    }

    /* ---------- poses and routes ---------- */
    // A pose `standoff` metres in front of the target (clamped into allowed space), camera facing it.
    function standoffPose(world, target, standoff) {
        if (typeof target === 'string')
            target = findTarget(world, target);
        if (!target)
            return null;
        const c = targetCenter(target);
        const desired = add(c, scale(target.normal, standoff == null ? world.settings.standoff : standoff));
        const pos = nearestFree(world, desired) || desired;
        return { pos: pos, q: faceQuat(pos, c), desired: desired, clamped: dist(pos, desired) > 1e-6 };
    }
    const MODES = ['keep', 'travel', 'target', 'custom'];
    // `w` / `route`: raw JSON from a save, a file or the page, checked here.
    function normalizeWaypoint(w, i) {
        if (!w || typeof w !== 'object')
            fail(L('Waypoint ' + (i + 1) + ' must be an object', 'ওয়েপয়েন্ট ' + (i + 1) + ' একটা অবজেক্ট হতে হবে'));
        const pos = isVec(w.pos) ? w.pos.slice() : (isNum(w.x) && isNum(w.y) && isNum(w.z) ? [w.x, w.y, w.z] : null);
        if (!pos)
            fail(L('Waypoint ' + (i + 1) + ' needs "pos": [x, y, z]', 'ওয়েপয়েন্ট ' + (i + 1) + '-এ "pos": [x, y, z] লাগবে'));
        const o = { name: w.name ? String(w.name) : L('Waypoint ', 'ওয়েপয়েন্ট ') + (i + 1), pos: pos, mode: MODES.indexOf(w.mode) >= 0 ? w.mode : 'keep' };
        if (w.mode === 'target' || w.target != null)
            o.target = w.target != null ? String(w.target) : '';
        if (o.mode === 'custom' || w.q != null) {
            if (w.q != null && !isVec(w.q, 4))
                fail(L('Waypoint ' + (i + 1) + ' "q" must be [x, y, z, w]', 'ওয়েপয়েন্ট ' + (i + 1) + '-এর "q" হতে হবে [x, y, z, w]'));
            o.q = (w.q || [0, 0, 0, 1]).slice();
        }
        if (w.via)
            o.via = true;
        return o;
    }
    function normalizeRoute(route) {
        if (!Array.isArray(route))
            fail(L('A route must be a list of waypoints', 'রুট হতে হবে ওয়েপয়েন্টের একটা তালিকা'));
        return route.map(normalizeWaypoint);
    }
    // Work out the orientation of every waypoint.
    function resolveRoute(world, route) {
        let prevPos = world.start.pos, prevQ = qNorm(world.start.q);
        return route.map(function (w) {
            let q = prevQ, t;
            if (w.mode === 'travel') {
                const d = sub(w.pos, prevPos);
                if (len(d) > 1e-6)
                    q = qFromTo(X_AXIS, d);
            }
            else if (w.mode === 'target' && (t = findTarget(world, w.target))) {
                if (dist(w.pos, targetCenter(t)) > 1e-6)
                    q = faceQuat(w.pos, targetCenter(t));
            }
            else if (w.mode === 'custom' && w.q) {
                q = qNorm(w.q);
            }
            prevPos = w.pos;
            prevQ = q;
            return { pos: w.pos, q: q };
        });
    }
    function analyzeRoute(world, route) {
        const poses = resolveRoute(world, route), s = world.settings;
        let prevPos = world.start.pos, prevQ = qNorm(world.start.q);
        const out = { poses: poses, legs: [], blocked: 0, distance: 0, time: 0, oasis: 0, startStatus: pointStatus(world, world.start.pos) };
        poses.forEach(function (p, i) {
            const seg = checkSegment(world, prevPos, p.pos), d = dist(prevPos, p.pos), turn = qAngleDeg(prevQ, p.q);
            const leg = {
                index: i, from: prevPos, to: p.pos, qFrom: prevQ, qTo: p.q, dist: d, turn: turn,
                time: Math.max(d / s.speed, turn / s.turnRate), clear: seg.clear, oasis: oasisLength(world, prevPos, p.pos),
                endStatus: pointStatus(world, p.pos)
            };
            if (!seg.clear) {
                leg.hit = seg.hit;
                leg.why = seg.why;
                leg.zone = seg.zone;
                out.blocked++;
            }
            out.legs.push(leg);
            out.distance += d;
            out.time += leg.time;
            out.oasis += leg.oasis;
            prevPos = p.pos;
            prevQ = p.q;
        });
        return out;
    }
    function legEnds(world, route, i) {
        return { from: i === 0 ? world.start.pos : route[i - 1].pos, to: route[i].pos };
    }
    // Insert via points so leg i (into waypoint i) goes around whatever blocks it.
    function routeAround(world, route, i) {
        const e = legEnds(world, route, i), r = planPath(world, e.from, e.to);
        if (!r.ok)
            return { ok: false, route: route, message: r.reason };
        const vias = r.points.slice(1, -1).map(function (p) { return { name: 'via', pos: p, mode: 'keep', via: true }; });
        return { ok: true, route: route.slice(0, i).concat(vias, route.slice(i)), added: vias.length };
    }
    function fixRoute(world, route) {
        let r = copy(route), messages = [], fixed = 0, i;
        const ss = pointStatus(world, world.start.pos);
        if (!ss.free)
            messages.push(world.start.name + L(' is ' + whyText(ss) + ', so moves from it cannot be fixed.', ' ' + whyText(ss) + ', তাই সেখান থেকে যাওয়ার পথ ঠিক করা যাবে না।'));
        for (i = 0; i < r.length; i++) {
            const st = pointStatus(world, r[i].pos);
            if (st.free)
                continue;
            const np = nearestFree(world, r[i].pos);
            if (!np) {
                messages.push(L('Waypoint ' + (i + 1) + ' has no allowed point nearby.', 'ওয়েপয়েন্ট ' + (i + 1) + '-এর কাছে চলার মতো কোনো জায়গা নেই।'));
                continue;
            }
            messages.push(L('Moved waypoint ' + (i + 1) + ' ' + Math.round(dist(np, r[i].pos) * 100) + ' cm: it was ' + whyText(st) + '.', 'ওয়েপয়েন্ট ' + (i + 1) + '-কে ' + Math.round(dist(np, r[i].pos) * 100) + ' সেমি সরানো হলো: এটা ' + whyText(st) + ' ছিল।'));
            r[i].pos = roundVec(np, 4);
            if (!isFree(world, r[i].pos))
                r[i].pos = np;
        }
        for (i = r.length - 1; i >= 0; i--) {
            const e = legEnds(world, r, i);
            if (checkSegment(world, e.from, e.to).clear)
                continue;
            const res = routeAround(world, r, i);
            if (res.ok) {
                r = res.route;
                fixed++;
            }
            else
                messages.push(L('Move into waypoint ' + (i + 1) + ': ', 'ওয়েপয়েন্ট ' + (i + 1) + '-এ যাওয়ার পথ: ') + res.message);
        }
        return { route: r, fixed: fixed, messages: messages };
    }
    // A waypoint for a "Go to..." choice: a target id (standoff pose) or a preset pose id.
    // "Go to..." is a starting point, never the answer: target and pose goals get a deliberately rough
    // pose (too far, too close and/or aimed off centre) that the mission check rejects, so students
    // still have to work out the real pose. `salt` varies the mistake between calls.
    function hashStr(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++)
            h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        return h >>> 0;
    }
    function perpTo(d) { return norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0])); }
    // Turn orientation q so the camera swings `deg` degrees sideways.
    function swing(q, deg, sign) {
        const axis = perpTo(cameraDir(q));
        return qNorm(qMul(qFromAxisAngle(axis, sign * deg * Math.PI / 180), q));
    }
    function roughTargetPose(world, t, salt) {
        const s = world.settings, c = targetCenter(t), h = hashStr(t.id + ':' + (salt || 0));
        const kind = ['far', 'near', 'aim', 'far+aim'][h % 4], sign = (h >> 3) % 2 ? 1 : -1;
        const lo = Math.max(0, s.standoff - s.rangeTolerance), hi = s.standoff + s.rangeTolerance;
        const d = kind === 'near' ? Math.max(0.15, lo - 0.15) : kind === 'aim' ? s.standoff : hi + 0.15 + ((h >> 5) % 10) / 100;
        const want = add(add(c, scale(t.normal, d)), scale(perpTo(t.normal), sign * 0.08));
        let pos = roundVec(nearestFree(world, want) || want, 3);
        if (!isFree(world, pos))
            pos = nearestFree(world, want) || want;
        const aimErr = kind.indexOf('aim') >= 0 ? s.aimTolerance + 6 + ((h >> 7) % 9) : 0;
        let q = faceQuat(pos, c);
        if (aimErr)
            q = swing(q, aimErr, sign);
        const ck = captureCheck(world, t, { pos: pos, q: q });
        // Clamping into the KIZ can pull the distance (nearly) back into range; then spoil the aim instead.
        if (ck.aimed && Math.max(ck.lo - ck.dist, ck.dist - ck.hi, 0) < 0.05)
            q = swing(faceQuat(pos, c), s.aimTolerance + 8, sign);
        return { pos: pos, q: roundVec(q, 4) };
    }
    function roughPose(world, p, salt) {
        const s = world.settings, h = hashStr(p.id + ':' + (salt || 0)), sign = (h >> 3) % 2 ? 1 : -1;
        const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], off = scale(dirs[h % 3], sign * (s.poseTolerance + 0.08 + ((h >> 5) % 8) / 100));
        let want = add(p.pos, off), pos = nearestFree(world, want) || want;
        if (dist(pos, p.pos) <= s.poseTolerance)
            pos = nearestFree(world, sub(p.pos, off)) || pos;
        return { pos: roundVec(pos, 3), q: roundVec(swing(p.q, s.aimTolerance + 10, sign), 4) };
    }
    function maxBand(bands, key) { return bands.length ? bands[bands.length - 1][key] : Infinity; }
    // A checkpoint pose that is close but fails: outside the largest position band, rolled past the
    // largest roll band, and/or aimed past the largest centring band.
    function roughCheckpointPose(world, cp, salt) {
        const h = hashStr(cp.key + ':' + (salt || 0)), sign = (h >> 3) % 2 ? 1 : -1;
        const kinds = ['far', 'roll', 'aim', 'far+roll'].filter(function (k) {
            return (k.indexOf('roll') < 0 || cp.rollBands.length) && (k !== 'aim' || cp.centeringBands.length);
        });
        const kind = kinds[h % kinds.length], r1 = maxBand(cp.scoreBands, 'radius');
        const look = cp.marker || (cp.q ? add(cp.pos, cameraDir(cp.q)) : add(cp.pos, X_AXIS));
        const away = norm(sub(cp.pos, look)), side = perpTo(away);
        const want = kind.indexOf('far') >= 0
            ? add(add(cp.pos, scale(away, r1 + 0.06 + ((h >> 5) % 8) / 100)), scale(side, sign * 0.03))
            : add(cp.pos, scale(side, sign * 0.04));
        let pos = roundVec(nearestFree(world, want) || want, 3);
        if (!isFree(world, pos))
            pos = nearestFree(world, want) || want;
        let base = cp.q || faceQuat(pos, look), q = aimQuat(base, sub(look, pos));
        const rollErr = maxBand(cp.rollBands, 'angle') + 12 + ((h >> 7) % 15), aimErr = maxBand(cp.centeringBands, 'angle') + 8 + ((h >> 7) % 8);
        function roll(qq, deg) { return qNorm(qMul(qFromAxisAngle(cameraDir(qq), deg * Math.PI / 180), qq)); }
        if (kind.indexOf('roll') >= 0)
            q = roll(q, sign * rollErr);
        if (kind === 'aim')
            q = swing(q, aimErr, sign);
        // Clamping into the keep-in zone can pull the position back into a band; then spoil the attitude too.
        if (checkpointCheck(world, cp, { pos: pos, q: q }).passed)
            q = cp.rollBands.length ? roll(q, sign * rollErr) : swing(q, aimErr, sign);
        return { pos: pos, q: roundVec(q, 4) };
    }
    // A random checkpoint layout in the style of the 7th Kibo-RPC: each checkpoint sits `distance`
    // metres from its AR marker, up to `angle` degrees off the marker's normal, camera on the marker
    // and a random roll. opts: { seed, count (8), goal (12), distance ([0.45, 0.6]), angle (20) }.
    function makeCheckpoints(world, opts) {
        opts = opts || {};
        let seed = (opts.seed == null ? Date.now() : opts.seed) >>> 0;
        function rnd() {
            seed = (seed + 0x6D2B79F5) >>> 0;
            let t = seed;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
        const markers = world.targets.filter(function (t) { return t.pos && markerNumber(t) != null; });
        if (!markers.length)
            fail(L('makeCheckpoints needs AR markers: targets with "pos", "q" and a number at the end of the id', 'চেকপয়েন্ট বানাতে AR মার্কার লাগবে: "pos", "q" আর id-র শেষে একটা নম্বরসহ টার্গেট'));
        const goalN = opts.goal == null ? 12 : opts.goal, dRange = opts.distance || [0.45, 0.6], maxAng = opts.angle == null ? 20 : opts.angle;
        const goalM = markers.filter(function (t) { return markerNumber(t) === goalN; })[0] || markers[markers.length - 1];
        const rest = markers.filter(function (t) { return t !== goalM; });
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1)), tmp = rest[i];
            rest[i] = rest[j];
            rest[j] = tmp;
        }
        const count = Math.max(1, Math.min(markers.length, opts.count || 8));
        const picked = rest.slice(0, count - 1).concat([goalM]).sort(function (a, b) { return markerNumber(a) - markerNumber(b); });
        const cps = picked.map(function (t) {
            const n = t.normal, tilt = maxAng * Math.sqrt(rnd()) * Math.PI / 180, spin = rnd() * 2 * Math.PI;
            const axis = qRotate(qFromAxisAngle(n, spin), perpTo(n));
            const dir = qRotate(qFromAxisAngle(axis, tilt), n), d = dRange[0] + rnd() * (dRange[1] - dRange[0]);
            const want = add(t.pos, scale(dir, d)), pos = nearestFree(world, want) || want;
            let q = faceQuat(pos, t.pos), roll = (rnd() * 2 - 1) * Math.PI;
            q = qNorm(qMul(qFromAxisAngle(cameraDir(q), roll), q));
            return {
                id: markerNumber(t), name: 'CP ' + markerNumber(t), pos: roundVec(pos, 4), q: roundVec(q, 6), marker: t.pos.slice(),
                scoreBands: copy(SCORE_BANDS), centeringBands: copy(ANGLE_BANDS), rollBands: copy(ANGLE_BANDS)
            };
        });
        return { checkpoints: cps, goal: markerNumber(goalM) };
    }
    function goToWaypoint(world, id, salt) {
        const cp = findCheckpoint(world, id);
        if (cp && typeof id === 'string' && /^cp/.test(id)) {
            const rc = roughCheckpointPose(world, cp, salt);
            return { name: cp.name, pos: rc.pos, mode: 'custom', q: rc.q };
        }
        const t = findTarget(world, id);
        if (t) {
            const rt = roughTargetPose(world, t, salt);
            return { name: t.name, pos: rt.pos, mode: 'custom', q: rt.q, target: t.id };
        }
        if (id === 'start')
            return { name: world.start.name, pos: world.start.pos.slice(), mode: 'custom', q: world.start.q.slice() };
        const p = findPose(world, id);
        if (p) {
            const rp = roughPose(world, p, salt);
            return { name: p.name, pos: rp.pos, mode: 'custom', q: rp.q };
        }
        return null;
    }
    function appendGoTo(world, route, id) {
        const wp = goToWaypoint(world, id, route.length);
        if (!wp)
            return { ok: false, route: route, message: L('Unknown target "' + id + '"', 'অজানা টার্গেট "' + id + '"') };
        return appendWaypoint(world, route, wp);
    }
    function appendWaypoint(world, route, wp) {
        const r = route.concat([wp]), i = r.length - 1, e = legEnds(world, r, i);
        if (checkSegment(world, e.from, e.to).clear)
            return { ok: true, route: r, routed: false };
        const res = routeAround(world, r, i);
        return res.ok ? { ok: true, route: res.route, routed: true, added: res.added }
            : { ok: false, route: r, routed: false, message: res.message };
    }
    // An example route: a rough pose for every mission goal, auto-routed. It shows the shape of a
    // solution but completes no goal; students fix each pose using the mission feedback.
    function exampleRoute(world) {
        return world.mission.reduce(function (r, id) { return appendGoTo(world, r, id).route; }, []);
    }
    // A worked example for one goal: a pose that solves it, named "Example: ...".
    function exampleWaypoint(world, id) {
        const c = /^cp/.test(id) && findCheckpoint(world, id);
        if (c && c.q)
            return { name: L('Example: ', 'উদাহরণ: ') + c.name, pos: c.pos.slice(), mode: 'custom', q: roundVec(c.q, 4) };
        const t = findTarget(world, id);
        if (t)
            return { name: L('Example: ', 'উদাহরণ: ') + t.name, pos: roundVec(standoffPose(world, t).pos, 3), mode: 'target', target: t.id };
        const p = findPose(world, id);
        if (p)
            return { name: L('Example: ', 'উদাহরণ: ') + p.name, pos: p.pos.slice(), mode: 'custom', q: roundVec(p.q, 4) };
        return null;
    }
    // The guided starting route: a worked example for the first goal, then rough drafts for the next
    // `rough` goals (2 by default). The other goals are left for the student; nothing more is handed over.
    // 4 points by default. Each rough draft is picked so the robot camera can still read its checkpoint's
    // AR marker there (Play shows the reading as a demo), while the judge still rejects the pose.
    function starterRoute(world, opts) {
        let nRough = opts && opts.rough != null ? opts.rough : 3, ids = world.mission, route = [];
        if (!ids.length)
            return route;
        const ex = exampleWaypoint(world, ids[0]);
        if (ex)
            route = appendWaypoint(world, route, ex).route;
        ids.slice(ex ? 1 : 0, (ex ? 1 : 0) + nRough).forEach(function (id) {
            let cp = /^cp/.test(id) && findCheckpoint(world, id), wp = null;
            for (let salt = route.length; cp && !wp && salt < route.length + 24; salt++) {
                const w = goToWaypoint(world, id, salt);
                if (w && readMarkers(world, { pos: w.pos, q: w.q }).seen.some(function (m) { return m.id === cp.id; }))
                    wp = w;
            }
            route = wp ? appendWaypoint(world, route, wp).route : appendGoTo(world, route, id).route;
        });
        return route;
    }

    /* ---------- mission feedback (tells students what is wrong, never where to go) ---------- */
    function dirText(d) {
        const n = ['x', 'y', 'z'];
        for (let k = 0; k < 3; k++) {
            if (Math.abs(d[k]) > 0.985)
                return (d[k] > 0 ? '+' : '-') + n[k] + (k === 2 ? (d[k] > 0 ? L(' (toward the deck)', ' (মেঝের দিকে)') : L(' (overhead)', ' (ছাদের দিকে)')) : '');
        }
        return '(' + d.map(function (v) { return fmt(v, 2); }).join(', ') + ')';
    }
    function rangeText(lo, hi) { return fmt(lo, 2) + L(' to ', ' থেকে ') + fmt(hi, 2); }
    function shrunkBox(b, c) { return { name: b.name, min: b.min.map(function (v) { return v + c; }), max: b.max.map(function (v) { return v - c; }) }; }
    function missionStatus(world, route, analysis) {
        analysis = analysis || analyzeRoute(world, route);
        let s = world.settings, ok = true;
        const reach = analysis.legs.map(function (l) { ok = ok && l.clear; return ok; });
        let lastPose = -1;
        world.mission.forEach(function (id, k) { if (findPose(world, id))
            lastPose = k; });
        const run = world.checkpoints.length ? checkpointRun(world, route, analysis, reach) : null;
        const goals = world.mission.map(function (id, k) {
            const c = /^cp/.test(id) && findCheckpoint(world, id);
            if (c)
                return checkpointGoal(world, c, run);
            let t = findTarget(world, id), g;
            if (t) {
                let done = null, best = null;
                route.forEach(function (w, i) {
                    const ck = captureCheck(world, t, analysis.poses[i]);
                    if (!ck.front)
                        return;
                    if (!done && ck.inRange && ck.aimed && reach[i])
                        done = { i: i, ck: ck };
                    const score = Math.max(0, ck.aim - s.aimTolerance) / Math.max(1, s.aimTolerance) +
                        (ck.inRange ? 0 : Math.min(Math.abs(ck.dist - ck.lo), Math.abs(ck.dist - ck.hi)) / Math.max(0.05, s.rangeTolerance)) +
                        (reach[i] ? 0 : 0.5);
                    if (!best || score < best.score)
                        best = { i: i, ck: ck, score: score };
                });
                g = { id: id, name: t.name, kind: 'target', done: !!done, index: done ? done.i : best ? best.i : -1 };
                if (done) {
                    g.message = L('Waypoint ' + (done.i + 1) + ' captures it: ' + fmt(done.ck.dist, 2) + ' m away, camera ' + Math.round(done.ck.aim) + '° off centre.', 'ওয়েপয়েন্ট ' + (done.i + 1) + ' এটা ধরতে পারে: ' + fmt(done.ck.dist, 2) + ' মি দূর থেকে, ক্যামেরা কেন্দ্র থেকে ' + Math.round(done.ck.aim) + '° সরে।');
                }
                else if (!best || best.ck.aim > 60) {
                    g.message = L('No waypoint looks at it yet. The panel faces ' + dirText(t.normal) + '; stand in front of it and point the camera (+X) at it.', 'এখনো কোনো ওয়েপয়েন্ট এটার দিকে তাকায়নি। প্যানেলটা ' + dirText(t.normal) + ' দিকে মুখ করা; এর সামনে দাঁড়িয়ে ক্যামেরা (+X) এর দিকে তাক করো।');
                }
                else {
                    const ck = best.ck, wp = L('Waypoint ', 'ওয়েপয়েন্ট ') + (best.i + 1), out = [];
                    const range = L(' (aim for ' + rangeText(ck.lo, ck.hi) + ' m).', ' (' + rangeText(ck.lo, ck.hi) + ' মি রাখার চেষ্টা করো)।');
                    if (ck.dist > ck.hi)
                        out.push(wp + L(' is ' + fmt(ck.dist, 2) + ' m away, too far', ' ' + fmt(ck.dist, 2) + ' মি দূরে, বেশি দূরে') + range);
                    else if (ck.dist < ck.lo)
                        out.push(wp + L(' is only ' + fmt(ck.dist, 2) + ' m away, too close', ' মাত্র ' + fmt(ck.dist, 2) + ' মি দূরে, বেশি কাছে') + range);
                    if (!ck.aimed)
                        out.push(L((out.length ? 'Its' : wp + '\'s') + ' camera is ' + Math.round(ck.aim) + '° off centre (allowed ' + fmt(s.aimTolerance, 1) + '°).', (out.length ? 'এর' : wp + '-এর') + ' ক্যামেরা কেন্দ্র থেকে ' + Math.round(ck.aim) + '° সরে আছে (চলবে ' + fmt(s.aimTolerance, 1) + '° পর্যন্ত)।'));
                    if (!reach[best.i])
                        out.push(out.length ? L('Also, a move before it is blocked.', 'তাছাড়া, এর আগের একটা পথ আটকে আছে।') : wp + L(' would work, but a move before it is blocked.', ' দিয়ে হতো, কিন্তু এর আগের একটা পথ আটকে আছে।'));
                    g.message = out.join(' ');
                }
                return g;
            }
            const p = findPose(world, id);
            if (!p)
                return null;
            let mustFinish = k === lastPose, want = cameraDir(p.q), hit = null, near = null;
            route.forEach(function (w, i) {
                if (mustFinish && i !== route.length - 1)
                    return;
                const pose = analysis.poses[i], d = dist(pose.pos, p.pos), turn = qAngleDeg(pose.q, p.q);
                if (!hit && d <= s.poseTolerance + 1e-9 && turn <= s.aimTolerance + 1e-9 && reach[i])
                    hit = { i: i, d: d, turn: turn };
                if (!near || d < near.d)
                    near = { i: i, d: d, turn: turn };
            });
            g = { id: id, name: p.name, kind: 'pose', done: !!hit, index: hit ? hit.i : near ? near.i : -1 };
            const where = L((mustFinish ? 'Finish at ' : 'Visit ') + vecFmt(p.pos) + ', camera facing ' + dirText(want) + '.', vecFmt(p.pos) + (mustFinish ? '-এ গিয়ে শেষ করো' : '-এ যাও') + ', ক্যামেরা ' + dirText(want) + ' দিকে মুখ করে।');
            if (hit)
                g.message = L('Waypoint ' + (hit.i + 1) + ' reaches it (' + Math.round(hit.d * 100) + ' cm, ' + Math.round(hit.turn) + '° off).', 'ওয়েপয়েন্ট ' + (hit.i + 1) + ' সেখানে পৌঁছায় (' + Math.round(hit.d * 100) + ' সেমি, ' + Math.round(hit.turn) + '° সরে)।');
            else if (!near)
                g.message = where;
            else if (near.d > s.poseTolerance)
                g.message = where + ' ' + L((mustFinish ? 'Your last waypoint' : 'The closest waypoint') + ' is ' + fmt(near.d, 2) + ' m from it.', (mustFinish ? 'তোমার শেষ ওয়েপয়েন্ট' : 'সবচেয়ে কাছের ওয়েপয়েন্ট') + ' সেখান থেকে ' + fmt(near.d, 2) + ' মি দূরে।');
            else if (near.turn > s.aimTolerance)
                g.message = L('Waypoint ' + (near.i + 1) + ' is in the right spot. Turn the camera to face ' + dirText(want) + ' (now ' + Math.round(near.turn) + '° off).', 'ওয়েপয়েন্ট ' + (near.i + 1) + ' ঠিক জায়গায় আছে। ক্যামেরা ঘুরিয়ে ' + dirText(want) + ' দিকে মুখ করাও (এখন ' + Math.round(near.turn) + '° সরে আছে)।');
            else
                g.message = L('Waypoint ' + (near.i + 1) + ' is right, but a move before it is blocked.', 'ওয়েপয়েন্ট ' + (near.i + 1) + ' ঠিক আছে, কিন্তু এর আগের একটা পথ আটকে আছে।');
            return g;
        }).filter(Boolean);
        const score = run ? scoreRun(world, goals, run) : null;
        const n = goals.filter(function (g) { return g.done; }).length;
        return {
            goals: goals, done: n, total: goals.length, score: score,
            complete: goals.length > 0 && n === goals.length && analysis.blocked === 0 && (!score || score.inTime)
        };
    }
    // Explain why leg i is blocked, without fixing it.
    function blockHint(world, route, i, analysis) {
        analysis = analysis || analyzeRoute(world, route);
        const leg = analysis.legs[i];
        if (!leg || leg.clear)
            return '';
        const c = world.settings.clearance, from = i === 0 ? world.start.name : L('waypoint ', 'ওয়েপয়েন্ট ') + i, to = L('waypoint ', 'ওয়েপয়েন্ট ') + (i + 1);
        if (leg.why === 'koz') {
            return L('The straight line from ' + from + ' to ' + to + ' cuts through ' + leg.zone + ' (plus ' + Math.round(c * 100) + ' cm clearance). Add a waypoint beside it so the robot goes around it.', from + ' থেকে ' + to + ' পর্যন্ত সোজা রেখাটা ' + leg.zone + '-এর ভেতর দিয়ে যায় (সঙ্গে ' + Math.round(c * 100) + ' সেমি ফাঁক ধরে)। পাশে একটা ওয়েপয়েন্ট বসাও, যাতে রোবট ওটা ঘুরে যায়।');
        }
        const fs = pointStatus(world, leg.from), ts = pointStatus(world, leg.to);
        if (!fs.free)
            return from.charAt(0).toUpperCase() + from.slice(1) + L(' itself is ' + whyText(fs) + '. Fix that point first.', ' নিজেই ' + whyText(fs) + '। আগে ওই পয়েন্টটা ঠিক করো।');
        if (!ts.free)
            return outsideText(world, leg.to, to.charAt(0).toUpperCase() + to.slice(1)) + L(' Move it back inside.', ' এটাকে আবার ভেতরে আনো।');
        const boxes = world.kiz.map(function (b) { return shrunkBox(b, c); });
        let ka = -1, kb = -1;
        boxes.forEach(function (b, k) { if (ka < 0 && inShrunk(leg.from, b, 0))
            ka = k; if (kb < 0 && inShrunk(leg.to, b, 0))
            kb = k; });
        if (ka >= 0 && kb >= 0 && ka !== kb) {
            let A = boxes[ka], B = boxes[kb], lo = [], hi = [], gap = false;
            for (let k = 0; k < 3; k++) {
                lo.push(Math.max(A.min[k], B.min[k]));
                hi.push(Math.min(A.max[k], B.max[k]));
                if (lo[k] > hi[k] + 1e-9)
                    gap = true;
            }
            if (gap)
                return L(A.name + ' and ' + B.name + ' do not overlap enough for the robot to pass with ' + Math.round(c * 100) + ' cm clearance.', A.name + ' আর ' + B.name + ' এতটা জুড়ে নেই যে ' + Math.round(c * 100) + ' সেমি ফাঁক রেখে রোবট পার হতে পারবে।');
            const over = ['x', 'y', 'z'].map(function (n, k) { return n + ' ' + rangeText(lo[k], hi[k]); }).join(', ');
            return L('This move goes from ' + A.name + ' into ' + B.name + ', and the robot can only cross where they overlap: ' + over + '. The straight line misses that overlap. Put a waypoint in it.', 'এই পথ ' + A.name + ' থেকে ' + B.name + '-এ যায়, আর রোবট শুধু দুটো যেখানে জুড়েছে সেখান দিয়েই পার হতে পারে: ' + over + '। সোজা রেখাটা ওই জোড়ের জায়গা দিয়ে যায় না। সেখানে একটা ওয়েপয়েন্ট বসাও।');
        }
        return outsideText(world, leg.hit, L('At the X the line', 'X চিহ্নের জায়গায় রেখাটা')) + L(' Add a waypoint so the path bends around the corner.', ' একটা ওয়েপয়েন্ট বসাও, যাতে পথটা কোণ ঘুরে যায়।');
    }
    // Which limits a point breaks, measured against the nearest Keep-In Zone (minus clearance).
    function outsideText(world, p, subject) {
        let c = world.settings.clearance, best = null, bd = Infinity;
        world.kiz.forEach(function (b) {
            let sb = shrunkBox(b, c), d = 0;
            for (let k = 0; k < 3; k++)
                d += Math.pow(Math.max(0, sb.min[k] - p[k], p[k] - sb.max[k]), 2);
            if (d < bd) {
                bd = d;
                best = sb;
            }
        });
        if (!best)
            return subject + L(' is outside the Keep-In Zones.', ' কিপ-ইন জোনের বাইরে।');
        const parts = [];
        ['x', 'y', 'z'].forEach(function (n, k) {
            if (p[k] < best.min[k] - 1e-9)
                parts.push(L(n + ' is ' + fmt(p[k], 3) + ' but ' + best.name + ' needs at least ' + fmt(best.min[k], 3), n + ' হলো ' + fmt(p[k], 3) + ', কিন্তু ' + best.name + '-এ কমপক্ষে ' + fmt(best.min[k], 3) + ' লাগবে'));
            else if (p[k] > best.max[k] + 1e-9)
                parts.push(L(n + ' is ' + fmt(p[k], 3) + ' but ' + best.name + ' allows at most ' + fmt(best.max[k], 3), n + ' হলো ' + fmt(p[k], 3) + ', কিন্তু ' + best.name + '-এ সর্বোচ্চ ' + fmt(best.max[k], 3) + ' চলে'));
        });
        return subject + L(' leaves the Keep-In Zone: ' + (parts.join('; ') || 'it is too close to the edge') + ' (limits include the ' + Math.round(c * 100) + ' cm clearance).', ' কিপ-ইন জোন থেকে বেরিয়ে যায়: ' + (parts.join('; ') || 'কিনারার খুব কাছে চলে গেছে') + ' (সীমার হিসাবে ' + Math.round(c * 100) + ' সেমি ফাঁক ধরা আছে)।');
    }

    /* ---------- code export ---------- */
    function fill(tpl, vars) {
        // Numbers come back as text (String.replace converts them).
        return tpl.replace(/\{(\w+)\}/g, function (m, k) { return (vars[k] != null ? vars[k] : m); });
    }
    // "cpp" and "python" are the 7th Kibo-RPC languages; "java" is the old name of the `export` slot.
    const LANGS = { cpp: 'export', java: 'export', python: 'exportPython' };
    // Code for the route in `lang` ("python" or "cpp"), from that language's template in the world.
    // After a waypoint meant for a checkpoint, the `pass` template asks the judge about it ({cp}).
    function toCode(world, route, analysis, lang) {
        const a = analysis && analysis.poses.length === route.length ? analysis : analyzeRoute(world, route);
        const ex = world[LANGS[lang] || 'export'], lines = [], passAt = {};
        if (ex.pass && world.checkpoints && world.checkpoints.length) {
            missionStatus(world, route, a).goals.forEach(function (g) {
                if (g.kind === 'checkpoint' && g.notify >= 0)
                    (passAt[g.notify] = passAt[g.notify] || []).push(g.number);
            });
        }
        const base = { world: world.name, start: world.start.name, count: route.length };
        if (ex.header)
            lines.push(fill(ex.header, base));
        if (a.blocked)
            lines.push((ex.prefix || '//') + ' WARNING: ' + a.blocked + ' move' + (a.blocked > 1 ? 's are' : ' is') + ' blocked in the sandbox. Fix ' + (a.blocked > 1 ? 'them' : 'it') + ' first.');
        if (lines.length)
            lines.push('');
        route.forEach(function (w, i) {
            const p = a.poses[i].pos, q = a.poses[i].q;
            const vars = Object.assign({}, base, {
                i: i + 1, name: String(w.name).replace(/[\r\n]+/g, ' '), x: fmt(p[0]), y: fmt(p[1]), z: fmt(p[2]),
                qx: fmt(q[0]), qy: fmt(q[1]), qz: fmt(q[2]), qw: fmt(q[3])
            });
            if (ex.comment)
                lines.push(fill(ex.comment, vars));
            lines.push(fill(ex.line, vars));
            (passAt[i] || []).forEach(function (n) { lines.push(fill(ex.pass, Object.assign({ cp: n }, vars))); });
        });
        if (ex.footer)
            lines.push('', fill(ex.footer, base));
        return lines.join('\n') + '\n';
    }
    // Kept for older pages: the code from the `export` slot (C++ in the default world).
    function toJava(world, route, analysis) { return toCode(world, route, analysis, 'java'); }
    function toCpp(world, route, analysis) { return toCode(world, route, analysis, 'cpp'); }
    function toPython(world, route, analysis) { return toCode(world, route, analysis, 'python'); }

    /* ---------- flying by hand (Drive) ---------- */
    /** Moves in m/s and turns in °/s while held; fine = with Shift / Fine. */
    const STEER = { speed: 0.6, fineSpeed: 0.1, turn: 45, fineTurn: 10 };

    const VERSION = '0.1.0';

    /* =====================================================================
     * Core: pure maths, no DOM. Also loaded by the Node tests.
     * Frame: metres. The 7th Kibo-RPC uses iss_body (origin near Int-Ball2's dock, x along Kibo
     * toward the airlock). +z points toward the deck ("down" in the 3D view).
     * Quaternions are [x, y, z, w]. The camera looks along body +X; body +Z is the robot's top.
     * ===================================================================== */
    const Core = {
        VERSION: VERSION, DEFAULT_WORLD: DEFAULT_WORLD, X_AXIS: X_AXIS,
        copy: copy, add: add, sub: sub, scale: scale, dot: dot, cross: cross, len: len, dist: dist, norm: norm, lerp: lerp,
        round: round, roundVec: roundVec, fmt: fmt, isVec: isVec,
        qNorm: qNorm, qMul: qMul, qFromAxisAngle: qFromAxisAngle, qFromTo: qFromTo, qRotate: qRotate, qSlerp: qSlerp,
        qAngleDeg: qAngleDeg, faceQuat: faceQuat, cameraDir: cameraDir, qFromYawPitch: qFromYawPitch, yawPitchFromQ: yawPitchFromQ, driveStep: driveStep,
        qConj: qConj, angleDeg: angleDeg, topDir: topDir, rollErrorDeg: rollErrorDeg, aimQuat: aimQuat,
        findCheckpoint: findCheckpoint, checkpointCheck: checkpointCheck, makeCheckpoints: makeCheckpoints, LEVELS: LEVELS, levelFor: levelFor, markerNumber: markerNumber,
        ARUCO_4X4: ARUCO_4X4, markerBits: markerBits, markerFrame: markerFrame, markerCorners: markerCorners, cameraFrame: cameraFrame,
        toCamera: toCamera, projectPx: projectPx, readMarkers: readMarkers, markerFromTvec: markerFromTvec,
        starterRoute: starterRoute, exampleWaypoint: exampleWaypoint, appendWaypoint: appendWaypoint,
        normalizeWorld: normalizeWorld, boxCenter: boxCenter, boxSize: boxSize, findTarget: findTarget, findPose: findPose,
        kizBounds: kizBounds, worldBounds: worldBounds, inBox: inBox, pointStatus: pointStatus, isFree: isFree, whyText: whyText,
        checkSegment: checkSegment, oasisLength: oasisLength, planPath: planPath, nearestFree: nearestFree,
        targetCenter: targetCenter, standoffPose: standoffPose, normalizeWaypoint: normalizeWaypoint, normalizeRoute: normalizeRoute,
        resolveRoute: resolveRoute, analyzeRoute: analyzeRoute, routeAround: routeAround, fixRoute: fixRoute,
        goToWaypoint: goToWaypoint, appendGoTo: appendGoTo, exampleRoute: exampleRoute, toJava: toJava, toCpp: toCpp, toPython: toPython, toCode: toCode,
        captureCheck: captureCheck, missionStatus: missionStatus, blockHint: blockHint, dirText: dirText,
        slideStep: slideStep, STEER: STEER,
    };

    // Text formatting for the panel, the log and the HUD.
    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }
    function f2(n) { return Core.fmt(n, 2); }
    function f3(n) { return Core.fmt(n, 3); }
    function vecText(p, d) { return '(' + p.map(function (n) { return Core.fmt(n, d == null ? 3 : d); }).join(', ') + ')'; }
    function listText(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + L(' and ', ' আর ') + a[a.length - 1]; }
    function timeText(s) {
        if (s < 60)
            return Math.round(s) + L(' s', ' সেকেন্ড');
        let m = Math.floor(s / 60), r = Math.round(s - m * 60);
        if (r === 60) {
            m++;
            r = 0;
        }
        return r ? m + L(' min ', ' মিনিট ') + (r < 10 ? '0' : '') + r + L(' s', ' সেকেন্ড') : m + L(' min', ' মিনিট');
    }
    function axisName(d) {
        const names = ['x', 'y', 'z'];
        for (let k = 0; k < 3; k++)
            if (Math.abs(d[k]) > 0.985)
                return (d[k] > 0 ? '+' : '−') + names[k];
        return '(' + d.map(function (n) { return Core.fmt(n, 2); }).join(', ') + ')';
    }

    const AX = ['x', 'y', 'z'];
    // h / v: the world axis drawn to the right / downward; from: the side the view looks from.
    // The default 3D angle (ISS frame, toward the camera): the long side from the EPS2 wall (+y), a little
    // toward the dock end and from overhead, so the dock is on the left, the airlock on the right.
    const VIEW3D_DIR = [-0.3, 1, -0.55];
    function wrapAngle(a) { while (a > Math.PI)
        a -= 2 * Math.PI; while (a < -Math.PI)
        a += 2 * Math.PI; return a; }
    const VIEWS = {
        top: { name: L('Top', 'ওপর'), h: 0, v: 1, d: 2, from: '-z' },
        side: { name: L('Side', 'পাশ'), h: 0, v: 2, d: 1, from: '+y' },
        end: { name: L('End', 'মাথা'), h: 1, v: 2, d: 0, from: '-x' }
    };
    // In Bangla the usual side names read as directions ("Overhead" is the ceiling); the world keeps its own names.
    const SIDE_BN = { 'dock end': 'ডকের দিক', 'airlock end': 'এয়ারলকের দিক', overhead: 'ছাদ', deck: 'মেঝে' };
    function sideName(cfg, key) {
        const n = cfg.sides && cfg.sides[key];
        if (lang() !== 'bn')
            return n || (key + ' side');
        if (!n)
            return key + ' দিক';
        return SIDE_BN[n.toLowerCase()] || n.replace(/ wall$/i, ' দেয়াল').replace(/ end$/i, ' প্রান্ত');
    }
    // "seen from overhead", "seen from the dock end", "seen from the EPS2 wall"
    function viewLook(cfg, def) {
        const n = sideName(cfg, def.from);
        if (lang() === 'bn')
            return n + ' থেকে দেখা';
        if (def.from === '-z' && /^overhead$/i.test(n))
            return 'seen from overhead';
        return 'seen from the ' + (/^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n);
    }

    /* ---------- Camera view: what the robot camera sees and what ArUco reads ---------- */
    class CameraView {
        _resizeCam() {
            const cell = this.$('.cell[data-cell=cam]'), cv = cell.querySelector('canvas'), r = cell.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
            if (r.width < 2 || r.height < 2)
                return;
            cv.width = Math.round(r.width * dpr);
            cv.height = Math.round(r.height * dpr);
            this._cam2d = { w: r.width, h: r.height, dpr: dpr, ctx: cv.getContext('2d') };
            this._drawCam();
        }
        _camWho() {
            if (this._drive)
                return L('the robot (Drive)', 'রোবট (ড্রাইভ)');
            if (this._robotPose)
                return L('the robot (Play)', 'রোবট (চালানোর সময়)');
            if (this._sel >= 0 && this._analysis.poses[this._sel])
                return L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1);
            return L('the robot at the ' + this._config.start.name.toLowerCase(), this._config.start.name + '-এ রোবট');
        }
        _drawCam() {
            const cv = this._cam2d, cfg = this._config;
            if (!cv || (this._ui.view !== 'cam' && this._ui.view !== 'split') || !this._c)
                return;
            const ctx = cv.ctx, c = this._c, cam = cfg.camera, pose = this._robotNow(), rd = Core.readMarkers(cfg, pose);
            this._renderCamInfo(pose, rd);
            const info = this.$('.caminfo'), infoH = info ? info.offsetHeight + 16 : 0;
            ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
            ctx.fillStyle = c['view-bg'];
            ctx.fillRect(0, 0, cv.w, cv.h);
            let top = 28, bottom = cv.h - infoH - 6;
            if (this._drive) { // keep the picture between the HUD and the drive controls
                const cr = this.$('.cell[data-cell=cam]').getBoundingClientRect(), hr = this.$('.hud').getBoundingClientRect(), dr = this.$('.dpad').getBoundingClientRect();
                if (hr.height)
                    top = Math.max(top, hr.bottom - cr.top + 6);
                if (dr.height && !this._short)
                    bottom = Math.min(bottom, dr.top - cr.top - 6);
                // On a narrow screen the picture is as wide as the cell: keep it clear of the Expand button.
                const mb = this.$('.cell[data-cell=cam] .maxbtn');
                if (this._narrow && mb && mb.offsetParent)
                    bottom = Math.min(bottom, mb.getBoundingClientRect().top - cr.top - 4);
            }
            const availH = Math.max(40, bottom - top), k = Math.min((cv.w - 16) / cam.width, availH / cam.height);
            const ox = (cv.w - cam.width * k) / 2, oy = top + (availH - cam.height * k) / 2;
            this._paintCamera(ctx, ox, oy, k, pose, rd, {});
            ctx.font = '600 12px system-ui,"Noto Sans Bengali",sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = c.fg;
            if (!this._drive)
                ctx.fillText(L('Camera · what ' + this._camWho() + ' sees', 'ক্যামেরা · ' + this._camWho() + ' কী দেখছে') + ' (' + cam.width + ' × ' + cam.height + ')', 9, 8); // the HUD sits there while driving
            if (rd.seen.length && (this._drive || this._sel >= 0))
                this._mark('readMarker');
        }
        // The inside of the module as the robot camera sees it: wall, deck and overhead panels in rack-wide bays
        // (alternating tones, farther ones dimmer), ceiling lights, a handrail along each side wall and a hatch at
        // each end. P projects camera coordinates to canvas pixels, W turns world points into camera coordinates;
        // anything behind `near` is cut off. Viewed from inside a box the faces never overlap, so no sorting is needed.
        _paintModule(ctx, P, W, near) {
            const kb = Core.kizBounds(this._config), lo = kb.min, hi = kb.max;
            const RACK = 1.05; // an ISS rack is about 1.05 m wide
            // A point on the face where axis `a` is `w`, at `u` and `v` along the next two axes.
            function at(a, w, u, v) {
                const p = [0, 0, 0];
                p[a] = w;
                p[(a + 1) % 3] = u;
                p[(a + 2) % 3] = v;
                return p;
            }
            // Fill a polygon (world points), cut at the near plane. Returns its mean distance, or -1 if hidden.
            function poly(pts, fill) {
                const pc = [], cam = pts.map(W);
                for (let i = 0; i < cam.length; i++) {
                    const a = cam[i], b = cam[(i + 1) % cam.length], ina = a[2] >= near, inb = b[2] >= near;
                    if (ina)
                        pc.push(a);
                    if (ina !== inb)
                        pc.push(Core.lerp(a, b, (near - a[2]) / (b[2] - a[2])));
                }
                if (pc.length < 3)
                    return -1;
                ctx.fillStyle = fill;
                ctx.beginPath();
                pc.forEach(function (q, i) { const s = P(q); if (i)
                    ctx.lineTo(s[0], s[1]);
                else
                    ctx.moveTo(s[0], s[1]); });
                ctx.closePath();
                ctx.fill();
                return pc.reduce(function (m, q) { return m + q[2]; }, 0) / pc.length;
            }
            // A wall colour, dimmer with distance.
            function shade(rgb, dist, alt) {
                const f = Math.max(0.5, Math.min(1.15, 1.2 - 0.08 * dist)) * (alt ? 0.93 : 1);
                return 'rgb(' + rgb.map(function (c) { return Math.round(c * f); }).join(',') + ')';
            }
            // Base colours: deck (+z) darkest, overhead (-z) lightest, side walls (±y) and the end walls (±x) between.
            const COLOR = { '2,1': [44, 52, 66], '2,0': [86, 98, 116], '1,0': [62, 74, 90], '1,1': [58, 70, 86], '0,0': [52, 62, 78], '0,1': [52, 62, 78] };
            const xs = [];
            for (let x = lo[0]; x < hi[0] - 1e-6; x += RACK)
                xs.push(x);
            for (let a = 0; a < 3; a++)
                for (let s = 0; s < 2; s++) {
                    const w = s ? hi[a] : lo[a], rgb = COLOR[a + ',' + s];
                    if (a === 0) {
                        // An end wall, with a hatch in the middle.
                        const mid = poly([at(0, w, lo[1], lo[2]), at(0, w, hi[1], lo[2]), at(0, w, hi[1], hi[2]), at(0, w, lo[1], hi[2])], 'rgb(' + rgb.join(',') + ')');
                        if (mid < 0)
                            continue;
                        const cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2, r1 = Math.min(hi[1] - lo[1], hi[2] - lo[2]) * 0.32, r2 = r1 * 0.78;
                        poly([at(0, w, cy - r1, cz - r1), at(0, w, cy + r1, cz - r1), at(0, w, cy + r1, cz + r1), at(0, w, cy - r1, cz + r1)], shade([120, 132, 150], mid, false));
                        poly([at(0, w, cy - r2, cz - r2), at(0, w, cy + r2, cz - r2), at(0, w, cy + r2, cz + r2), at(0, w, cy - r2, cz + r2)], shade([30, 36, 46], mid, false));
                        continue;
                    }
                    // Deck, overhead and side walls: one bay per rack along x.
                    xs.forEach(function (x0, n) {
                        const x1 = Math.min(hi[0], x0 + RACK), other = a === 1 ? 2 : 1, oLo = lo[other], oHi = hi[other];
                        const q = function (x, o) { const p = [0, 0, 0]; p[0] = x; p[a] = w; p[other] = o; return p; };
                        const d = poly([q(x0, oLo), q(x1, oLo), q(x1, oHi), q(x0, oHi)], 'rgb(' + rgb.join(',') + ')');
                        if (d < 0)
                            return;
                        poly([q(x0, oLo), q(x1, oLo), q(x1, oHi), q(x0, oHi)], shade(rgb, d, n % 2 === 1));
                        const inset = Math.min(0.12, (x1 - x0) / 6);
                        if (a === 2 && s === 0) {
                            // Ceiling light down the middle of each bay.
                            const c = (oLo + oHi) / 2, hw = Math.min(0.16, (oHi - oLo) / 6);
                            poly([q(x0 + 0.28, c - hw), q(x1 - 0.28, c - hw), q(x1 - 0.28, c + hw), q(x0 + 0.28, c + hw)], 'rgba(255,246,222,' + Math.max(0.35, 0.9 - 0.06 * d).toFixed(2) + ')');
                        }
                        else if (a === 1) {
                            // A rack front: a slightly darker panel with a lighter strip, and a handrail near the deck.
                            const z0 = oLo + (oHi - oLo) * 0.18, z1 = oHi - (oHi - oLo) * 0.2;
                            poly([q(x0 + inset, z0), q(x1 - inset, z0), q(x1 - inset, z1), q(x0 + inset, z1)], shade([rgb[0] - 8, rgb[1] - 8, rgb[2] - 6], d, n % 2 === 0));
                            poly([q(x0 + inset, z0), q(x1 - inset, z0), q(x1 - inset, z0 + 0.04), q(x0 + inset, z0 + 0.04)], 'rgba(170,190,215,0.35)');
                            const rz = oHi - (oHi - oLo) * 0.1;
                            poly([q(x0 + 0.05, rz - 0.012), q(x1 - 0.05, rz - 0.012), q(x1 - 0.05, rz + 0.012), q(x0 + 0.05, rz + 0.012)], 'rgba(222,178,74,' + Math.max(0.35, 0.85 - 0.05 * d).toFixed(2) + ')');
                        }
                        else {
                            // Deck panels.
                            poly([q(x0 + inset, oLo + 0.1), q(x1 - inset, oLo + 0.1), q(x1 - inset, oHi - 0.1), q(x0 + inset, oHi - 0.1)], shade([rgb[0] + 6, rgb[1] + 6, rgb[2] + 8], d, n % 2 === 0));
                        }
                    });
                }
            // A soft vignette, as from a small lens.
            const cam = this._config.camera, tl = P([-cam.cx / cam.fx, -cam.cy / cam.fy, 1]), br = P([(cam.width - cam.cx) / cam.fx, (cam.height - cam.cy) / cam.fy, 1]);
            const cx = (tl[0] + br[0]) / 2, cy = (tl[1] + br[1]) / 2, rad = Math.hypot(br[0] - tl[0], br[1] - tl[1]) / 2;
            const g = ctx.createRadialGradient(cx, cy, rad * 0.45, cx, cy, rad);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.38)');
            ctx.fillStyle = g;
            ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
        }
        // Paint the camera picture with its top-left at (ox, oy), k canvas px per image px. opts.clean draws
        // only the markers on grey (for checking the drawing with a real ArUco detector).
        _paintCamera(ctx, ox, oy, k, pose, rd, opts) {
            const cfg = this._config, cam = cfg.camera, cf = Core.cameraFrame(cfg, pose), c = this._c || {}, near = 0.03;
            function P(pc) { const p = Core.projectPx(cam, pc); return [ox + p[0] * k, oy + p[1] * k]; }
            function W(p) { return Core.toCamera(cf, p); }
            ctx.save();
            ctx.fillStyle = opts.clean ? '#8c8c8c' : '#3a404c';
            ctx.fillRect(ox, oy, cam.width * k, cam.height * k);
            ctx.beginPath();
            ctx.rect(ox, oy, cam.width * k, cam.height * k);
            ctx.clip();
            // A 3D line, clipped at the near plane.
            function line(a, b) {
                let pa = W(a), pb = W(b);
                if (pa[2] < near && pb[2] < near)
                    return;
                if (pa[2] < near)
                    pa = Core.lerp(pa, pb, (near - pa[2]) / (pb[2] - pa[2]));
                else if (pb[2] < near)
                    pb = Core.lerp(pb, pa, (near - pb[2]) / (pa[2] - pb[2]));
                const s0 = P(pa), s1 = P(pb);
                ctx.beginPath();
                ctx.moveTo(s0[0], s0[1]);
                ctx.lineTo(s1[0], s1[1]);
                ctx.stroke();
            }
            if (!opts.clean) {
                this._paintModule(ctx, P, W, near);
                // The module's walls (keep-in box edges) for a sense of where the camera looks.
                const kb = Core.kizBounds(cfg), B = [kb.min, kb.max];
                const v = function (i) { return [B[i & 1][0], B[(i >> 1) & 1][1], B[(i >> 2) & 1][2]]; };
                ctx.strokeStyle = 'rgba(200,210,230,0.35)';
                ctx.lineWidth = 1.2;
                [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) { line(v(e[0]), v(e[1])); });
            }
            if (!opts.clean) {
                // Checkpoints: a small dot where the camera sees each one.
                cfg.checkpoints.forEach(function (cp) {
                    const pc = W(cp.pos);
                    if (pc[2] < 0.1)
                        return;
                    const s = P(pc), r = opts.small ? 2.5 : 4;
                    ctx.fillStyle = c.cp || '#b4359c';
                    ctx.beginPath();
                    ctx.arc(s[0], s[1], r, 0, Math.PI * 2);
                    ctx.fill();
                    if (opts.small)
                        return;
                    ctx.font = '600 11px system-ui,"Noto Sans Bengali",sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(cp.name, s[0], s[1] - r - 2);
                });
            }
            // The AR markers: a one-cell white margin, the black border, then the 4 x 4 bits (1 = white).
            cfg.targets.forEach(function (t) {
                const bits = Core.markerBits(t);
                if (!bits)
                    return;
                const f = Core.markerFrame(t), h = t.size / 2, cell = t.size / 6;
                const back = Core.dot(t.normal, Core.sub(cf.pos, t.pos)) <= 0;
                function quad(x0, y0, x1, y1, color) {
                    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (m) { return W(Core.add(t.pos, Core.add(Core.scale(f.x, m[0]), Core.scale(f.y, m[1])))); });
                    if (pts.some(function (q) { return q[2] < near; }))
                        return;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    pts.forEach(function (q, i) { const s = P(q); if (i)
                        ctx.lineTo(s[0], s[1]);
                    else
                        ctx.moveTo(s[0], s[1]); });
                    ctx.closePath();
                    ctx.fill();
                }
                if (back) {
                    quad(-h - cell, -h - cell, h + cell, h + cell, '#8a909c');
                    return;
                }
                quad(-h - cell, -h - cell, h + cell, h + cell, '#ffffff');
                quad(-h, -h, h, h, '#000000');
                for (let r = 0; r < 4; r++)
                    for (let col = 0; col < 4; col++) {
                        if (bits.charAt(r * 4 + col) !== '1')
                            continue;
                        const x0 = -h + (col + 1) * cell, y1 = h - (r + 1) * cell;
                        quad(x0, y1 - cell, x0 + cell, y1, '#ffffff');
                    }
            });
            if (!opts.clean) {
                // Image centre and the centring margins (10 / 20 / 30 degrees off the optical axis).
                const cx = ox + cam.cx * k, cy = oy + cam.cy * k, bands = cfg.checkpoints.length && cfg.checkpoints[0].centeringBands.length ? cfg.checkpoints[0].centeringBands : [];
                ctx.strokeStyle = 'rgba(255,255,255,0.75)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx - 10, cy);
                ctx.lineTo(cx + 10, cy);
                ctx.moveTo(cx, cy - 10);
                ctx.lineTo(cx, cy + 10);
                ctx.stroke();
                bands.forEach(function (b) {
                    const r = cam.fx * k * Math.tan(b.angle * Math.PI / 180);
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.setLineDash([3, 4]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    if (opts.small)
                        return;
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.font = '10.5px system-ui,"Noto Sans Bengali",sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(Core.fmt(b.angle, 0) + '° (Lv' + b.level + ')', cx + r * 0.71 + 3, cy - r * 0.71 - 1);
                });
                // What the detector reads: outline, first corner (top-left) in red, ID, and the marker axes.
                rd.seen.forEach(function (m) {
                    const t = Core.findTarget(cfg, m.target), f = Core.markerFrame(t), axLen = t.size * 1.2;
                    const pts = m.corners.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
                    ctx.strokeStyle = '#2bd65a';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    pts.forEach(function (p, i) { if (i)
                        ctx.lineTo(p[0], p[1]);
                    else
                        ctx.moveTo(p[0], p[1]); });
                    ctx.closePath();
                    ctx.stroke();
                    ctx.fillStyle = '#ff3b3b';
                    ctx.fillRect(pts[0][0] - 3, pts[0][1] - 3, 6, 6);
                    [[f.x, '#ff3b3b'], [f.y, '#2bd65a'], [f.z, '#4f7bff']].forEach(function (a) { ctx.strokeStyle = a[1]; ctx.lineWidth = 2; line(t.pos, Core.add(t.pos, Core.scale(a[0], axLen))); });
                    ctx.font = '700 12px system-ui,"Noto Sans Bengali",sans-serif';
                    ctx.fillStyle = '#2bd65a';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText('id=' + m.id, Math.max.apply(null, pts.map(function (p) { return p[0]; })) + 4, Math.min.apply(null, pts.map(function (p) { return p[1]; })));
                });
                rd.missed.forEach(function (m) {
                    const pts = m.corners.map(function (p) { return [ox + p[0] * k, oy + p[1] * k]; });
                    ctx.strokeStyle = '#ffb02e';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 3]);
                    ctx.beginPath();
                    pts.forEach(function (p, i) { if (i)
                        ctx.lineTo(p[0], p[1]);
                    else
                        ctx.moveTo(p[0], p[1]); });
                    ctx.closePath();
                    ctx.stroke();
                    ctx.setLineDash([]);
                });
            }
            ctx.restore();
        }
        _renderCamInfo(pose, rd) {
            const el = this.$('.caminfo'), cfg = this._config, cam = cfg.camera;
            if (!el)
                return;
            const v3 = function (a, d) { return '[' + a.map(function (n) { return Core.fmt(n, d); }).join(', ') + ']'; };
            let html = '<div class="ch"><b>' + L('Read: ' + (rd.seen.length ? rd.seen.length + ' marker' + (rd.seen.length > 1 ? 's' : '') : 'no marker'), rd.seen.length ? 'পড়া গেছে: ' + rd.seen.length + 'টা মার্কার' : 'কোনো মার্কার পড়া যায়নি') + '</b>' +
                '<button class="btn small" data-act="copyread"' + (rd.seen.length ? '' : ' disabled') + '>' + L('Copy reading', 'রিডিং কপি করো') + '</button></div>';
            rd.seen.forEach(function (m) {
                const est = Core.markerFromTvec(cfg, pose, m.tvec).world, t = Core.findTarget(cfg, m.target), err = Core.dist(est, t.pos);
                const turned = Math.round(Math.abs(m.imageRoll)) + '°', still = Math.abs(m.imageRoll) < 0.5;
                html += '<div class="m"><b class="ok">ID ' + m.id + '</b> ' + esc(m.name) + ' · ' + f2(m.distance) + L(' m · ', ' মি · কেন্দ্র থেকে ') + Math.round(m.offCentre) + L('° off centre · looks turned ' + turned + ' ' + (still ? '' : m.imageRoll > 0 ? 'clockwise' : 'anticlockwise') + ' in the picture', '° সরে · ছবিতে ' + (still ? '' : m.imageRoll > 0 ? 'ঘড়ির কাঁটার দিকে ' : 'ঘড়ির কাঁটার উল্টো দিকে ') + turned + ' ঘোরানো দেখায়') + '<br>' +
                    '<code>tvec ' + v3(m.tvec, 3) + ' m · rvec ' + v3(m.rvec, 3) + '</code><br>' +
                    '<code>→ marker at ' + v3(est, 3) + ' in iss_body</code> <span class="' + (err < 0.005 ? 'ok">' + L('matches its known position ✓', 'জানা অবস্থানের সঙ্গে মিলে গেছে ✓') : 'bad">' + L(f2(err) + ' m from its known position', 'জানা অবস্থান থেকে ' + f2(err) + ' মি দূরে')) + '</span></div>';
            });
            rd.missed.forEach(function (m) { html += '<div class="m"><span class="bad">' + esc(m.name.split(' ')[0]) + L(' not read:', ' পড়া যায়নি:') + '</span> ' + esc(m.why) + L('.', '।') + '</div>'; });
            if (!rd.seen.length && !rd.missed.length)
                html += '<div class="m">' + L('No marker in the picture. Turn the camera toward one (blue squares in the other views).', 'ছবিতে কোনো মার্কার নেই। ক্যামেরা কোনো একটার দিকে ঘোরাও (অন্য ভিউগুলোতে নীল চৌকো ঘরগুলো)।') + '</div>';
            const lens = cam.width + ' × ' + cam.height + ', fx ' + Core.fmt(cam.fx, 1) + ', fy ' + Core.fmt(cam.fy, 1), ahead = Core.fmt(cam.offset[0], 2);
            html += '<p class="note">' + L('Pinhole camera ' + lens + ', camera ' + ahead + ' m in front of the centre. The intrinsics are assumed: on the robot, use <code>/camera_main/camera_info</code>.', 'পিনহোল ক্যামেরা ' + lens + ', ক্যামেরাটা কেন্দ্র থেকে ' + ahead + ' মি সামনে। ইন্ট্রিনসিকগুলো এখানে ধরে নেওয়া মান: আসল রোবটে <code>/camera_main/camera_info</code> থেকে নিও।') + '</p>';
            if (html === this._camInfoKey)
                return; // nothing changed (Drive redraws every frame)
            this._camInfoKey = html;
            el.innerHTML = html;
        }
        // The reading in OpenCV's shape, for copying.
        _readingJson() {
            const pose = this._robotNow(), rd = Core.readMarkers(this._config, pose), r = function (a, d) { return a.map(function (n) { return Core.round(n, d); }); };
            return {
                robot: { position: r(pose.pos, 4), orientation: r(pose.q, 4) },
                ids: rd.seen.map(function (m) { return m.id; }),
                corners: rd.seen.map(function (m) { return m.corners.map(function (p) { return r(p, 1); }); }),
                rvecs: rd.seen.map(function (m) { return r(m.rvec, 4); }),
                tvecs: rd.seen.map(function (m) { return r(m.tvec, 4); })
            };
        }
        _drawView(v) {
            if (!v.w || !this._c)
                return;
            const ctx = v.ctx, c = this._c, cfg = this._config, d = v.def, self = this, a = this._analysis;
            const S = function (p) { return self._toS(v, p); };
            ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
            ctx.fillStyle = c['view-bg'];
            ctx.fillRect(0, 0, v.w, v.h);
            // grid every 0.5 m (and 0.1 m when zoomed in)
            const w0 = this._toW(v, 0, 0), w1 = this._toW(v, v.w, v.h);
            ctx.font = '10.5px system-ui,"Noto Sans Bengali",sans-serif';
            [[0.1, 0.35], [0.5, 1]].forEach(function (g) {
                if (g[0] === 0.1 && v.s < 350)
                    return;
                ctx.strokeStyle = c.grid;
                ctx.globalAlpha = g[1];
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let x = Math.ceil(w0[0] / g[0]) * g[0]; x <= w1[0]; x += g[0]) {
                    const sx = Math.round(v.w / 2 + (x - v.cx) * v.s) + 0.5;
                    ctx.moveTo(sx, 0);
                    ctx.lineTo(sx, v.h);
                }
                for (let y = Math.ceil(w0[1] / g[0]) * g[0]; y <= w1[1]; y += g[0]) {
                    const sy = Math.round(v.h / 2 + (y - v.cy) * v.s) + 0.5;
                    ctx.moveTo(0, sy);
                    ctx.lineTo(v.w, sy);
                }
                ctx.stroke();
            });
            ctx.globalAlpha = 1;
            ctx.fillStyle = c.muted;
            ctx.textBaseline = 'bottom';
            ctx.textAlign = 'center';
            const stepL = v.s < 60 ? 1 : 0.5;
            for (let gx = Math.ceil(w0[0] / stepL) * stepL; gx <= w1[0]; gx += stepL)
                ctx.fillText(Core.fmt(gx, 1), v.w / 2 + (gx - v.cx) * v.s, v.h - 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let gy = Math.ceil(w0[1] / stepL) * stepL; gy <= w1[1]; gy += stepL)
                ctx.fillText(Core.fmt(gy, 1), 3, v.h / 2 + (gy - v.cy) * v.s);
            function rect(b, pad) {
                const p0 = S(b.min), p1 = S(b.max);
                const x = Math.min(p0[0], p1[0]) - pad * v.s, y = Math.min(p0[1], p1[1]) - pad * v.s;
                const w = Math.abs(p1[0] - p0[0]) + 2 * pad * v.s, h = Math.abs(p1[1] - p0[1]) + 2 * pad * v.s;
                return [x, y, w, h];
            }
            function box(b, color, fillA, lw, dash, pad) {
                const r = rect(b, pad || 0);
                if (r[2] <= 0 || r[3] <= 0)
                    return r;
                if (r[2] < 3) {
                    r[0] -= (3 - r[2]) / 2;
                    r[2] = 3;
                }
                if (r[3] < 3) {
                    r[1] -= (3 - r[3]) / 2;
                    r[3] = 3;
                }
                if (fillA) {
                    ctx.globalAlpha = fillA;
                    ctx.fillStyle = color;
                    ctx.fillRect(r[0], r[1], r[2], r[3]);
                    ctx.globalAlpha = 1;
                }
                if (lw) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = lw;
                    ctx.setLineDash(dash || []);
                    ctx.strokeRect(r[0] + 0.5, r[1] + 0.5, r[2], r[3]);
                    ctx.setLineDash([]);
                }
                return r;
            }
            function label(text, x, y, color, align) {
                ctx.font = '600 11px system-ui,"Noto Sans Bengali",sans-serif';
                ctx.fillStyle = color;
                ctx.textAlign = align || 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(text, x, y);
            }
            const cl = cfg.settings.clearance;
            cfg.kiz.forEach(function (b) {
                const r = box(b, c.kiz, 0.07, 1.5);
                box(b, c.kiz, 0, 1, [4, 4], -cl);
                if (cfg.kiz.length > 1)
                    label(b.name, r[0] + 4, r[1] + 3, c.kiz);
            });
            // Plain names for the sides of the module, just outside the keep-in box.
            const kb = Core.kizBounds(cfg), k0 = S(kb.min), k1 = S(kb.max);
            ctx.font = '600 11.5px system-ui,"Noto Sans Bengali",sans-serif';
            ctx.fillStyle = c.muted;
            ctx.globalAlpha = 0.9;
            const midX = (k0[0] + k1[0]) / 2, midY = (k0[1] + k1[1]) / 2, clampX = function (x) { return Math.max(46, Math.min(v.w - 46, x)); }, clampY = function (y) { return Math.max(30, Math.min(v.h - 22, y)); };
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('↑ ' + sideName(cfg, '-' + AX[d.v]), clampX(midX), clampY(k0[1] - 18)); // clear of marker labels on the wall
            ctx.textBaseline = 'top';
            ctx.fillText('↓ ' + sideName(cfg, '+' + AX[d.v]), clampX(midX), clampY(k1[1] + 16));
            ctx.save();
            ctx.translate(Math.max(14, k0[0] - 16), clampY(midY));
            ctx.rotate(-Math.PI / 2);
            ctx.textBaseline = 'bottom';
            ctx.fillText('← ' + sideName(cfg, '-' + AX[d.h]), 0, 0);
            ctx.restore();
            ctx.save();
            ctx.translate(Math.min(v.w - 14, k1[0] + 16), clampY(midY));
            ctx.rotate(Math.PI / 2);
            ctx.textBaseline = 'bottom';
            ctx.fillText(sideName(cfg, '+' + AX[d.h]) + ' →', 0, 0);
            ctx.restore();
            ctx.globalAlpha = 1;
            cfg.oasis.forEach(function (b) { box(b, c.oasis, 0.14, 1, [2, 3]); });
            cfg.koz.forEach(function (b) {
                const r = box(b, c.koz, 0.28, 1.5);
                box(b, c.koz, 0, 1, [4, 3], cl);
                label(b.name, r[0] + 3, r[1] + 3, c.koz);
            });
            const captured = {};
            this._mission.goals.forEach(function (g) { if (g.done)
                captured[g.id] = 1; });
            cfg.targets.forEach(function (t) {
                const col = captured[t.id] ? c.ok : c.target, cc = S(Core.targetCenter(t)), text = self._targetLabel(t);
                if (t.pos) { // an AR marker: a small square on its wall
                    ctx.fillStyle = col;
                    ctx.fillRect(cc[0] - 3.5, cc[1] - 3.5, 7, 7);
                    if (text)
                        label(text + (captured[t.id] ? ' ✓' : ''), cc[0] + 6, cc[1] - 13, col);
                    return;
                }
                const r = box(t, col, 0.55, 2), horiz = r[2] >= r[3];
                label(text + (captured[t.id] ? ' ✓' : ''), horiz ? cc[0] : r[0] + r[2] + 4, horiz ? r[1] + r[3] + 3 : cc[1] - 6, col, horiz ? 'center' : 'left');
            });
            // checkpoints: a solid dot (green once passed) and a dashed line of sight to the marker
            cfg.checkpoints.forEach(function (cp) {
                const s0 = S(cp.pos), ok = captured[cp.key], col = ok ? c.ok : c.cp;
                ctx.strokeStyle = col;
                ctx.lineWidth = 1.2;
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(s0[0], s0[1], 4.5, 0, Math.PI * 2);
                ctx.fill();
                if (cp.marker) {
                    const m0 = S(cp.marker);
                    ctx.globalAlpha = 0.6;
                    ctx.setLineDash([2, 3]);
                    ctx.beginPath();
                    ctx.moveTo(s0[0], s0[1]);
                    ctx.lineTo(m0[0], m0[1]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;
                }
                label(cp.name + (cp.id === cfg.goal ? L(' (goal)', ' (গোল)') : '') + (ok ? ' ✓' : ''), s0[0] + 6, s0[1] + 4, col);
            });
            // start and preset poses
            const sp = S(cfg.start.pos);
            ctx.fillStyle = c.robot;
            ctx.fillRect(sp[0] - 5, sp[1] - 5, 10, 10);
            label(cfg.start.name, sp[0] + 8, sp[1] - 6, c.muted);
            cfg.poses.forEach(function (p) {
                const s = S(p.pos);
                ctx.save();
                ctx.translate(s[0], s[1]);
                ctx.rotate(Math.PI / 4);
                ctx.strokeStyle = c.sel;
                ctx.lineWidth = 2;
                ctx.strokeRect(-5, -5, 10, 10);
                ctx.restore();
                self._arrow2d(v, p.pos, Core.cameraDir(p.q), 20, c.sel, 1.5);
                label(p.name, s[0] + 9, s[1] + 4, c.sel);
            });
            // moves
            a.legs.forEach(function (l) {
                const p0 = S(l.from), p1 = S(l.to);
                ctx.strokeStyle = l.clear ? c.route : c.bad;
                ctx.lineWidth = l.clear ? 2.5 : 3;
                ctx.setLineDash(l.clear ? [] : [7, 4]);
                ctx.beginPath();
                ctx.moveTo(p0[0], p0[1]);
                ctx.lineTo(p1[0], p1[1]);
                ctx.stroke();
                ctx.setLineDash([]);
                if (!l.clear) {
                    const h = S(l.hit);
                    ctx.strokeStyle = c.bad;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(h[0], h[1], 7, 0, Math.PI * 2);
                    ctx.moveTo(h[0] - 4, h[1] - 4);
                    ctx.lineTo(h[0] + 4, h[1] + 4);
                    ctx.moveTo(h[0] + 4, h[1] - 4);
                    ctx.lineTo(h[0] - 4, h[1] + 4);
                    ctx.stroke();
                }
            });
            // line from the selected waypoint to the target it faces
            let sw = this._route[this._sel], tt;
            if (sw && sw.mode === 'target' && (tt = Core.findTarget(cfg, sw.target))) {
                const a0 = S(sw.pos), a1 = S(Core.targetCenter(tt));
                ctx.strokeStyle = c.cam;
                ctx.lineWidth = 1.2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(a0[0], a0[1]);
                ctx.lineTo(a1[0], a1[1]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // waypoints
            this._route.forEach(function (w, i) {
                const s = S(w.pos), sel = i === self._sel, r = w.via ? 5 : 9;
                const pose = a.poses[i];
                if (!w.via || sel)
                    self._arrow2d(v, w.pos, Core.cameraDir(pose.q), sel ? 30 : 20, sel ? c.sel : c.wp, sel ? 2 : 1.5);
                ctx.beginPath();
                ctx.arc(s[0], s[1], r + (sel ? 1 : 0), 0, Math.PI * 2);
                ctx.fillStyle = sel ? c.sel : (w.via ? c.robot : c.wp);
                ctx.fill();
                if (!a.legs[i].endStatus.free) {
                    ctx.strokeStyle = c.bad;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }
                if (sel) {
                    ctx.beginPath();
                    ctx.arc(s[0], s[1], r + 5, 0, Math.PI * 2);
                    ctx.strokeStyle = c.sel;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                if (!w.via) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '700 10.5px system-ui,"Noto Sans Bengali",sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(i + 1), s[0], s[1] + 0.5);
                }
            });
            // while driving: the straight move a new waypoint here would make
            if (this._drive) {
                const dfrom = this._driveFrom(), dok = Core.checkSegment(cfg, dfrom.pos, this._drive.pos).clear, q0 = S(dfrom.pos), q1 = S(this._drive.pos);
                ctx.strokeStyle = dok ? c.route : c.bad;
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(q0[0], q0[1]);
                ctx.lineTo(q1[0], q1[1]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // robot
            const rp = this._robotNow(), rs = S(rp.pos), half = cfg.robot.size / 2 * v.s;
            ctx.strokeStyle = c.robot;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 2]);
            if (cfg.robot.shape === 'sphere') {
                ctx.beginPath();
                ctx.arc(rs[0], rs[1], half, 0, Math.PI * 2);
                ctx.stroke();
            }
            else
                ctx.strokeRect(rs[0] - half, rs[1] - half, half * 2, half * 2);
            ctx.setLineDash([]);
            this._arrow2d(v, rp.pos, Core.cameraDir(rp.q), Math.max(26, half * 1.6), c.cam, 2.5);
            // caption and pointer readout
            const cap = d.name + ' · ' + viewLook(cfg, d);
            ctx.font = '600 12px system-ui,"Noto Sans Bengali",sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const tw = ctx.measureText(cap).width;
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = c['view-bg'];
            ctx.fillRect(4, 4, tw + 10, 18);
            ctx.globalAlpha = 1;
            ctx.fillStyle = c.fg;
            ctx.fillText(cap, 9, 7);
            // Axis gizmo (bottom right): which way the coordinates grow in this view.
            const gx = v.w - 54, gy = v.h - 58, gl = 26;
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = c['view-bg'];
            ctx.fillRect(gx - 8, gy - 8, 52, 50);
            ctx.globalAlpha = 1;
            [[1, 0, AX[d.h], ['#e5484d', '#30a46c', '#3e63dd'][d.h]], [0, 1, AX[d.v], ['#e5484d', '#30a46c', '#3e63dd'][d.v]]].forEach(function (a) {
                const ex = gx + a[0] * gl, ey = gy + a[1] * gl;
                ctx.strokeStyle = a[3];
                ctx.fillStyle = a[3];
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(gx, gy);
                ctx.lineTo(ex, ey);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ex + a[0] * 5, ey + a[1] * 5);
                ctx.lineTo(ex - a[1] * 4, ey - a[0] * 4);
                ctx.lineTo(ex + a[1] * 4, ey + a[0] * 4);
                ctx.closePath();
                ctx.fill();
                ctx.font = '700 11px system-ui,"Noto Sans Bengali",sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('+' + a[2], a[0] ? ex - 6 : ex + 6, a[0] ? ey + 11 : ey);
            });
            if (v.hover) {
                let hw = this._toW(v, v.hover[0], v.hover[1]), ref = this._depthRef(), p = ref.pos.slice();
                const dragging = v.drag && v.drag.moved;
                if (dragging)
                    p = this._route[v.drag.i].pos.slice();
                else {
                    p[d.h] = hw[0];
                    p[d.v] = hw[1];
                }
                const st = Core.pointStatus(cfg, p);
                const txt = dragging
                    ? L('waypoint ', 'ওয়েপয়েন্ট ') + (v.drag.i + 1) + ' ' + vecText(p, 3) + ' · ' + (st.free ? L('allowed', 'যাওয়া যায়') : Core.whyText(st))
                    : vecText(p, 2) + ' · ' + (st.free ? L('allowed', 'যাওয়া যায়') : L('not allowed', 'যাওয়া যায় না')) + L(' (' + AX[d.d] + ' from ' + ref.label + ')', ' (' + AX[d.d] + ' নেওয়া ' + ref.label + ' থেকে)');
                ctx.font = '12px ui-monospace,Menlo,Consolas,"Noto Sans Bengali",monospace';
                const w2 = ctx.measureText(txt).width;
                const bx = Math.min(v.w - w2 - 14, Math.max(4, v.hover[0] + 14)), by = Math.min(v.h - 40, v.hover[1] + 18);
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = c.panel;
                ctx.fillRect(bx, by, w2 + 10, 19);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = st.free ? c.border : c.bad;
                ctx.lineWidth = 1;
                ctx.strokeRect(bx + 0.5, by + 0.5, w2 + 9, 18);
                ctx.fillStyle = st.free ? c.fg : c.bad;
                ctx.textBaseline = 'middle';
                ctx.fillText(txt, bx + 5, by + 10);
            }
        }
        _arrow2d(v, pos, dir, lenPx, color, lw) {
            const d = v.def, ctx = v.ctx, s = this._toS(v, pos);
            const dx = dir[d.h], dy = dir[d.v], m = Math.hypot(dx, dy);
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = lw;
            if (m < 0.15) {
                // pointing into or out of the screen
                ctx.beginPath();
                ctx.arc(s[0], s[1], 4, 0, Math.PI * 2);
                ctx.stroke();
                if (dir[d.d] > 0) {
                    ctx.beginPath();
                    ctx.moveTo(s[0] - 3, s[1] - 3);
                    ctx.lineTo(s[0] + 3, s[1] + 3);
                    ctx.moveTo(s[0] + 3, s[1] - 3);
                    ctx.lineTo(s[0] - 3, s[1] + 3);
                    ctx.stroke();
                }
                else {
                    ctx.beginPath();
                    ctx.arc(s[0], s[1], 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                return;
            }
            const len = lenPx * m, ux = dx / m, uy = dy / m, ex = s[0] + ux * len, ey = s[1] + uy * len;
            ctx.beginPath();
            ctx.moveTo(s[0], s[1]);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - ux * 7 - uy * 4, ey - uy * 7 + ux * 4);
            ctx.lineTo(ex - ux * 7 + uy * 4, ey - uy * 7 - ux * 4);
            ctx.closePath();
            ctx.fill();
        }
    }

    // An on-screen joystick (Drive's sticks): `j` is the stick (a circle with a .knob),
    // `zone` an optional bigger touch area around it. `set([x, y])` gets the stick's position, each -1..1 (right and
    // down are +), [0, 0] when let go; `down()` runs when a thumb lands on it.
    function setupStick(j, zone, set, down) {
        let knob = j.querySelector('.knob'), id = null, org = [0, 0, 1];
        // Measured from the circle's centre, or from where the thumb landed when it landed in the halo
        // around the circle (so a touch there starts still instead of at full speed).
        // Measured on the screen from where the stick started (`org`: x, y, radius), not from where the stick is
        // now, so the page scrolling under a held thumb does not move the robot.
        function place(e) {
            const R = org[2];
            let x = (e.clientX - org[0]) / R, y = (e.clientY - org[1]) / R, m = Math.hypot(x, y);
            if (m > 1) {
                x /= m;
                y /= m;
                m = 1;
            }
            knob.style.transform = 'translate(' + (x * R * 0.6) + 'px,' + (y * R * 0.6) + 'px)';
            set(m < 0.12 ? [0, 0] : [x, y]);
        }
        function end(e) {
            if (e.pointerId !== id)
                return;
            id = null;
            knob.style.transform = '';
            set([0, 0]);
        }
        function start(e, el) {
            if (id !== null)
                return; // one thumb per stick
            id = e.pointerId;
            try {
                el.setPointerCapture(id);
            }
            catch (err) { /* ignore */ }
            const r = j.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - r.left - R, dy = e.clientY - r.top - R;
            // From the circle's centre, or from where the thumb landed when it landed in the halo around it.
            org = Math.hypot(dx, dy) > R ? [e.clientX, e.clientY, R] : [r.left + R, r.top + R, R];
            place(e);
            e.preventDefault();
            if (down)
                down();
        }
        function move(e) { if (e.pointerId === id)
            place(e); }
        // The stick itself, and the touch zone around it.
        [j, zone].forEach(function (el) {
            if (!el)
                return;
            el.addEventListener('pointerdown', function (e) { start(e, el); });
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerup', end);
            el.addEventListener('pointercancel', end);
        });
    }
    // Whether the main input is a touch screen on a phone or tablet, so the page should show sticks. Phones and
    // tablets are known by their browser, since some also report a fine pointer (a stylus, mouse support); any
    // other touch screen counts only without a mouse or touchpad (a touch-screen laptop gets the keys).
    function touchFirst() {
        const mm = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
        const points = navigator.maxTouchPoints || 0, ua = navigator.userAgent || '';
        if (!mm('(pointer:coarse)') && !mm('(any-pointer:coarse)') && !points)
            return false;
        const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && points > 1); // iPadOS says Macintosh
        return mobile || (mm('(pointer:coarse)') && !mm('(any-pointer:fine)'));
    }

    /* ---------- drive mode: fly the robot by hand, drop waypoints ---------- */
    class Drive {
        _setupDriveInputs() {
            const self = this, vp = this.$('.viewport');
            vp.addEventListener('pointerdown', function (e) {
                if (!e.target.closest('button,input,select')) {
                    try {
                        vp.focus({ preventScroll: true });
                    }
                    catch (err) {
                        vp.focus();
                    }
                }
            });
            vp.addEventListener('focusout', function (e) { if (self._drive && !vp.contains(e.relatedTarget))
                self._drive.keys = {}; });
            // Each stick, with a big touch zone around its corner of the view (touch screens only). A thumb landing on
            // one brings the views to the middle of the window (see _centerGameView).
            this.$$('.joy').forEach(function (j) {
                const name = j.getAttribute('data-joy');
                setupStick(j, self.$('.jzone[data-zone="' + name + '"]'), function (v) { if (self._drive)
                    self._drive.joy[name] = v; }, function () { self._centerGameView(); });
            });
            this.$$('[data-hold]').forEach(function (b) {
                const name = b.getAttribute('data-hold');
                function on(v) { return function (e) { if (self._drive)
                    self._drive.hold[name] = v; if (v)
                    e.preventDefault(); }; }
                b.addEventListener('pointerdown', on(true));
                ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, on(false)); });
                b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
            });
            // On-screen keys: hold with the mouse (or a pen) like the real key.
            this.$$('.kpad [data-key]').forEach(function (b) {
                const code = b.getAttribute('data-key');
                b.addEventListener('pointerdown', function (e) {
                    if (!self._drive)
                        return;
                    e.preventDefault();
                    try {
                        b.setPointerCapture(e.pointerId);
                    }
                    catch (err) { /* ignore */ }
                    self._drive.keys[code] = true;
                    self._driveKeysUi();
                });
                ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
                    b.addEventListener(ev, function () { if (self._drive && self._drive.keys[code]) {
                        delete self._drive.keys[code];
                        self._driveKeysUi();
                    } });
                });
            });
            this._winBlur = function () { if (self._drive) {
                self._drive.keys = {};
                self._drive.hold = {};
                self._driveKeysUi();
            } };
            // While driving, keys pressed anywhere on the page drive the robot (not while typing in a field).
            function typing(el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
            this._winKeyDown = function (e) {
                if (!self._drive || e.defaultPrevented)
                    return;
                const path = e.composedPath ? e.composedPath() : [e.target];
                if (path.indexOf(self) >= 0 || typing(path[0]))
                    return; // inside the sandbox its own handler runs
                self._driveKey(e, true);
            };
            this._winKeyUp = function (e) { self._driveKeyUp(e); };
        }
        // `onLoad`: Drive started by itself when the page opened (see _boot). Then the keys work page-wide only after
        // the first tap or click inside the sandbox, so the page still scrolls with Space and the arrows until then.
        _toggleDrive(on, onLoad) {
            if (on === undefined)
                on = !this._drive;
            if (!!on === !!this._drive)
                return;
            const self = this, vp = this.$('.viewport');
            if (on) {
                this._stopPlay();
                this._exitPlay();
                this._clearStop();
                const p = this._robotNow();
                // Start upright: if the robot's top points at the deck (the dock pose does), roll it 180° about the
                // camera axis so the camera picture is the right way up. Reset returns here.
                let q0 = Core.qNorm(p.q);
                if (Core.dot(Core.topDir(q0), [0, 0, -1]) < 0)
                    q0 = Core.qNorm(Core.qMul(q0, Core.qFromAxisAngle([1, 0, 0], Math.PI)));
                this._drive = { pos: p.pos.slice(), q: q0, start: { pos: p.pos.slice(), q: q0 }, keys: {}, joy: { move: [0, 0], turn: [0, 0] }, hold: {}, fine: false, last: 0, hudAt: 0 };
                this.$('[data-act=drivefine]').setAttribute('aria-pressed', 'false');
                window.addEventListener('blur', this._winBlur);
                const pageKeys = function () {
                    self._root.removeEventListener('pointerdown', pageKeys);
                    self._root.removeEventListener('focusin', pageKeys);
                    if (!self._drive)
                        return;
                    window.addEventListener('keydown', self._winKeyDown);
                    window.addEventListener('keyup', self._winKeyUp);
                };
                if (onLoad) {
                    this._root.addEventListener('pointerdown', pageKeys);
                    this._root.addEventListener('focusin', pageKeys);
                }
                else {
                    pageKeys();
                    try {
                        vp.focus({ preventScroll: true });
                    }
                    catch (e) {
                        vp.focus();
                    }
                }
                const touch = this._sticks;
                this._toast(touch ? L('Left stick moves, right stick turns. Add waypoint drops one.', 'বাঁ স্টিকে চলবে, ডান স্টিকে ঘুরবে। ‘ওয়েপয়েন্ট বসাও’ চাপলে একটা বসে যাবে।')
                    : L('W A S D move, R / F up and down, arrows turn, Q / E roll, Enter adds a waypoint.', 'W A S D দিয়ে চলো, R / F দিয়ে ওপর-নিচ, অ্যারো কি দিয়ে ঘোরো, Q / E দিয়ে রোল। Enter চাপলে ওয়েপয়েন্ট বসবে।'));
                this._log(L('● Drive · ', '● ড্রাইভ · ') + (touch ? L('left stick moves, right stick turns', 'বাঁ স্টিকে চলা, ডান স্টিকে ঘোরা') : L('W A S D move, R / F up / down, arrows turn, Q / E roll', 'W A S D চলা, R / F ওপর / নিচ, অ্যারো ঘোরা, Q / E রোল')), 'head');
                // A fixed side view of the whole module while driving; the previous view comes back afterwards.
                if (this._camera)
                    this._viewBeforeDrive = { pos: this._camera.position.clone(), target: this._controls.target.clone(), roll: this._issRoot.rotation.x };
                this._driveView3d();
                // The robot camera (left) and 3D (right) side by side while driving; the other views stay one tap away.
                this._uiViewBeforeDrive = this._ui.view;
                this._setView('split');
                requestAnimationFrame(function () { if (self._drive) {
                    self._resize3d();
                    self._driveView3d();
                } });
                const loop = function (now) { if (!self._drive)
                    return; self._driveTick(now); self._drive.raf = requestAnimationFrame(loop); };
                this._drive.raf = requestAnimationFrame(loop);
            }
            else {
                cancelAnimationFrame(this._drive.raf);
                window.removeEventListener('blur', this._winBlur);
                window.removeEventListener('keydown', this._winKeyDown);
                window.removeEventListener('keyup', this._winKeyUp);
                this._drive = null;
                this._log(L('■ Drive stopped', '■ ড্রাইভ বন্ধ'));
                const vb = this._viewBeforeDrive;
                if (vb && this._camera) {
                    this._camera.position.copy(vb.pos);
                    this._controls.target.copy(vb.target);
                    this._issRoot.rotation.x = vb.roll;
                    this._rollWheelUi();
                    this._controls.update();
                    this._render3d();
                }
                this._viewBeforeDrive = null;
                this._expandFrom = null;
                if (this._uiViewBeforeDrive && ['split', 'cam', '3d'].indexOf(this._ui.view) >= 0)
                    this._setView(this._uiViewBeforeDrive);
                this._uiViewBeforeDrive = null;
            }
            this._root.classList.toggle('driving', !!on);
            this.$('.drive').hidden = !on;
            this._updatePaused();
            this.$('[data-act=drive]').setAttribute('aria-pressed', String(!!on));
            this._driveHud();
            this._drawAll();
            this._place3dRobot();
        }
        // While driving, keep the views above the controls: reserve the controls' height at the bottom.
        _layoutDrive() {
            // On a short screen (a phone in landscape) the controls sit in the corners and along the bottom edge,
            // so the views keep the full height and the controls float over them.
            const dp = this._drive && this._ui.view === 'split' && !this._short && this.$('.dpad');
            this._root.style.setProperty('--dpadh', (dp ? Math.round(dp.offsetHeight) : 0) + 'px');
            const self = this;
            requestAnimationFrame(function () { self._placeJzones(); });
        }
        // The touch zone of each stick: a circle around it, 44 px wider than the stick on every side (a bit more
        // than its visible ring), so a thumb that lands near the stick still steers but the rest of the views
        // (3D twist, pinch and pan) stay free.
        _placeJzones() {
            const drive = this.$('.drive');
            if (!this._drive || !drive)
                return;
            const dr = drive.getBoundingClientRect(), self = this, m = 44;
            ['move', 'turn'].forEach(function (n) {
                const j = self.$('.joy[data-joy="' + n + '"]'), z = self.$('.jzone[data-zone="' + n + '"]');
                if (!j || !z)
                    return;
                const r = j.getBoundingClientRect();
                if (!r.width) {
                    z.style.width = z.style.height = '0px';
                    return;
                }
                z.style.left = Math.round(r.left - dr.left - m) + 'px';
                z.style.top = Math.round(r.top - dr.top - m) + 'px';
                z.style.width = z.style.height = Math.round(r.width + 2 * m) + 'px';
            });
        }
        // Back to where Drive started (upright), with the 3D view reset too.
        _driveReset() {
            const d = this._drive;
            if (!d || !d.start)
                return;
            d.pos = d.start.pos.slice();
            d.q = d.start.q.slice();
            d.keys = {};
            d.joy = { move: [0, 0], turn: [0, 0] };
            d.hold = {};
            this._touched3d = false;
            this._driveView3d();
            this._driveKeysUi();
            this._driveHud();
            this._drawAll();
            this._place3dRobot();
            this._log(L('↺ Reset to where Drive started', '↺ ড্রাইভ যেখান থেকে শুরু হয়েছিল, সেখানে ফেরা হলো'));
        }
        _drivePose() { return { pos: this._drive.pos, q: this._drive.q }; }
        _driveTo(pose) {
            this._drive.pos = pose.pos.slice();
            this._drive.q = Core.qNorm(pose.q);
            this._driveHud();
        }
        // The waypoint a new one would follow: the selected one, else the last one, else the start.
        _driveFrom() {
            const r = this._route;
            if (this._sel >= 0 && r[this._sel])
                return { pos: r[this._sel].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1) };
            if (r.length)
                return { pos: r[r.length - 1].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + r.length };
            return { pos: this._config.start.pos, label: this._config.start.name };
        }
        // outside: the key was pressed with focus outside the 3D/2D views (a button, the page...). Then
        // Enter and Space keep their usual job on buttons and links.
        _driveKey(e, outside) {
            if (e.ctrlKey || e.metaKey || e.altKey)
                return false;
            const code = e.code, d = this._drive;
            // Esc goes back to driving from another view; it never leaves Drive (Play does). Otherwise it closes menus.
            if (e.key === 'Escape') {
                if (this._ui.view === 'split')
                    return false;
                this._viewBack();
                return true;
            }
            if (this._ui.view !== 'split')
                return false; // paused: an expanded view, or another view picked from the header
            if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
                const t = (e.composedPath ? e.composedPath()[0] : e.target);
                if (outside && t && t.closest && t.closest('button,a,summary,[role=button]'))
                    return false;
                e.preventDefault();
                if (!e.repeat)
                    this._driveAdd();
                return true;
            }
            if (code === 'KeyU') {
                if (!e.repeat)
                    this._driveUpdate();
                return true;
            }
            if (code === 'KeyH') {
                if (!e.repeat)
                    this._driveReset();
                return true;
            }
            const held = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
            if (held.indexOf(code) < 0)
                return false;
            e.preventDefault();
            if (this._sticks) {
                this._keyboard = true;
                this._applyTouchMode();
                this._layoutDrive();
            } // a real keyboard: show its keys, not the sticks
            if (!e.repeat && !d.keys[code])
                this._centerGameView();
            d.keys[code] = true;
            this._driveKeysUi();
            return true;
        }
        _driveKeyUp(e) {
            if (!this._drive || !this._drive.keys[e.code])
                return;
            delete this._drive.keys[e.code];
            this._driveKeysUi();
        }
        // Light up the on-screen keys that are held (keyboard or mouse).
        _driveKeysUi() {
            const k = this._drive ? this._drive.keys : {};
            this.$$('.kpad [data-key]').forEach(function (b) { b.classList.toggle('on', !!k[b.getAttribute('data-key')]); });
        }
        _driveTick(now) {
            if (this._ui.view !== 'split') {
                this._drive.last = 0;
                return;
            } // paused (see _updatePaused)
            const d = this._drive, cfg = this._config, k = d.keys;
            const dt = d.last ? Math.min(0.1, (now - d.last) / 1000) : 0;
            d.last = now;
            if (!dt)
                return;
            const S = Core.STEER, fine = d.fine || k.ShiftLeft || k.ShiftRight, v = fine ? S.fineSpeed : S.speed, w = fine ? S.fineTurn : S.turn;
            const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - d.joy.move[1];
            const side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + d.joy.move[0];
            const vert = (k.KeyR ? 1 : 0) - (k.KeyF ? 1 : 0) + (d.hold.up ? 1 : 0) - (d.hold.down ? 1 : 0); // up in the camera picture
            const yawIn = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0) + d.joy.turn[0];
            const pitchIn = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0) - d.joy.turn[1];
            // ⟲ / Q turn the camera picture anticlockwise (the robot rolls clockwise), ⟳ / E the other way.
            const rollIn = (k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0) + (d.hold.rollL ? 1 : 0) - (d.hold.rollR ? 1 : 0);
            let changed = false;
            if (fwd || side || vert) {
                // Every move follows the camera picture, whichever way up the robot is: forward along the camera,
                // right = the picture's right (body -Y), up = the picture's up (the robot's top, body +Z).
                const f = Core.cameraDir(d.q), r = Core.qRotate(d.q, [0, -1, 0]), u = Core.topDir(d.q);
                const delta = Core.scale(Core.add(Core.add(Core.scale(f, fwd), Core.scale(r, side)), Core.scale(u, vert)), v * dt);
                const np = Core.driveStep(cfg, d.pos, delta), moved = Core.sub(np, d.pos);
                if (Core.len(moved) > 1e-9) {
                    d.pos = np;
                    changed = true;
                }
            }
            if (yawIn || pitchIn || rollIn) {
                // Turn about the robot's own axes, as the camera sees them: left / right about its top (+Z),
                // look up / down about its left (+Y), roll about the camera axis (+X, + = robot clockwise).
                let rad = w * dt * Math.PI / 180, q = d.q;
                if (yawIn)
                    q = Core.qMul(q, Core.qFromAxisAngle([0, 0, 1], -yawIn * rad));
                if (pitchIn)
                    q = Core.qMul(q, Core.qFromAxisAngle([0, 1, 0], -pitchIn * rad));
                if (rollIn)
                    q = Core.qMul(q, Core.qFromAxisAngle([1, 0, 0], rollIn * rad));
                d.q = Core.qNorm(q);
                changed = true;
            }
            if (!changed)
                return;
            this._drawAll();
            this._place3dRobot();
            if (now - d.hudAt > 70) {
                d.hudAt = now;
                this._driveHud();
            }
        }
        // Keep the robot in the 3D view: move the orbit camera along with it.
        // Drive: the whole module from the long side (EPS2 wall, +y), a little toward the dock end and from
        // overhead, so the dock is on the left, the airlock on the right and overhead at the top. The camera
        // stays put while the robot flies (the student can still orbit or zoom).
        _driveView3d() { this._fit3d(); }
        // Steering (a stick on a phone held upright, a Drive key on a desktop) brings the game view, the camera and
        // 3D views with their controls, to the middle of the window when it is noticeably off. Full screen has no
        // page to scroll.
        _centerGameView() {
            if (this._fs)
                return;
            const r = this.$('.viewport').getBoundingClientRect();
            if (Math.abs(r.top + r.height / 2 - innerHeight / 2) > 40)
                this._centerViews();
        }
        _driveHud() {
            if (!this._drive)
                return;
            const d = this._drive, cfg = this._config, pose = this._drivePose(), st = Core.pointStatus(cfg, d.pos);
            const ypr = Core.yawPitchFromQ(d.q);
            // The pose first: on a computer a long line is cut short from the end, so the additions go last.
            const l1 = '<span class="hpose">x ' + f3(d.pos[0]) + '  y ' + f3(d.pos[1]) + '  z ' + f3(d.pos[2]) + '  <span class="mut">' + L('heading', 'হেডিং') + '</span> ' + Math.round(ypr.yaw) + '°  <span class="mut">' + L('pitch', 'পিচ') + '</span> ' + Math.round(ypr.pitch) + '°  <span class="mut">' + L('roll', 'রোল') + '</span> ' + Math.round(ypr.roll) + '°</span>' +
                (st.free ? '' : '  <span class="bad">' + esc(Core.whyText(st)) + '</span>');
            // What the camera is looking at.
            let best = null;
            cfg.targets.forEach(function (t) {
                const ck = Core.captureCheck(cfg, t, pose);
                if (ck.front && ck.aim < 45 && (!best || ck.aim < best.ck.aim))
                    best = { t: t, ck: ck };
            });
            let l2, near = null;
            cfg.checkpoints.forEach(function (cp) {
                const ck = Core.checkpointCheck(cfg, cp, pose);
                if (ck.dist < 2 * cp.scoreBands[cp.scoreBands.length - 1].radius && (!near || ck.dist < near.ck.dist))
                    near = { cp: cp, ck: ck };
            });
            const lvSpan = function (lv, text) { return '<span class="' + (lv ? 'ok' : 'bad') + '">' + text + ' ' + (lv ? 'Lv' + lv : '✕') + '</span>'; };
            if (near) {
                const nk = near.ck;
                l2 = '<span class="' + (nk.passed ? 'ok' : 'mut') + '">' + esc(near.cp.name) + ':</span> ' + lvSpan(nk.levels.pos, f2(nk.dist) + L(' m', ' মি')) + ' · ' +
                    lvSpan(nk.levels.centering, L('centre ', 'কেন্দ্র ') + Math.round(nk.centering) + '°') + ' · ' + lvSpan(nk.levels.roll, L('roll ', 'রোল ') + Math.round(Math.abs(nk.roll)) + '° ' + (Math.abs(nk.roll) < 1 ? '' : nk.roll > 0 ? '(⟲ Q)' : '(⟳ E)')) +
                    (nk.passed ? ' <span class="ok">' + L('passes at Lv' + nk.level, 'Lv' + nk.level + '-এ পার হচ্ছে') + '</span>' : '');
            }
            else if (best && cfg.mission.indexOf(best.t.id) < 0) {
                l2 = '<span class="mut">' + L('Camera on ' + esc(best.t.name) + ': ' + f2(best.ck.dist) + ' m, ' + Math.round(best.ck.aim) + '° off centre.', 'ক্যামেরা ' + esc(best.t.name) + '-এর দিকে: ' + f2(best.ck.dist) + ' মি, কেন্দ্র থেকে ' + Math.round(best.ck.aim) + '° সরে।') + '</span>';
            }
            else if (best) {
                const ck = best.ck, good = ck.inRange && ck.aimed;
                l2 = '<span class="' + (good ? 'ok' : 'mut') + '">' + L('Camera on ' + esc(best.t.name), 'ক্যামেরা ' + esc(best.t.name) + '-এর দিকে') + ':</span> ' +
                    '<span class="' + (ck.inRange ? 'ok' : 'bad') + '">' + f2(ck.dist) + L(' m ', ' মি ') + (ck.inRange ? '✓' : ck.dist > ck.hi ? L('too far', 'বেশি দূরে') : L('too close', 'বেশি কাছে')) + '</span> · ' +
                    '<span class="' + (ck.aimed ? 'ok' : 'bad') + '">' + Math.round(ck.aim) + L('° off ', '° সরে ') + (ck.aimed ? '✓' : '') + '</span>' + (good ? ' <span class="ok">' + L('ready to capture', 'ধরার জন্য তৈরি') + '</span>' : '');
            }
            else
                l2 = '<span class="mut">' + L('Camera is not pointing at a target.', 'ক্যামেরা কোনো টার্গেটের দিকে তাক করা নেই।') + '</span>';
            cfg.mission.forEach(function (id) {
                const p = Core.findPose(cfg, id);
                if (!p)
                    return;
                const dd = Core.dist(d.pos, p.pos);
                if (dd < 0.5) {
                    const turn = Core.qAngleDeg(pose.q, p.q), ok = dd <= cfg.settings.poseTolerance && turn <= cfg.settings.aimTolerance;
                    l2 += ' · <span class="' + (ok ? 'ok' : 'mut') + '">' + esc(p.name) + ': ' + Math.round(dd * 100) + L(' cm, ', ' সেমি, ') + Math.round(turn) + L('° off', '° সরে') + (ok ? ' ✓' : '') + '</span>';
                }
            });
            const from = this._driveFrom(), clear = Core.checkSegment(cfg, from.pos, d.pos).clear;
            const l3 = L('Straight move from ' + esc(from.label), esc(from.label) + ' থেকে সোজা পথ') + ': ' + (clear ? '<span class="ok">' + L('clear', 'খোলা') + '</span>' : '<span class="bad">' + L('blocked, add a waypoint at the corner first', 'আটকে আছে, আগে কোণায় একটা ওয়েপয়েন্ট বসাও') + '</span>');
            this.$('[data-h="1"]').innerHTML = l1;
            this.$('[data-h="2"]').innerHTML = l2;
            this.$('[data-h="3"]').innerHTML = l3;
            const rd = Core.readMarkers(cfg, pose);
            // Log what changes: markers coming into or out of the camera's reading, and the nearby checkpoint's level.
            const ids = rd.seen.map(function (m) { return m.id; }), prev = d.lastIds || [], self = this;
            ids.forEach(function (id) { if (prev.indexOf(id) < 0) {
                const m = rd.seen.filter(function (x) { return x.id === id; })[0];
                self._log(L('[AR] reads ID ' + id + ' · ' + f2(m.distance) + ' m · ' + Math.round(m.offCentre) + '° off centre', '[AR] ID ' + id + ' পড়ছে · ' + f2(m.distance) + ' মি · কেন্দ্র থেকে ' + Math.round(m.offCentre) + '° সরে'), 'ar');
            } });
            prev.forEach(function (id) { if (ids.indexOf(id) < 0)
                self._log(L('[AR] lost ID ' + id, '[AR] ID ' + id + ' আর পড়ছে না'), 'warn'); });
            d.lastIds = ids;
            const lvKey = near ? near.cp.key + ':' + near.ck.level : '';
            if (lvKey !== (d.lastLv || '')) {
                if (near && near.ck.passed)
                    this._log(near.cp.name + L(' · passes at Lv' + near.ck.level, ' · Lv' + near.ck.level + '-এ পার হচ্ছে'), 'ok');
                else if (near && d.lastLv && d.lastLv.split(':')[0] === near.cp.key)
                    this._log(near.cp.name + L(' · not passing', ' · পার হচ্ছে না'), 'warn');
                d.lastLv = lvKey;
            }
            this.$('[data-h="4"]').innerHTML = rd.seen.length
                ? '<span class="ok">' + L('Camera reads', 'ক্যামেরা পড়ছে') + '</span> ' + rd.seen.map(function (m) { return 'ID ' + m.id + ' (' + f2(m.distance) + L(' m)', ' মি)'); }).join(', ')
                : '<span class="mut">' + L('Camera reads no marker', 'ক্যামেরা কোনো মার্কার পড়ছে না') + (rd.missed.length ? ': ' + esc(rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why) : '') + '</span>';
            // The HUD keeps to two lines on a computer, cutting long lines short; hovering shows them in full.
            const hud = this.$('.hud'), full = ['1', '3', '2', '4'].map(function (k) { return self.$('[data-h="' + k + '"]').textContent; }).filter(Boolean).join('\n');
            if (hud.title !== full)
                hud.title = full;
            const up = this.$('[data-act=driveupdate]');
            const has = this._sel >= 0 && this._route[this._sel];
            up.disabled = !has;
            // One row of buttons in full screen and on narrower desktops (the 1100px container rules in styles).
            const compact = this._narrow || !!this._fs || this.$('.viewport').clientWidth <= 1100;
            const narrow = this._narrow, moveLabel = function (n) { return narrow ? L('Move #' + n, '#' + n + ' আনো') : compact ? L('Move #' + n + ' here', '#' + n + ' এখানে আনো') : L('Move waypoint ' + n + ' here', 'ওয়েপয়েন্ট ' + n + ' এখানে আনো'); };
            const none = compact ? L('Move here', 'এখানে আনো') : L('Move selected here', 'বাছাই করাটা এখানে আনো'), label = has ? moveLabel(String(this._sel + 1)) : none;
            // The longest labels sit invisibly under the real one, so the button keeps its width (and the buttons
            // beside it stay put) when a waypoint is added, selected or deselected.
            up.innerHTML = '<span class="mvl"><span>' + label + '</span><span aria-hidden="true">' + moveLabel('88') + '</span><span aria-hidden="true">' + none + '</span></span><kbd>U</kbd>';
            this.$('[data-act=driveadd]').innerHTML = (compact ? L('Add waypoint', 'ওয়েপয়েন্ট বসাও') : L('Add waypoint here', 'এখানে ওয়েপয়েন্ট বসাও')) + '<kbd>Enter</kbd>';
        }
        _driveName(pose) {
            let cfg = this._config, name = null;
            cfg.checkpoints.forEach(function (cp) { if (!name && Core.checkpointCheck(cfg, cp, pose).passed)
                name = cp.name; });
            cfg.targets.forEach(function (t) { const ck = Core.captureCheck(cfg, t, pose); if (!name && cfg.mission.indexOf(t.id) >= 0 && ck.front && ck.inRange && ck.aimed)
                name = t.name + L(' capture', ' ধরা'); });
            cfg.poses.forEach(function (p) {
                if (!name && Core.dist(pose.pos, p.pos) <= cfg.settings.poseTolerance && Core.qAngleDeg(pose.q, p.q) <= cfg.settings.aimTolerance)
                    name = p.name;
            });
            return name || L('Waypoint ', 'ওয়েপয়েন্ট ') + (this._route.filter(function (w) { return !w.via; }).length + 1);
        }
        _drivePoint() {
            let d = this._drive, pos = Core.roundVec(d.pos, 3);
            if (!Core.isFree(this._config, pos))
                pos = d.pos.slice();
            return { pos: pos, q: Core.roundVec(d.q, 4) };
        }
        _driveAdd() {
            if (!this._drive)
                return;
            const self = this, pt = this._drivePoint(), idx = this._sel >= 0 ? this._sel + 1 : this._route.length;
            const name = this._driveName(pt);
            this._edit(function () { self._route.splice(idx, 0, { name: name, pos: pt.pos, mode: 'custom', q: pt.q }); self._sel = idx; });
            this._select(idx, true);
            this._toast(L('Added waypoint ' + (idx + 1) + '.', 'ওয়েপয়েন্ট ' + (idx + 1) + ' বসানো হলো।'));
            this._log(L('+ waypoint ' + (idx + 1) + ' · ' + name + ' at ' + vecText(pt.pos, 2), '+ ওয়েপয়েন্ট ' + (idx + 1) + ' · ' + name + ', ' + vecText(pt.pos, 2) + '-এ'), 'ok');
            this._mark('droveWaypoint');
            this._driveHud();
        }
        _driveUpdate() {
            if (!this._drive)
                return;
            const i = this._sel, self = this;
            if (i < 0 || !this._route[i]) {
                const tap = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
                this._toast(L('Select a waypoint first (' + (tap ? 'tap' : 'click') + ' it in a view or in the list).', 'আগে একটা ওয়েপয়েন্ট বাছাই করো (কোনো ভিউতে বা তালিকায় ' + (tap ? 'ট্যাপ' : 'ক্লিক') + ' করে)।'));
                return;
            }
            const pt = this._drivePoint();
            this._edit(function () { const w = self._route[i]; w.pos = pt.pos; w.q = pt.q; w.mode = 'custom'; });
            this._toast(L('Moved waypoint ' + (i + 1) + ' to ' + vecText(pt.pos) + '.', 'ওয়েপয়েন্ট ' + (i + 1) + ' সরিয়ে ' + vecText(pt.pos) + '-এ আনা হলো।'));
            this._driveHud();
        }
    }

    /* ---------- events ---------- */
    class Events {
        // Scroll the page so the views sit in the middle of the screen (after the layout settles: Drive changes it).
        _centerViews() {
            if (this._fs)
                return;
            const vp = this.$('.viewport');
            const smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            requestAnimationFrame(function () {
                try {
                    vp.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth ? 'smooth' : 'auto' });
                }
                catch (e) {
                    vp.scrollIntoView();
                }
            });
        }
        _onClick(e) {
            const t = e.target.closest('[data-act],[data-view],[data-tab],[data-lang],[data-goto],[data-goal],.wp');
            if (!t || !this._root.contains(t)) {
                this._closeMenus();
                return;
            }
            if (!t.closest('.menuwrap'))
                this._closeMenus();
            if (t.hasAttribute('data-view')) {
                this._expandFrom = null;
                this._exitPlay();
                this._setView(t.getAttribute('data-view'));
                this._centerViews();
                return;
            }
            if (t.hasAttribute('data-tab')) {
                this._setTab(t.getAttribute('data-tab'));
                this._save();
                return;
            }
            if (t.hasAttribute('data-lang')) {
                this._setLang(t.getAttribute('data-lang'));
                this._save();
                return;
            }
            if (t.hasAttribute('data-goto')) {
                this._closeMenus();
                this._goTo(t.getAttribute('data-goto'));
                return;
            }
            if (t.hasAttribute('data-goal')) {
                const gi = +t.getAttribute('data-goal');
                if (gi >= 0)
                    this._select(gi, true);
                return;
            }
            const act = t.getAttribute('data-act');
            const card = t.closest('.wp'), i = card ? +card.getAttribute('data-i') : -1;
            if (!act) {
                if (card && !e.target.closest('input,select,button'))
                    this._select(i, false);
                return;
            }
            const self = this;
            switch (act) {
                case 'play':
                    this._togglePlay();
                    this._centerViews();
                    break;
                case 'pause':
                    this._pausePlay(!(this._play && this._play.paused));
                    break;
                case 'replay':
                    this._replay();
                    this._centerViews();
                    break;
                // Drive only starts Drive (Play leaves it); while driving it brings a paused Drive back.
                case 'drive':
                    if (!this._drive)
                        this._toggleDrive(true);
                    else if (this._ui.view !== 'split')
                        this._viewBack();
                    this._centerViews();
                    break;
                case 'driveadd':
                    this._driveAdd();
                    break;
                case 'driveupdate':
                    this._driveUpdate();
                    break;
                case 'drivereset':
                    this._driveReset();
                    this._centerViews();
                    break;
                case 'viewsmenu':
                    this._showViews(!this._root.classList.contains('views-open'));
                    break;
                case 'drivefine':
                    if (this._drive) {
                        this._drive.fine = !this._drive.fine;
                        t.setAttribute('aria-pressed', String(this._drive.fine));
                    }
                    break;
                case 'saves':
                    this._openSaves();
                    break;
                case 'fullscreen':
                    if (this._fs)
                        this._exitFullscreen();
                    else
                        this._enterFullscreen();
                    break;
                case 'toastclose':
                    clearTimeout(this._toastTimer);
                    this.$('.toast').classList.remove('on');
                    break;
                case 'drawer':
                    this._setDrawer(!this._drawer);
                    break;
                case 'closesaves':
                    this._closeSaves();
                    break;
                case 'fit': {
                    const fv = this._views[t.getAttribute('data-v')];
                    fv.fitted = false;
                    fv.touched = false;
                    this._resizeView(fv);
                    break;
                }
                case 'fit3d':
                    this._resetViews();
                    this._centerViews();
                    break;
                case 'termtoggle':
                    this._termAuto = false;
                    this._setTermMin(!this._termMin);
                    break;
                case 'goto':
                    this._toggleMenu('goto');
                    break;
                case 'more':
                    this._toggleMenu('more');
                    break;
                case 'add':
                    this._addWaypoint();
                    break;
                case 'fixall':
                    this._fixAll();
                    break;
                case 'undo':
                    this._doUndo();
                    break;
                case 'example':
                    this._edit(function () { self._route = Core.starterRoute(self._config); self._sel = -1; }, { reason: 'example' });
                    this._toast(L('Loaded the starter route: waypoint 1 is a worked example that passes its goal; the next three are rough on purpose. Press Play to see what the camera reads at each, fix them with the Mission list, then add the rest yourself.', 'শুরুর রুট আনা হয়েছে: ওয়েপয়েন্ট 1 একটা করে দেখানো উদাহরণ, যেটা নিজের লক্ষ্য পূরণ করে; পরের তিনটা ইচ্ছে করেই কাঁচা রাখা। প্রতিটায় ক্যামেরা কী পড়ে, দেখতে ‘চালাও’ চাপো; মিশনের তালিকা দেখে সেগুলো ঠিক করো, তারপর বাকিগুলো নিজে যোগ করো।'));
                    break;
                case 'copyread':
                    this._copy(JSON.stringify(this._readingJson(), null, 2));
                    break;
                case 'pipopen':
                    this._expandView('cam');
                    break;
                case 'maxview':
                    this._expandView(t.getAttribute('data-v'));
                    break;
                case 'viewback':
                    this._viewBack();
                    break;
                case 'mapopen':
                    this._setView('top');
                    break;
                case 'piphide':
                    this._ui.pip = false;
                    this._save();
                    this._drawInsets();
                    break;
                case 'pipshow':
                    this._ui.pip = true;
                    this._save();
                    this._drawInsets();
                    break;
                case 'clear':
                    this._edit(function () { self._route = []; self._sel = -1; });
                    break;
                case 'up':
                    this._move(i, -1);
                    break;
                case 'down':
                    this._move(i, 1);
                    break;
                case 'del':
                    this._edit(function () { self._route.splice(i, 1); self._sel = Math.min(i, self._route.length - 1); });
                    break;
                case 'around':
                    this._routeAround(+t.getAttribute('data-i'));
                    break;
                case 'hint':
                    this._toggleHint(+t.getAttribute('data-i'));
                    break;
                case 'copycode':
                    this._copy(this.$('pre.code').textContent);
                    this._mark('exportedJava');
                    break;
                case 'newcps':
                    this._newCheckpoints();
                    break;
                case 'samplecps':
                    this._sampleCheckpoints();
                    break;
                case 'copyjson':
                    this._copy(JSON.stringify(this._route, null, 2));
                    break;
                case 'copyworld':
                    this._copy(JSON.stringify(this._config, null, 2));
                    break;
                case 'applyjson':
                    this._applyJson();
                    break;
                case 'resetworld':
                    this._config = Core.copy(this._base);
                    this._configFromStore = false;
                    this._afterConfig();
                    this._toast(L('World reset to defaults.', 'ওয়ার্ল্ড শুরুর মানে ফেরানো হয়েছে।'));
                    break;
                case 'addkoz':
                    this._addKoz();
                    break;
                case 'delkoz':
                    this._config.koz.splice(+t.getAttribute('data-k'), 1);
                    this._afterConfig();
                    break;
                case 'savenew':
                    this._saveNamed();
                    break;
                case 'loadsave':
                    this._loadNamed(+t.getAttribute('data-k'));
                    break;
                case 'delsave':
                    this._saves.splice(+t.getAttribute('data-k'), 1);
                    this._save();
                    this._renderSaves();
                    break;
                case 'exportfile':
                    this._exportFile();
                    break;
                case 'importfile':
                    this.$('input[type=file]').click();
                    break;
                case 'wipe':
                    this._wipe(t);
                    break;
            }
        }
        _onFocusIn(e) {
            const card = e.target.closest && e.target.closest('.wp');
            if (card && e.target.matches('input,select')) {
                const i = +card.getAttribute('data-i');
                if (i !== this._sel)
                    this._select(i, false);
                this._pendingUndo = JSON.stringify(this._route);
            }
        }
        _onInput(e) {
            const t = e.target, card = t.closest('.wp');
            if (!card || !t.hasAttribute('data-f'))
                return;
            const i = +card.getAttribute('data-i'), w = this._route[i], f = t.getAttribute('data-f');
            if (!w)
                return;
            if (f === 'name') {
                w.name = t.value;
                return;
            }
            const m = /^(x|y|z|q0|q1|q2|q3)$/.exec(f);
            if (!m)
                return;
            const v = parseFloat(t.value);
            if (!isFinite(v))
                return;
            if (f.charAt(0) === 'q') {
                w.q = w.q || [0, 0, 0, 1];
                w.q[+f.charAt(1)] = v;
            }
            else
                w.pos[AX.indexOf(f)] = v;
            this._userActed = true;
            this._refresh();
        }
        _onChange(e) {
            const t = e.target;
            if (t.getAttribute('data-f') === 'speed') {
                this._ui.playSpeed = +t.value;
                this._save();
                if (this._play) {
                    this._play.mult = +t.value;
                    this._log(L('Play speed ', 'চালানোর গতি ') + t.value + '×');
                } // takes effect from the next frame
                return;
            }
            if (t.getAttribute('data-f') === 'level') {
                if (Core.levelFor(t.value))
                    this._newCheckpoints(t.value);
                return;
            }
            if (t.hasAttribute('data-s')) {
                this._changeSetting(t);
                return;
            }
            if (t.hasAttribute('data-kf')) {
                this._changeKoz(t);
                return;
            }
            const card = t.closest('.wp');
            if (!card)
                return;
            const i = +card.getAttribute('data-i'), w = this._route[i], f = t.getAttribute('data-f');
            if (!w)
                return;
            if (f === 'mode') {
                const before = JSON.stringify(this._route), mode = t.value;
                if (mode === 'custom' && !w.q)
                    w.q = Core.roundVec(this._analysis.poses[i].q, 4);
                if (mode === 'target' && !Core.findTarget(this._config, w.target))
                    w.target = this._nearestTarget(w.pos);
                w.mode = mode;
                this._pushUndo(before);
                this._userActed = true;
                this._commit({});
                return;
            }
            if (f === 'target') {
                const b2 = JSON.stringify(this._route);
                w.target = t.value;
                this._pushUndo(b2);
                this._userActed = true;
                this._commit({});
                return;
            }
            // Text and number fields were applied live; record undo and tidy up now.
            if (this._pendingUndo && this._pendingUndo !== JSON.stringify(this._route))
                this._pushUndo(this._pendingUndo);
            this._pendingUndo = JSON.stringify(this._route);
            this._userActed = true;
            this._commit({ keepList: true });
        }
        _onKey(e) {
            const inField = e.target && e.target.matches && e.target.matches('input,select,textarea');
            if (this._drive && !inField && this._driveKey(e, !this.$('.viewport').contains(e.target)))
                return;
            if (e.key === 'Escape') {
                this._closeMenus();
                this._closeSaves();
                return;
            }
            if (inField)
                return;
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                this._doUndo();
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && this._sel >= 0 && e.target.closest('.cell,.list')) {
                e.preventDefault();
                const self = this, i = this._sel;
                this._edit(function () { self._route.splice(i, 1); self._sel = Math.min(i, self._route.length - 1); });
            }
        }
    }

    class Fullscreen {
        // Real full screen where the browser allows it (and a landscape lock on phones that support it);
        // otherwise (iPhone Safari) the tool covers the page and asks to turn the phone sideways.
        _enterFullscreen() {
            const el = this._root, self = this, req = el.requestFullscreen || el.webkitRequestFullscreen;
            const touch = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
            function done(real) {
                self._fs = real ? 'real' : 'pseudo';
                if (touch && !self._termMin) {
                    self._setTermMin(true);
                    self._termAuto = true;
                }
                self._applyFs();
                const o = window.screen && window.screen.orientation;
                if (real && touch && o && o.lock)
                    o.lock('landscape').catch(function () { self._fsRotateHint(); });
                else if (touch)
                    self._fsRotateHint();
            }
            if (!req) {
                done(false);
                return;
            }
            try {
                const p = req.call(el, { navigationUI: 'hide' });
                if (p && typeof p.then === 'function')
                    p.then(function () { done(true); }, function () { done(false); });
                else
                    done(true);
            }
            catch (e) {
                done(false);
            }
        }
        _fsRotateHint() {
            const self = this;
            setTimeout(function () { if (self._fs && window.innerHeight > window.innerWidth)
                self._toast(L('Turn your phone sideways for a bigger view. Tap Exit to leave full screen.', 'বড় করে দেখতে ফোনটা আড়াআড়ি ধরো। ফুল স্ক্রিন থেকে বেরোতে ‘বের হও’ চাপো।')); }, 300);
        }
        _exitFullscreen() {
            const real = this._fs === 'real';
            if (this._termAuto) {
                this._termAuto = false;
                this._setTermMin(false);
            } // collapsed only because of full screen
            this._fs = null;
            this._applyFs();
            try {
                const o = window.screen && window.screen.orientation;
                if (o && o.unlock)
                    o.unlock();
            }
            catch (e) { /* not locked */ }
            const d = document;
            if (real && (d.fullscreenElement || d.webkitFullscreenElement)) {
                try {
                    const p = (d.exitFullscreen || d.webkitExitFullscreen).call(d);
                    if (p && p.catch)
                        p.catch(function () { });
                }
                catch (e) { /* already out */ }
            }
        }
        // Full screen hides the panel; the Waypoints button slides it in over the views (still fully editable).
        // Also on a phone held upright (not full screen): then it covers the views, where the student is looking.
        _setDrawer(open) {
            this._drawer = !!open && (!!this._fs || !!this._narrow);
            if (this._drawer && !this._fs)
                this._root.style.setProperty('--dvh', Math.round(this.$('.viewport').getBoundingClientRect().height) + 'px');
            this._root.classList.toggle('drawer', this._drawer);
            const self = this;
            this.$$('[data-act=drawer]').forEach(function (b) { if (!b.classList.contains('drawerclose'))
                b.setAttribute('aria-pressed', String(self._drawer)); });
            if (this._drawer) {
                this._setTab('route');
                this._renderList();
                // Open at the waypoint list (on one column the mission text comes first and fills the screen).
                const pane = this.$('.pane[data-pane=route]'), tb = this.$('.pane[data-pane=route] .toolbar');
                if (pane && tb && pane.scrollHeight > pane.clientHeight)
                    pane.scrollTop += tb.getBoundingClientRect().top - pane.getBoundingClientRect().top - 6;
            }
        }
        _applyFs() {
            const on = !!this._fs, de = document.documentElement;
            this._root.classList.toggle('fs', on);
            this._root.classList.toggle('fs-pseudo', this._fs === 'pseudo');
            if (on)
                this.setAttribute('data-fs', '');
            else
                this.removeAttribute('data-fs');
            // Covering the page by hand: stop it scrolling behind the tool.
            if (this._fs === 'pseudo' && this._pageOverflow == null) {
                this._pageOverflow = de.style.overflow;
                de.style.overflow = 'hidden';
            }
            if (this._fs !== 'pseudo' && this._pageOverflow != null) {
                de.style.overflow = this._pageOverflow;
                this._pageOverflow = null;
            }
            const b = this.$('[data-act=fullscreen]');
            b.setAttribute('aria-pressed', String(on));
            b.title = on ? L('Leave full screen', 'ফুল স্ক্রিন থেকে বের হও') : L('Full screen (turns phones to landscape)', 'ফুল স্ক্রিন (ফোন আড়াআড়ি হয়ে যাবে)');
            b.querySelector('.lbl').textContent = on ? L('Exit full screen', 'বের হও') : L('Full screen', 'ফুল স্ক্রিন');
            if (!on)
                this._setDrawer(false);
            b.querySelector('path').setAttribute('d', on ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
            this._onRootResize();
            // Entering or leaving full screen starts from the framed side view again (_resize3d refits once the size settles).
            this._touched3d = false;
            const self = this;
            setTimeout(function () { self._resize3d(); }, 60);
        }
        _onCellResize(cell) {
            const key = cell.getAttribute('data-cell');
            if (key === '3d')
                this._resize3d();
            else if (key === 'cam')
                this._resizeCam();
            else if (this._views[key])
                this._resizeView(this._views[key]);
        }
        // `height` sets the views; the status bar and the panel (tabs) sit below them.
        _applyHeight() {
            let h = this.getAttribute('height');
            if (h && /^\d+(\.\d+)?$/.test(h))
                h += 'px';
            if (h)
                this._root.style.setProperty('--vh', h);
            else
                this._root.style.removeProperty('--vh');
        }
        _applyTheme() {
            const t = (this.getAttribute('theme') || '').toLowerCase();
            const dark = t === 'dark' || (t !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
            this._root.classList.toggle('dark', dark);
            const cs = getComputedStyle(this._root), c = {};
            ['bg', 'panel', 'fg', 'muted', 'border', 'view-bg', 'grid', 'kiz', 'oasis', 'koz', 'target', 'route', 'bad', 'wp', 'sel', 'robot', 'cam', 'ok', 'cp', 'top']
                .forEach(function (k) { c[k] = cs.getPropertyValue('--' + k).trim() || '#888'; });
            this._c = c;
            this._dark = dark;
            if (this._T) {
                this._build3dStatic();
                this._build3dDynamic();
            }
            this._drawAll();
        }
        _renderLegend() {
            const cfg = this._config;
            this.$('.legend').innerHTML = [
                ['kiz', L('Keep-In', 'কিপ-ইন')], cfg.oasis.length ? ['oasis', L('Oasis', 'ওয়েসিস')] : null, ['koz', L('Keep-Out', 'কিপ-আউট')], ['target', cfg.checkpoints.length ? L('AR marker', 'AR মার্কার') : L('Target', 'টার্গেট')],
                cfg.checkpoints.length ? ['cp', L('Checkpoint', 'চেকপয়েন্ট')] : null, cfg.checkpoints.length ? ['top', L('Robot top (+Z)', 'রোবটের ওপরের দিক (+Z)')] : null,
                ['route', L('Clear move', 'খোলা পথ')], ['bad', L('Blocked', 'আটকানো পথ')], ['wp', L('Waypoint', 'ওয়েপয়েন্ট')]
            ].filter(Boolean).map(function (p) { return '<span><i style="background:var(--' + p[0] + ')"></i>' + p[1] + '</span>'; }).join('');
        }
    }

    /* ---------- small views on top of 3D: the camera picture, and in Drive the robot's position ---------- */
    class Insets {
        _sizeCanvas(cv, w, h) {
            const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
            if (cv.width !== W || cv.height !== H) {
                cv.width = W;
                cv.height = H;
            }
            cv.style.height = h + 'px';
            const ctx = cv.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return ctx;
        }
        _drawInsets() {
            const wrap = this.$('.insets');
            if (!wrap || !this._c)
                return;
            // Over 3D: the camera picture (and the position map while driving). Over the Camera view while
            // driving: just the position map.
            const view = this._ui.view, camDrive = view === 'cam' && !!this._drive;
            const cell = this.$('.cell[data-cell="' + (camDrive ? 'cam' : '3d') + '"]');
            if (wrap.parentNode !== cell)
                cell.appendChild(wrap);
            const r = cell.getBoundingClientRect(), quad = view === 'quad';
            // Camera and 3D side by side: both are already on screen, so no small views.
            const fits = view === 'split' ? false : camDrive ? r.width >= 300 && r.height >= 220 : (view === '3d' || quad) && !this._no3d && r.width >= 300 && r.height >= 220;
            const on = fits && this._ui.pip !== false;
            this.$('[data-inset=cam]').hidden = camDrive;
            wrap.style.display = on ? '' : 'none';
            this.$('[data-act=pipshow]').hidden = !fits || on;
            this._root.classList.toggle('insets-on', on);
            if (!on)
                return;
            const cfg = this._config, cam = cfg.camera, pose = this._robotNow(), rd = Core.readMarkers(cfg, pose);
            let w = this._narrow ? Math.round(Math.max(120, Math.min(170, r.width * 0.4))) : Math.round(Math.max(170, Math.min(340, r.width * (quad ? 0.46 : 0.28))));
            if (this._short)
                w = Math.round(Math.min(w, Math.max(110, (r.height * 0.42 - 24) * cam.width / cam.height)));
            const ch = Math.round(w * cam.height / cam.width);
            this._root.style.setProperty('--iw', w + 'px');
            const camEl = this.$('[data-inset=cam]');
            if (camDrive) {
                const mw = this._narrow ? Math.round(Math.max(120, Math.min(170, r.width * 0.4))) : Math.round(Math.max(170, Math.min(300, r.width * 0.24)));
                this._root.style.setProperty('--iw', mw + 'px');
                const me = this.$('[data-inset=map]');
                me.hidden = false;
                this._drawMiniMap(me, mw, pose);
                return;
            }
            this._paintCamera(this._sizeCanvas(camEl.querySelector('canvas'), w, ch), 0, 0, w / cam.width, pose, rd, { small: true });
            camEl.querySelector('.ih span').textContent = L('Camera · ', 'ক্যামেরা · ') + (rd.seen.length ? L('reads ', 'পড়ছে ') + rd.seen.map(function (m) { return 'ID ' + m.id + ' (' + f2(m.distance) + L(' m)', ' মি)'); }).join(', ') : L('no marker read', 'কোনো মার্কার পড়ছে না'));
            const mapEl = this.$('[data-inset=map]'), showMap = !!this._drive && r.height >= ch + (this._narrow ? 200 : 260);
            mapEl.hidden = !showMap;
            if (showMap)
                this._drawMiniMap(mapEl, w, pose);
        }
        // The robot's position from overhead (like the Top view), with a gauge for overhead / deck.
        _drawMiniMap(el, w, pose) {
            const cfg = this._config, c = this._c, kb = Core.kizBounds(cfg), a = this._analysis;
            const pad = 8, gw = 14, mw = w - pad * 3 - gw, sy = Math.max(0.1, kb.max[1] - kb.min[1]), k = mw / Math.max(0.1, kb.max[0] - kb.min[0]);
            const ky = k, h = Math.round(sy * ky + pad * 2); // true proportions (ky could stretch it across)
            const ctx = this._sizeCanvas(el.querySelector('canvas'), w, h);
            const X = function (p) { return pad + (p[0] - kb.min[0]) * k; }, Y = function (p) { return pad + (p[1] - kb.min[1]) * ky; };
            ctx.fillStyle = c['view-bg'];
            ctx.fillRect(0, 0, w, h);
            cfg.kiz.forEach(function (b) { ctx.fillStyle = c.kiz; ctx.globalAlpha = 0.1; ctx.fillRect(X(b.min), Y(b.min), (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); ctx.globalAlpha = 1; ctx.strokeStyle = c.kiz; ctx.lineWidth = 1; ctx.strokeRect(X(b.min) + 0.5, Y(b.min) + 0.5, (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); });
            cfg.koz.forEach(function (b) { ctx.fillStyle = c.koz; ctx.globalAlpha = 0.45; ctx.fillRect(X(b.min), Y(b.min), (b.max[0] - b.min[0]) * k, (b.max[1] - b.min[1]) * ky); ctx.globalAlpha = 1; });
            const done = {};
            this._mission.goals.forEach(function (g) { if (g.done)
                done[g.id] = 1; });
            cfg.checkpoints.forEach(function (cp) {
                ctx.fillStyle = done[cp.key] ? c.ok : c.cp;
                ctx.beginPath();
                ctx.arc(X(cp.pos), Y(cp.pos), 3, 0, Math.PI * 2);
                ctx.fill();
            });
            cfg.targets.forEach(function (t) { if (!t.pos)
                return; ctx.fillStyle = c.target; ctx.fillRect(X(t.pos) - 2, Y(t.pos) - 2, 4, 4); });
            ctx.strokeStyle = c.route;
            ctx.lineWidth = 1.5;
            a.legs.forEach(function (l) { ctx.strokeStyle = l.clear ? c.route : c.bad; ctx.beginPath(); ctx.moveTo(X(l.from), Y(l.from)); ctx.lineTo(X(l.to), Y(l.to)); ctx.stroke(); });
            this._route.forEach(function (wp) { ctx.fillStyle = wp.via ? c.robot : c.wp; ctx.beginPath(); ctx.arc(X(wp.pos), Y(wp.pos), 2.5, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = c.robot;
            ctx.fillRect(X(cfg.start.pos) - 3, Y(cfg.start.pos) - 3, 6, 6);
            // the robot: a dot with its camera direction
            const rx = X(pose.pos), ry = Y(pose.pos), d = Core.cameraDir(pose.q), hx = d[0] * k, hy = d[1] * ky, m = Math.hypot(hx, hy);
            if (Math.hypot(d[0], d[1]) > 0.1) {
                ctx.strokeStyle = c.cam;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + hx / m * 16, ry + hy / m * 16);
                ctx.stroke();
            }
            ctx.fillStyle = c.sel;
            ctx.beginPath();
            ctx.arc(rx, ry, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // height gauge: overhead at the top, deck at the bottom
            const gx = w - pad - gw, z0 = kb.min[2], z1 = kb.max[2], t = Math.max(0, Math.min(1, (pose.pos[2] - z0) / Math.max(0.01, z1 - z0)));
            ctx.fillStyle = c.border;
            ctx.fillRect(gx + gw / 2 - 2, pad, 4, h - pad * 2);
            ctx.fillStyle = c.sel;
            ctx.fillRect(gx, pad + t * (h - pad * 2) - 2.5, gw, 5);
            ctx.fillStyle = c.muted;
            ctx.font = '9px system-ui,"Noto Sans Bengali",sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('▲', gx + gw / 2, 0);
            ctx.textBaseline = 'bottom';
            ctx.fillText('▼', gx + gw / 2, h);
            el.querySelector('.ih span').textContent = L('Position · x ', 'অবস্থান · x ') + f2(pose.pos[0]) + '  y ' + f2(pose.pos[1]) + '  z ' + f2(pose.pos[2]) + L(' (side bar: overhead at the top, deck at the bottom)', ' (পাশের দাগ: ওপরে ছাদ, নিচে মেঝে)');
        }
    }

    // Copies methods and getters (not the constructor) from a mixin class onto the element class.
    function mixin(target, source) {
        Object.getOwnPropertyNames(source.prototype).forEach(function (name) {
            if (name !== 'constructor')
                Object.defineProperty(target.prototype, name, Object.getOwnPropertyDescriptor(source.prototype, name));
        });
    }

    // Words shown in the panel: goal verbs, orientation modes and the progress milestones.
    const VERB = { target: L('captured', 'ধরা হয়েছে'), pose: L('reached', 'পৌঁছানো হয়েছে'), checkpoint: L('passed', 'পার হয়েছে') };
    const MODE_LABELS = { keep: L('Keep previous', 'আগের দিকই রাখো'), travel: L('Face travel direction', 'যাওয়ার দিকে মুখ'), target: L('Face a target', 'টার্গেটের দিকে মুখ'), custom: L('Custom quaternion', 'নিজের কোয়াটারনিয়ন') };
    const MILESTONES = [
        ['firstWaypoint', L('Add or move a waypoint', 'একটা ওয়েপয়েন্ট যোগ করো বা সরাও')],
        ['droveWaypoint', L('Drive the robot and drop a waypoint', 'রোবট চালিয়ে একটা ওয়েপয়েন্ট বসাও')],
        ['facedTarget', L('Point the camera at a marker ("Face a target")', 'ক্যামেরা একটা মার্কারের দিকে ঘোরাও (“টার্গেটের দিকে মুখ”)')],
        ['fixedBlock', L('Fix a blocked move', 'আটকে যাওয়া একটা পথ ঠিক করো')],
        ['firstCapture', L('Pass your first checkpoint (or capture a target)', 'প্রথম চেকপয়েন্ট পার হও (বা একটা টার্গেট ধরো)')],
        ['allAreas', L('Pass every checkpoint on a clear route', 'বাধাহীন রুটে সব চেকপয়েন্ট পার হও')],
        ['astronaut', L('Complete the whole mission: goal last, within the time limit', 'পুরো মিশন শেষ করো: সবশেষে গোল, সময়সীমার মধ্যে')],
        ['kozPractice', L('Pass a checkpoint with a Keep-Out Zone in place', 'কিপ-আউট জোন বসানো অবস্থায় একটা চেকপয়েন্ট পার হও')],
        ['exportedJava', L('Copy the code (Python or C++)', 'কোড কপি করো (Python বা C++)')],
        ['readMarker', L('Read an AR marker with the robot camera (Camera view)', 'রোবটের ক্যামেরা দিয়ে একটা AR মার্কার পড়ো (ক্যামেরা ভিউ)')]
    ];

    /* ---------- rendering: panel ---------- */
    class Panel {
        _setLang(lang) {
            if (lang !== 'cpp')
                lang = 'python'; // older saves may say "java" or "ar"
            this._ui.lang = lang;
            this.$$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
            this.$$('[data-lang-note]').forEach(function (n) { n.hidden = n.getAttribute('data-lang-note') !== lang; });
            this.$('[data-act=copycode]').textContent = lang === 'cpp' ? L('Copy C++', 'C++ কপি করো') : L('Copy Python', 'Python কপি করো');
            this.$('pre.code').textContent = this.getCode(lang);
        }
        _setTab(tab) {
            if (tab === 'java')
                tab = 'code'; // older saves
            if (['route', 'code', 'world'].indexOf(tab) < 0)
                tab = 'route';
            this._ui.tab = tab;
            this.$$('.tabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab)); });
            this.$$('.pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab; });
        }
        // 'split' (used while driving): the Camera view on the left and 3D on the right (stacked on a phone held upright).
        _setView(v) {
            if (['quad', '3d', 'top', 'side', 'end', 'cam', 'split'].indexOf(v) < 0)
                v = 'quad';
            if (v === '3d' && this._no3d)
                v = 'top';
            if (v === 'split' && this._no3d)
                v = 'cam';
            this._ui.view = v;
            const vp = this.$('.viewport'), shows = function (k) { return k === v || (v === 'split' && (k === 'cam' || k === '3d')); };
            vp.classList.toggle('quad', v === 'quad');
            vp.classList.toggle('split', v === 'split');
            this.$$('.cell').forEach(function (c) { c.classList.toggle('on', shows(c.getAttribute('data-cell'))); });
            this.$$('.views button').forEach(function (b) { b.setAttribute('aria-pressed', String(shows(b.getAttribute('data-view')))); });
            // The view button on a phone held upright names the current view.
            this.$('.viewsbtn .vlbl').textContent = { quad: L('All', 'সব'), '3d': '3D', top: L('Top', 'ওপর'), side: L('Side', 'পাশ'), end: L('End', 'মাথা'), cam: L('Camera', 'ক্যামেরা'), split: L('Camera + 3D', 'ক্যামেরা + 3D') }[v];
            if (shows('cam')) {
                this._camInfoKey = '';
                this._resizeCam();
            }
            if (shows('3d'))
                this._resize3d();
            this._updatePaused();
            this._drawInsets();
        }
        // One view fills the view area: the camera from Play (small camera window) or either view while driving.
        // Driving only works in the split view, so this pauses it; the Back button returns.
        _expandView(which) {
            if (this._expandFrom == null)
                this._expandFrom = this._ui.view;
            this._setView(which);
        }
        _viewBack() {
            const to = this._drive ? 'split' : (this._expandFrom || '3d');
            this._expandFrom = null;
            this._setView(to);
        }
        _updatePaused() {
            const paused = !!this._drive && this._ui.view !== 'split';
            if (paused && this._drive) {
                this._drive.keys = {};
                this._drive.joy = { move: [0, 0], turn: [0, 0] };
                this._drive.hold = {};
            }
            this._root.classList.toggle('drive-paused', paused);
            // An expanded camera is just the picture (the reading is in the readout, or the normal Camera view).
            this._root.classList.toggle('cam-max', this._ui.view === 'cam' && (paused || this._expandFrom != null));
            const b = this.$('.backbtn');
            if (b) {
                b.hidden = !(paused || this._expandFrom != null);
                b.textContent = paused ? L('⤡ Back to driving', '⤡ আবার ড্রাইভে') : L('⤡ Back', '⤡ ফিরে যাও');
            }
            this._layoutDrive();
            if (this._drive)
                this._driveKeysUi();
        }
        _toggleMenu(name) {
            const m = this.$('[data-menu=' + name + ']'), open = m.hidden;
            this._closeMenus();
            if (!open)
                return;
            if (name === 'goto') {
                let cfg = this._config, html = '', inMission = {};
                cfg.mission.forEach(function (id) { inMission[id] = 1; });
                cfg.mission.forEach(function (id) {
                    const c = /^cp/.test(id) && Core.findCheckpoint(cfg, id);
                    if (c)
                        html += '<button data-goto="' + esc(id) + '">' + esc(c.name) + (c.id === cfg.goal ? L(' (goal)', ' (গোল)') : '') + '<small>' + L('Adds a rough pose near it for you to fix', 'এর কাছে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>';
                });
                // Markers only when the mission asks to capture them (older worlds).
                cfg.targets.forEach(function (t) {
                    if (!inMission[t.id] && cfg.checkpoints.length)
                        return;
                    html += '<button data-goto="' + esc(t.id) + '">' + esc(t.name) + '<small>' + L('Adds a rough pose in front of it for you to fix', 'এর সামনে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>';
                });
                if (cfg.poses.length)
                    html += '<div class="sep"></div>';
                cfg.poses.forEach(function (p) { html += '<button data-goto="' + esc(p.id) + '">' + esc(p.name) + '<small>' + L('Adds a rough pose near it for you to fix', 'এর কাছে একটা কাঁচা পোজ বসাবে, তুমি ঠিক করে নেবে') + '</small></button>'; });
                html += '<div class="sep"></div><button data-goto="start">' + esc(cfg.start.name) + '<small>' + L('Back to the start', 'শুরুর জায়গায় ফেরো') + '</small></button>';
                m.innerHTML = html;
            }
            m.hidden = false;
        }
        _closeMenus() {
            this.$$('.menu').forEach(function (m) { m.hidden = true; });
            this._showViews(false);
        }
        // Phone held upright: the view buttons fold into one button, and open as a dropdown under the header.
        _showViews(open) {
            if (!this._root)
                return;
            this._root.classList.toggle('views-open', open);
            this.$('.viewsbtn').setAttribute('aria-expanded', String(open));
        }
        _legHtml(l) {
            const from = l.index === 0 ? this._config.start.name : String(l.index);
            const info = from + ' → ' + (l.index + 1) + ': ' + f2(l.dist) + L(' m', ' মি') + (l.turn > 0.5 ? L(', turn ', ', ঘোরা ') + Math.round(l.turn) + '°' : '') + ', ' + timeText(l.time);
            if (l.clear)
                return '<div class="leg" data-leg="' + l.index + '"><span>' + info + '</span><span class="st">' + L('clear', 'খোলা') + '</span></div>';
            const open = !!this._hints[l.index];
            return '<div class="leg bad" data-leg="' + l.index + '"><span>' + info + '</span><span class="st">' + L('blocked', 'আটকে আছে') + '</span>' +
                '<span>' + L('at the X ', 'X চিহ্নে ') + vecText(l.hit, 2) + ', ' + esc(Core.whyText({ why: l.why, zone: l.zone })) + '</span>' +
                '<button class="btn small" data-act="hint" data-i="' + l.index + '" aria-expanded="' + open + '">' + (open ? L('Hide hint', 'ইঙ্গিত লুকাও') : L('Hint', 'ইঙ্গিত')) + '</button>' +
                '<button class="btn small" data-act="around" data-i="' + l.index + '" data-guided>' + L('Route around it', 'ঘুরে যাওয়ার পথ বানাও') + '</button>' +
                (open ? '<div class="hint">' + esc(Core.blockHint(this._config, this._route, l.index, this._analysis)) + '</div>' : '') + '</div>';
        }
        _qresText(i) {
            let p = this._analysis.poses[i], w = this._route[i], d = Core.cameraDir(p.q), t;
            const yp = Core.yawPitchFromQ(p.q);
            let s = 'q [' + p.q.map(function (n) { return Core.fmt(n, 4); }).join(', ') + ']' + L(' · camera ', ' · ক্যামেরা ') + axisName(d) +
                L(' · heading ', ' · হেডিং ') + Math.round(yp.yaw) + L('°, pitch ', '°, পিচ ') + Math.round(yp.pitch) + L('°, roll ', '°, রোল ') + Math.round(yp.roll) + '°';
            if (w.mode === 'target' && (t = Core.findTarget(this._config, w.target)))
                s += ' · ' + L(f2(Core.dist(p.pos, Core.targetCenter(t))) + ' m from ' + t.name, t.name + ' থেকে ' + f2(Core.dist(p.pos, Core.targetCenter(t))) + ' মি');
            return esc(s);
        }
        _renderList() {
            if (!this._built)
                return;
            const list = this.$('.list'), r = this._route, a = this._analysis, cfg = this._config, self = this, snap = cfg.settings.snap || 0.01;
            if (!r.length) {
                list.innerHTML = '<div class="empty">' + L('The robot starts at the ' + esc(cfg.start.name) + '. Press <b>Drive</b> to fly the robot and drop waypoints, or <b>+ Waypoint</b> (or double-click in the Top, Side or End view) and drag it. Use the mission list above to check each goal.', 'রোবট শুরু করে ' + esc(cfg.start.name) + ' থেকে। রোবট নিজে চালিয়ে ওয়েপয়েন্ট বসাতে <b>ড্রাইভ</b> চাপো, নয়তো <b>+ ওয়েপয়েন্ট</b> চাপো (বা ওপর, পাশ কিংবা মাথার ভিউতে ডাবল-ক্লিক করো), তারপর টেনে জায়গামতো নাও। প্রতিটা লক্ষ্য মিলছে কি না, ওপরের মিশনের তালিকায় দেখে নাও।') + '</div>';
                return;
            }
            let html = '';
            r.forEach(function (w, i) {
                html += self._legHtml(a.legs[i]);
                const st = a.legs[i].endStatus;
                html += '<div class="wp' + (w.via ? ' via' : '') + (i === self._sel ? ' sel' : '') + '" data-i="' + i + '">' +
                    '<div class="wph"><span class="num">' + (i + 1) + '</span><input type="text" data-f="name" value="' + esc(w.name) + '" aria-label="' + L('Waypoint name', 'ওয়েপয়েন্টের নাম') + '">' +
                    '<button class="icon" data-act="up" aria-label="' + L('Move up', 'ওপরে সরাও') + '" title="' + L('Move up', 'ওপরে সরাও') + '">↑</button><button class="icon" data-act="down" aria-label="' + L('Move down', 'নিচে সরাও') + '" title="' + L('Move down', 'নিচে সরাও') + '">↓</button><button class="icon" data-act="del" aria-label="' + L('Delete', 'মুছে ফেলো') + '" title="' + L('Delete', 'মুছে ফেলো') + '">✕</button></div>' +
                    '<div class="xyz">' + AX.map(function (k, j) {
                    return '<label>' + k + '<input type="number" step="' + snap + '" data-f="' + k + '" value="' + Core.round(w.pos[j], 4) + '"></label>';
                }).join('') + '</div>' +
                    '<div class="ori"><select data-f="mode" aria-label="' + L('Orientation', 'দিক') + '">' + Object.keys(MODE_LABELS).map(function (m) {
                    return '<option value="' + m + '"' + (w.mode === m ? ' selected' : '') + '>' + MODE_LABELS[m] + '</option>';
                }).join('') + '</select>' +
                    (w.mode === 'target' ? '<select data-f="target" aria-label="' + L('Target', 'টার্গেট') + '">' + cfg.targets.map(function (t) {
                        return '<option value="' + esc(t.id) + '"' + (w.target === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
                    }).join('') + '</select>' : '') + '</div>' +
                    (w.mode === 'custom' ? '<div class="qin">' + ['qx', 'qy', 'qz', 'qw'].map(function (k, j) {
                        return '<label>' + k + '<input type="number" step="0.01" data-f="q' + j + '" value="' + Core.round((w.q || [0, 0, 0, 1])[j], 4) + '"></label>';
                    }).join('') + '</div>' : '') +
                    '<div class="qres">' + self._qresText(i) + '</div>' +
                    (st.free ? '' : '<div class="warnpt">' + L('This point is ' + esc(Core.whyText(st)) + '.', 'এই পয়েন্টটা ' + esc(Core.whyText(st)) + '।') + '</div>') +
                    '</div>';
            });
            list.innerHTML = html;
        }
        // Update leg lines and orientation text without rebuilding inputs (keeps focus while typing).
        _updateListLive() {
            const self = this, a = this._analysis;
            this.$$('.leg[data-leg]').forEach(function (el) {
                const l = a.legs[+el.getAttribute('data-leg')];
                if (l)
                    el.outerHTML = self._legHtml(l);
            });
            this.$$('.wp[data-i]').forEach(function (card) {
                const i = +card.getAttribute('data-i');
                if (!self._route[i])
                    return;
                const q = card.querySelector('.qres');
                if (q)
                    q.innerHTML = self._qresText(i);
                let st = a.legs[i].endStatus, warn = card.querySelector('.warnpt');
                if (st.free && warn)
                    warn.remove();
                else if (!st.free) {
                    if (!warn) {
                        warn = document.createElement('div');
                        warn.className = 'warnpt';
                        card.appendChild(warn);
                    }
                    warn.textContent = L('This point is ' + Core.whyText(st) + '.', 'এই পয়েন্টটা ' + Core.whyText(st) + '।');
                }
            });
        }
        _renderMission() {
            const m = this._mission, s = this._config.settings, el = this.$('.mission');
            if (!el)
                return;
            el.hidden = !m.total;
            const c = this.$('.mcount');
            c.textContent = L(m.done + ' of ' + m.total + ' done', m.total + 'টার মধ্যে ' + m.done + 'টা হয়েছে');
            c.classList.toggle('all', m.complete);
            const cfg = this._config, cp0 = cfg.checkpoints[0];
            // Difficulty level, and which markers have no checkpoint in this layout (the real game picks 6 to 12 a run).
            const lvEl = this.$('.mlevel');
            lvEl.hidden = !cp0;
            if (cp0) {
                const lv = Core.levelFor(cfg.checkpoints.length), sel = this.$('[data-f=level]'), other = sel.querySelector('[value=other]');
                other.textContent = L('Other · ', 'অন্য · ') + cfg.checkpoints.length;
                sel.value = lv ? lv.key : 'other';
                const has = {}, none = [];
                cfg.checkpoints.forEach(function (k) { has[k.id] = 1; });
                cfg.targets.forEach(function (t) { const n = Core.markerNumber(t); if (n != null && t.pos && !has[n])
                    none.push(n); });
                none.sort(function (a, b) { return a - b; });
                this.$('.mgap').textContent = L(cfg.checkpoints.length + ' checkpoints this run' + (none.length ? '; marker' + (none.length === 1 ? ' ' : 's ') + listText(none) + (none.length === 1 ? ' has' : ' have') + ' none' : '') + '.', 'এই রানে ' + cfg.checkpoints.length + 'টা চেকপয়েন্ট' + (none.length ? '; ' + listText(none) + ' নম্বর মার্কারের কোনো চেকপয়েন্ট নেই' : '') + '।');
            }
            const tail = (this._guided ? L('The starter route has one worked example and three rough waypoints to fix (press Play to see what the camera reads at each); add the rest yourself (Go to… also gives rough drafts).', 'শুরুর রুটে একটা করে দেখানো উদাহরণ আর ঠিক করার জন্য তিনটা কাঁচা ওয়েপয়েন্ট আছে (প্রতিটায় ক্যামেরা কী পড়ে, দেখতে ‘চালাও’ চাপো); বাকিগুলো নিজে যোগ করো (‘যাও…’ থেকেও কাঁচা খসড়া পাবে)।')
                : L('Work out the waypoints yourself.', 'ওয়েপয়েন্টগুলো নিজেই বের করো।')) + L(' This list says what is still wrong.', ' কোথায় কী এখনো ভুল, এই তালিকা বলে দেবে।');
            if (cp0) {
                const bands = function (list, key, unit) { return list.map(function (b) { return 'Lv' + b.level + ' ' + Core.fmt(b[key], 2) + unit; }).join(', '); }, M = L(' m', ' মি');
                const goal = Core.findCheckpoint(cfg, cfg.goal);
                const b1 = bands(cp0.scoreBands, 'radius', M), b2 = bands(cp0.centeringBands, 'angle', '°'), b3 = bands(cp0.rollBands, 'angle', '°'), tl = timeText(cfg.scoring.timeLimit);
                this.$('.mrule').textContent = L('Pass each checkpoint: stand in its sphere (' + b1 + '), keep its AR marker centred in the camera (' + b2 + ') and match its roll about the camera axis (' + b3 + '). The lowest of the three is the level. ' +
                    (goal ? 'Finish at ' + goal.name + ', the goal, ' : 'Finish ') + 'within ' + tl + '. ', 'প্রতিটা চেকপয়েন্ট পার হতে: তার গোলকের ভেতরে দাঁড়াও (' + b1 + '), AR মার্কারটা ক্যামেরার মাঝখানে রাখো (' + b2 + ') আর ক্যামেরার অক্ষ বরাবর তার রোল মেলাও (' + b3 + ')। তিনটার মধ্যে যেটা সবচেয়ে কম, সেটাই লেভেল। ' +
                    'শেষ করতে হবে ' + (goal ? 'গোল ' + goal.name + '-এ, ' : '') + tl + 'ের মধ্যে। ') + tail;
            }
            else {
                const a = Core.fmt(s.aimTolerance, 1), lo = Core.fmt(Math.max(0, s.standoff - s.rangeTolerance), 2), hi = Core.fmt(s.standoff + s.rangeTolerance, 2);
                this.$('.mrule').textContent = L('Capture each target with the camera (+X) within ' + a + '° of its centre, ' + lo + ' to ' + hi + ' m away, on a clear route. ', 'প্রতিটা টার্গেট ক্যামেরা (+X) দিয়ে ধরো: কেন্দ্র থেকে ' + a + '°-এর মধ্যে, ' + lo + ' থেকে ' + hi + ' মি দূর থেকে, বাধাহীন রুটে। ') + tail;
            }
            const sc = m.score, ms = this.$('.mscore');
            ms.hidden = !sc;
            if (sc) {
                const over = sc.inTime ? '' : ' <b class="bad">' + L('(over the limit)', '(সীমা পেরিয়ে গেছে)') + '</b>', ct = Core.fmt(cfg.scoring.checkTime, 1);
                ms.innerHTML = L('Estimated score <b>' + Core.fmt(sc.total, 1) + ' pt</b> = (' + Core.fmt(sc.checkpoints, 1) + ' checkpoints + ' + Core.fmt(sc.goal, 1) + ' goal) × ' +
                    Core.fmt(sc.bonus, 2) + ' time bonus. Mission time about ' + timeText(sc.time) + ' of ' + timeText(sc.limit) + over + ', counting ' + ct + ' s at each checkpoint. A rough guide: the simulator\'s timing and disturbances differ.', 'আনুমানিক স্কোর <b>' + Core.fmt(sc.total, 1) + ' পয়েন্ট</b> = (' + Core.fmt(sc.checkpoints, 1) + ' চেকপয়েন্ট + ' + Core.fmt(sc.goal, 1) + ' গোল) × ' + Core.fmt(sc.bonus, 2) +
                    ' সময়ের বোনাস। মিশনের সময় মোটামুটি ' + timeText(sc.time) + ', সীমা ' + timeText(sc.limit) + over + '; প্রতিটা চেকপয়েন্টে ' + ct + ' সেকেন্ড ধরে। এটা মোটামুটি হিসাব: সিমুলেটরের সময় আর বাধাবিঘ্ন আলাদা হয়।');
            }
            // Full advice for goals the student has started and for the next one; the rest stay short.
            const next = m.goals.filter(function (g) { return !g.done; })[0];
            this.$('ul.goals').innerHTML = m.goals.map(function (g) {
                const msg = g.done || g === next || (g.index >= 0 && g.kind !== 'pose' && !/^(No waypoint|এখনো (এর কাছে )?কোনো ওয়েপয়েন্ট)/.test(g.message)) ? g.message : L('Not started yet.', 'এখনো শুরু হয়নি।');
                return '<li class="' + (g.done ? 'done' : '') + '" data-goal="' + g.index + '"><span>' + (g.done ? '✓' : '○') + '</span><div><b>' + esc(g.name) + '</b><small>' + esc(msg) + '</small></div></li>';
            }).join('');
        }
        _renderStatus() {
            let a = this._analysis, html;
            if (!this._route.length)
                html = '<span class="chip ok">' + L('No moves yet', 'এখনো কোনো পথ নেই') + '</span>';
            else if (a.blocked)
                html = '<span class="chip bad">✕ ' + L(a.blocked + ' move' + (a.blocked === 1 ? '' : 's') + ' blocked', a.blocked + 'টা পথ আটকে আছে') + '</span>';
            else
                html = '<span class="chip ok">✓ ' + L('Route clear', 'রুট বাধাহীন') + '</span>';
            if (this._mission.total)
                html += '<span>' + L('Mission', 'মিশন') + ' <b>' + this._mission.done + '/' + this._mission.total + '</b></span>';
            html += '<span>' + L('Distance', 'দূরত্ব') + ' <b>' + f2(a.distance) + L(' m', ' মি') + '</b></span>';
            const sc = this._mission.score;
            if (sc) {
                html += '<span>' + L('Est. time', 'আনু. সময়') + ' <b' + (sc.inTime ? '' : ' class="chip bad"') + '>' + timeText(sc.time) + '</b>' + L(' of ', ' / ') + timeText(sc.limit) + '</span>';
                html += '<span>' + L('Est. score', 'আনু. স্কোর') + ' <b>' + Core.fmt(sc.total, 1) + L(' pt', ' পয়েন্ট') + '</b></span>';
            }
            else
                html += '<span>' + L('Est. time', 'আনু. সময়') + ' <b>' + timeText(a.time) + '</b></span>';
            if (this._config.oasis.length)
                html += '<span>' + L('In Oasis Zones', 'ওয়েসিস জোনে') + ' <b>' + f2(a.oasis) + L(' m', ' মি') + '</b>' + (a.distance > 0 ? ' (' + Math.round(100 * a.oasis / a.distance) + '%)' : '') + '</span>';
            if (this._play)
                html += '<span data-playinfo>' + esc((this._play.paused ? L('Paused · ', 'থেমে আছে · ') : '') + (this._play.info || '')) + '</span>';
            else if (this._playNote && this._robotPose)
                html += '<span class="chip ' + (this._playEnded === true ? 'ok' : 'bad') + '">' + esc(this._playNote) + '</span>';
            this.$('footer').innerHTML = html;
        }
        _renderWorld() {
            if (!this._built)
                return;
            const s = this._config.settings;
            this.$$('input[data-s]').forEach(function (inp) { inp.value = s[inp.getAttribute('data-s')]; });
            let html = '';
            this._config.koz.forEach(function (z, k) {
                const c = Core.boxCenter(z), sz = Core.boxSize(z);
                html += '<div class="koz"><div class="wph"><input type="text" data-kf="name" data-k="' + k + '" value="' + esc(z.name) + '" aria-label="' + L('KOZ name', 'KOZ-এর নাম') + '">' +
                    '<button class="icon" data-act="delkoz" data-k="' + k + '" aria-label="' + L('Delete KOZ', 'KOZ মুছে ফেলো') + '">✕</button></div>' +
                    '<div class="r"><span>' + L('centre', 'কেন্দ্র') + '</span>' + [0, 1, 2].map(function (j) { return '<input type="number" step="0.05" data-kf="c' + j + '" data-k="' + k + '" value="' + Core.round(c[j], 4) + '" aria-label="' + L('centre ', 'কেন্দ্র ') + AX[j] + '">'; }).join('') + '</div>' +
                    '<div class="r"><span>' + L('size', 'আকার') + '</span>' + [0, 1, 2].map(function (j) { return '<input type="number" step="0.05" min="0.01" data-kf="s' + j + '" data-k="' + k + '" value="' + Core.round(sz[j], 4) + '" aria-label="' + L('size ', 'আকার ') + AX[j] + '">'; }).join('') + '</div></div>';
            });
            this.$('.kozlist').innerHTML = html || '<p class="note">' + L('None. Add one to practise routing around an obstacle.', 'একটাও নেই। বাধা ঘুরে রুট বানানো অনুশীলন করতে একটা যোগ করো।') + '</p>';
            this._renderJson();
        }
        _renderJson() {
            const ta = this.$('textarea.json');
            if (this.shadowRoot.activeElement !== ta)
                ta.value = JSON.stringify(this._config, null, 2);
        }
        _renderSaves() {
            if (!this._built)
                return;
            const self = this;
            this.$('[data-autosave]').textContent = this._storageOk === false
                ? L('This browser is blocking storage, so nothing is saved automatically. Use "Download backup" to keep your work.', 'এই ব্রাউজার স্টোরেজ আটকে রেখেছে, তাই কিছুই নিজে থেকে সেভ হবে না। কাজ রেখে দিতে ‘ব্যাকআপ ডাউনলোড করো’ ব্যবহার করো।')
                : L('Your route, world and progress save automatically in this browser', 'তোমার রুট, ওয়ার্ল্ড আর অগ্রগতি এই ব্রাউজারে নিজে থেকেই সেভ হয়') + (this.id ? ' (key "' + this._key + '")' : '') + L('.', '।');
            this.$('.savelist').innerHTML = this._saves.length ? this._saves.map(function (s, k) {
                let when = '';
                // In Bangla: "21 অক্টোবর 2026, 13:50" (the sandbox's digits and a 24-hour clock; the locale's own format adds AM/PM in English)
                try {
                    const d = new Date(s.savedAt), two = function (n) { return (n < 10 ? '0' : '') + n; };
                    when = lang() === 'bn' ? d.getDate() + ' ' + d.toLocaleDateString('bn-BD', { month: 'long' }) + ' ' + d.getFullYear() + ', ' + two(d.getHours()) + ':' + two(d.getMinutes()) : d.toLocaleString();
                }
                catch (e) { /* keep empty */ }
                const n = Array.isArray(s.route) ? s.route.length : 0;
                return '<div class="saveitem"><div><b>' + esc(s.name) + '</b><small>' + L(n + ' waypoint' + (n === 1 ? '' : 's'), n + 'টা ওয়েপয়েন্ট') + (when ? ' · ' + esc(when) : '') + '</small></div>' +
                    '<button class="btn small" data-act="loadsave" data-k="' + k + '">' + L('Load', 'লোড করো') + '</button><button class="icon" data-act="delsave" data-k="' + k + '" aria-label="' + L('Delete save', 'সেভ মুছে ফেলো') + '">✕</button></div>';
            }).join('') : '<p class="note">' + L('No saved routes yet.', 'এখনো কোনো রুট সেভ করা হয়নি।') + '</p>';
            this.$('ul.progress').innerHTML = MILESTONES.map(function (m) {
                const done = !!self._progress[m[0]];
                return '<li class="' + (done ? 'done' : '') + '"><span>' + (done ? '✓' : '○') + '</span>' + esc(m[1]) + '</li>';
            }).join('');
        }
        _toast(msg) {
            const t = this.$('.toast');
            if (!t)
                return;
            t.querySelector('.tmsg').textContent = msg;
            t.classList.add('on');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(function () { t.classList.remove('on'); }, Math.min(9000, 2500 + msg.length * 45));
        }
        _copy(text) {
            const self = this;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(function () { self._toast(L('Copied.', 'কপি হয়েছে।')); }, function () { self._copyFallback(text); });
            }
            else
                this._copyFallback(text);
        }
        _copyFallback(text) {
            let ta = document.createElement('textarea'), ok = false;
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            this.shadowRoot.appendChild(ta);
            ta.select();
            try {
                ok = document.execCommand('copy');
            }
            catch (e) {
                ok = false;
            }
            ta.remove();
            this._toast(ok ? L('Copied.', 'কপি হয়েছে।') : L('Copy failed. Select the text and copy it yourself.', 'কপি করা গেল না। লেখাটা সিলেক্ট করে নিজে কপি করো।'));
        }
    }

    /* ---------- playback ---------- */
    class Playback {
        _togglePlay() { if (this._play)
            this._stopPlay();
        else if (this._playEnded)
            this._exitPlay();
        else
            this._startPlay(); }
        _startPlay() {
            if (this._drive)
                this._toggleDrive(false);
            this._clearStop();
            const a = this._analysis;
            if (!a.legs.length) {
                this._toast(L('Add some waypoints first.', 'আগে কয়েকটা ওয়েপয়েন্ট যোগ করো।'));
                return;
            }
            const self = this, mult = +this.$('select[data-f=speed]').value || 2;
            // Fly the clear moves in order. The robot never starts a blocked move: it waits at the
            // waypoint before it, and later moves are not flown.
            // After each move into a named waypoint the robot holds for a moment and reads the AR markers,
            // as a demo of what a program sees there.
            let legs = [], blocked = null, HOLD = 2.4;
            for (let i = 0; i < a.legs.length; i++) {
                if (!a.legs[i].clear) {
                    blocked = a.legs[i];
                    break;
                }
                legs.push({ l: a.legs[i], dur: Math.max(0.05, a.legs[i].time) }); // flown at the current speed (it can change mid-play)
                if (!this._route[i].via)
                    legs.push({ l: a.legs[i], dur: HOLD, hold: true });
            }
            // Watch through the robot camera (left) and the 3D view (right); the previous view comes back after.
            if (this._ui.view !== 'split' && !this._no3d) {
                this._playViewBefore = this._ui.view;
                this._setView('split');
            }
            // 3 s of "Initializing" (a boot log made from the real world and route) with the robot at the start,
            // then it flies (t0 is when it starts moving).
            // k / t: the leg being flown and how far into it (seconds at 1×; holds always take HOLD real seconds).
            this._play = { legs: legs, t0: performance.now() + 3000, info: '', said: {}, bootLines: this._bootLog(legs.length, blocked, mult), boot: 0, mult: mult, k: 0, t: 0, last: 0, paused: false };
            this._robotPose = { pos: a.legs[0].from, q: a.legs[0].qFrom };
            const nwp = this._route.filter(function (w) { return !w.via; }).length;
            this._log(L('▶ Play at ' + mult + '× · ' + nwp + ' waypoints', '▶ ' + mult + '× গতিতে চালানো · ' + nwp + 'টা ওয়েপয়েন্ট'), 'head');
            this.$('[data-act=play]').textContent = L('■ Stop', '■ বন্ধ করো');
            this._playBtns();
            const step = function (now) {
                const pl = self._play;
                if (!pl)
                    return;
                if (pl.paused) {
                    pl.raf = requestAnimationFrame(step);
                    return;
                }
                let t = (now - pl.t0) / 1000;
                if (t < 0) {
                    // One more boot line about every 0.4 s, the first straight away.
                    const n = Math.min(pl.bootLines.length, 1 + Math.floor((3 + t) / (2.8 / pl.bootLines.length)));
                    if (n !== pl.boot) {
                        if (!pl.boot) {
                            pl.info = L('Initializing…', 'চালু হচ্ছে…');
                            const ce = self.$('[data-playinfo]');
                            if (ce)
                                ce.textContent = pl.info;
                            else
                                self._renderStatus();
                            self._drawAll();
                            self._place3dRobot();
                        }
                        pl.boot = n;
                        self._bootScreen(pl.bootLines.slice(0, n));
                    }
                    pl.raf = requestAnimationFrame(step);
                    return;
                }
                if (pl.boot) {
                    pl.boot = 0;
                    pl.last = pl.t0;
                    self._bootScreen(null);
                }
                let dt = Math.min(0.25, (now - pl.last) / 1000); // a hidden tab pauses the frames; don't jump ahead
                pl.last = now;
                while (dt > 0 && pl.k < legs.length) {
                    const rate = legs[pl.k].hold ? 1 : pl.mult, need = (legs[pl.k].dur - pl.t) / rate;
                    if (dt >= need) {
                        dt -= need;
                        pl.k++;
                        pl.t = 0;
                    }
                    else {
                        pl.t += dt * rate;
                        dt = 0;
                    }
                }
                const k = pl.k;
                t = pl.t;
                // Log every step reached since the last frame, in order: at high speed a short move can start and
                // end between two frames, and it still gets its line (before "Route done" when it was the last one).
                for (let j = 0; j <= Math.min(k, legs.length - 1); j++) {
                    if (pl.said[j])
                        continue;
                    pl.said[j] = 1;
                    const S = legs[j];
                    if (S.hold)
                        self._logReading(S.l.index);
                    else if (!self._route[S.l.index].via)
                        self._log(L('→ waypoint ', '→ ওয়েপয়েন্ট ') + (S.l.index + 1) + ' · ' + self._route[S.l.index].name);
                }
                if (k >= legs.length) {
                    if (!blocked) {
                        const last = legs[legs.length - 1].l, m = self._mission;
                        self._robotPose = { pos: last.to, q: last.qTo };
                        self._log(L('■ Route done · mission ', '■ রুট শেষ · মিশন ') + m.done + '/' + m.total + (m.score ? L(' · est. ', ' · আনু. ') + Core.fmt(m.score.total, 1) + L(' pt', ' পয়েন্ট') : ''), 'ok');
                        self._stopPlay(true);
                        return;
                    }
                    const n = blocked.index + 1, at = blocked.index === 0 ? self._config.start.name : L('waypoint ', 'ওয়েপয়েন্ট ') + blocked.index, why = Core.whyText({ why: blocked.why, zone: blocked.zone });
                    self._robotPose = { pos: blocked.from, q: blocked.qFrom };
                    self._stopPlay('blocked', L('Waiting at ' + at + ': move ' + n + ' is blocked', at + '-এ অপেক্ষা করছে: ' + n + ' নম্বর পথ আটকে আছে'));
                    self._log(L('■ Stopped at ' + at + ': move ' + n + ' is blocked (' + why + ')', '■ ' + at + '-এ থেমেছে: ' + n + ' নম্বর পথ আটকে আছে (' + why + ')'), 'bad');
                    self._toast(L('Move ' + n + ' is blocked. See the log.', n + ' নম্বর পথ আটকে আছে। লগ দেখো।'));
                    return;
                }
                const P = legs[k], lg = P.l, f = P.hold ? 1 : Math.min(1, t / P.dur);
                self._robotPose = { pos: Core.lerp(lg.from, lg.to, f), q: Core.qSlerp(lg.qFrom, lg.qTo, f) };
                const info = P.hold ? L('Reading markers at waypoint ' + (lg.index + 1), 'ওয়েপয়েন্ট ' + (lg.index + 1) + '-এ মার্কার পড়ছে') : L('Playing move ' + (lg.index + 1) + '/' + a.legs.length, 'পথ ' + (lg.index + 1) + '/' + a.legs.length + ' চলছে');
                if (info !== self._play.info) {
                    self._play.info = info;
                    const el = self.$('[data-playinfo]');
                    if (el)
                        el.textContent = info;
                    else
                        self._renderStatus();
                }
                self._drawAll();
                self._place3dRobot();
                self._play.raf = requestAnimationFrame(step);
            };
            this._renderStatus();
            this._play.raf = requestAnimationFrame(step);
        }
        // finished: true (route done) or 'blocked' (stopped before a blocker): the Play view and the robot's
        // last pose stay until the student presses Exit play (the robot pose also clears when the route
        // changes or something is selected). Falsy: stopped by the user, so it exits straight away.
        _stopPlay(finished, note) {
            if (!this._play)
                return;
            if (!finished)
                this._log(L('■ Play stopped', '■ চালানো বন্ধ'));
            cancelAnimationFrame(this._play.raf);
            this._play = null;
            this._bootScreen(null);
            this._playEnded = finished || 'stopped';
            if (!finished) {
                this._exitPlay();
                return;
            }
            this._playBtns();
            this._playNote = finished === 'blocked' ? note : L('Route done', 'রুট শেষ');
            const b = this.$('[data-act=play]');
            if (b)
                b.textContent = L('✕ Exit play', '✕ বের হও');
            if (this._built) {
                this._renderStatus();
                this._drawAll();
                this._place3dRobot();
            }
        }
        // Leave a finished Play: back to the view from before it, with the robot at the route's start.
        _exitPlay() {
            if (!this._playEnded)
                return;
            this._playEnded = null;
            this._playNote = '';
            this._robotPose = null;
            this._playBtns();
            const b = this.$('[data-act=play]');
            if (b)
                b.textContent = L('▶ Play', '▶ চালাও');
            const v = this._playViewBefore;
            this._playViewBefore = null;
            if (v && this._ui.view === 'split' && !this._drive)
                this._setView(v);
            if (this._built) {
                this._renderStatus();
                this._drawAll();
                this._place3dRobot();
            }
        }
        // Pause or resume Play (Initializing too); its clocks move on by the time spent paused.
        _pausePlay(on) {
            const pl = this._play;
            if (!pl || pl.paused === on)
                return;
            const now = performance.now();
            if (on)
                pl.pausedAt = now;
            else {
                const d = now - pl.pausedAt;
                pl.t0 += d;
                pl.last += d;
            }
            pl.paused = on;
            this._log(on ? L('❚❚ Paused', '❚❚ থামানো হলো') : L('▶ Resumed', '▶ আবার চলছে'));
            this._playBtns();
            const el = this.$('[data-playinfo]');
            if (el)
                el.textContent = (on ? L('Paused · ', 'থেমে আছে · ') : '') + pl.info;
        }
        // Fly the route again from the start, keeping the view to return to on Exit play.
        _replay() {
            if (!this._playEnded)
                return;
            this._playEnded = null;
            this._playNote = '';
            this._robotPose = null;
            this._startPlay();
            this._playBtns();
        }
        // Pause while playing; Play again next to Exit play once it has ended.
        _playBtns() {
            const b = this.$('[data-act=pause]'), pl = this._play, again = this.$('[data-act=replay]');
            const ended = this._playEnded === true || this._playEnded === 'blocked';
            if (again)
                again.hidden = !ended;
            this._root.classList.toggle('playing', !!pl || ended);
            if (!b)
                return;
            const paused = !!(pl && pl.paused);
            b.hidden = !pl;
            const lbl = paused ? L('Resume', 'চালিয়ে যাও') : L('Pause', 'থামাও');
            b.innerHTML = (paused ? '▶' : '❚❚') + '<span class="plbl"> ' + lbl + '</span>';
            b.setAttribute('aria-label', lbl);
            b.setAttribute('aria-pressed', String(paused));
        }
        // The "Initializing" log shown before Play flies: real numbers from the world and route, dressed up
        // as a robot boot. Each line is [status, text]; status is ok, warn or run.
        _bootLog(clear, blocked, mult) {
            const cfg = this._config, a = this._analysis, m = this._mission, p = cfg.start.pos;
            const wps = this._route.filter(function (w) { return !w.via; }).length;
            const lines = [
                ['ok', 'world ' + cfg.name],
                ['ok', 'robot ' + cfg.robot.name + ' · Ø ' + f2(cfg.robot.size) + ' m · clearance ' + f2(cfg.settings.clearance) + ' m'],
                ['ok', '/camera_main ' + cfg.camera.width + '×' + cfg.camera.height + ' · ' + cfg.targets.length + ' AR markers indexed'],
                ['ok', 'localization locked at ' + cfg.start.name + ' (' + p.map(f2).join(', ') + ')'],
                ['ok', 'mission ' + m.total + ' goals · route ' + wps + ' waypoints · ' + f2(a.distance) + ' m · est. ' + timeText(a.time)]
            ];
            lines.push(blocked ? ['warn', 'path check: move ' + (blocked.index + 1) + ' blocked, flying ' + clear + ' of ' + a.legs.length]
                : ['ok', 'path check: ' + a.legs.length + '/' + a.legs.length + ' moves clear']);
            lines.push(['run', 'starting flight from ' + cfg.start.name + ' at ' + mult + '×']);
            return lines;
        }
        _bootScreen(lines) {
            const el = this.$('.boot');
            if (!el)
                return;
            el.classList.toggle('on', !!lines);
            if (!lines) {
                el.innerHTML = '';
                return;
            }
            // Only add the new lines: rebuilding the panel would replay every line's slide-in (a flicker).
            const tag = { ok: '<span class="ok">[  OK  ]</span> ', warn: '<span class="warn">[ WARN ]</span> ', run: '<span class="mut">[  ..  ]</span> ' };
            let bp = el.querySelector('.bp');
            if (!bp) {
                el.innerHTML = '<div class="bp"><div class="bt"><i></i>INITIALIZING</div></div>';
                bp = el.querySelector('.bp');
            }
            const shown = bp.querySelectorAll('.bl'), cur = bp.querySelector('.cur');
            if (shown.length >= lines.length)
                return;
            if (cur)
                cur.classList.remove('cur');
            for (let i = shown.length; i < lines.length; i++) {
                const d = document.createElement('div');
                d.className = 'bl' + (i === lines.length - 1 ? ' cur' : '');
                d.innerHTML = tag[lines[i][0]] + esc(lines[i][1]);
                bp.appendChild(d);
            }
        }
        // Log what the robot camera reads at waypoint i and whether its checkpoint passes (Play, at each stop).
        _logReading(i) {
            const cfg = this._config, rd = Core.readMarkers(cfg, this._analysis.poses[i]), self = this;
            if (!rd.seen.length)
                this._log(L('[AR] no marker', '[AR] কোনো মার্কার নেই') + (rd.missed.length ? ' · ' + rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why : ''), 'warn');
            rd.seen.forEach(function (m) { self._log('[AR] ID ' + m.id + ' · ' + f2(m.distance) + L(' m · ', ' মি · কেন্দ্র থেকে ') + Math.round(m.offCentre) + L('° off centre', '° সরে'), 'ar'); });
            const g = this._mission.goals.filter(function (x) { return x.kind === 'checkpoint' && x.index === i; })[0];
            if (!g)
                return;
            if (g.done) {
                this._log(g.name + L(' passes at Lv' + g.level, ' Lv' + g.level + '-এ পার হয়'), 'ok');
                return;
            }
            // Say what is off, by how much, so the student knows what to fix (rough drafts fail on purpose).
            const cp = Core.findCheckpoint(cfg, g.id), ck = cp && Core.checkpointCheck(cfg, cp, this._analysis.poses[i]), why = [];
            const outer = function (bands, key) { return bands.length ? bands[bands.length - 1][key] : null; };
            const r1 = outer(cp.scoreBands, 'radius'), m = function (v) { return Core.fmt(v, Math.abs(v - r1) < 0.01 ? 3 : 2); };
            if (ck && !ck.levels.pos)
                why.push(L(m(ck.dist) + ' m from centre (Lv1 ≤ ' + m(r1) + ' m)', 'কেন্দ্র থেকে ' + m(ck.dist) + ' মি (Lv1 ≤ ' + m(r1) + ' মি)'));
            if (ck && !ck.levels.centering)
                why.push(L('marker ' + Math.round(ck.centering) + '° off centre (Lv1 ≤ ', 'মার্কার কেন্দ্র থেকে ' + Math.round(ck.centering) + '° সরে (Lv1 ≤ ') + outer(cp.centeringBands, 'angle') + '°)');
            if (ck && !ck.levels.roll)
                why.push(L('roll ' + Math.round(Math.abs(ck.roll)) + '° off (Lv1 ≤ ' + outer(cp.rollBands, 'angle') + '°), press ' + (ck.roll > 0 ? '⟲' : '⟳'), 'রোল ' + Math.round(Math.abs(ck.roll)) + '° সরে আছে (Lv1 ≤ ' + outer(cp.rollBands, 'angle') + '°), ' + (ck.roll > 0 ? '⟲' : '⟳') + ' চাপো'));
            this._log(g.name + L(' not passed', ' পার হয়নি') + (why.length ? ' · ' + why.join(' · ') : ''), 'warn');
        }
        // What the robot camera reads at waypoint i, in one line (Play shows it at each stop).
        _readingText(i) {
            const cfg = this._config, pose = this._analysis.poses[i], w = this._route[i], rd = Core.readMarkers(cfg, pose);
            let s = L('Waypoint ', 'ওয়েপয়েন্ট ') + (i + 1) + ' (' + w.name + '): ';
            const dot = L('.', '।');
            if (!rd.seen.length)
                return s + L('the camera reads no marker', 'ক্যামেরা কোনো মার্কার পড়ছে না') + (rd.missed.length ? ' (' + rd.missed[0].name.split(' ')[0] + ' ' + rd.missed[0].why + ')' : '') + dot;
            s += L('camera reads ', 'ক্যামেরা পড়ছে ') + rd.seen.map(function (m) { return L('ID ' + m.id + ' at ' + f2(m.distance) + ' m, ' + Math.round(m.offCentre) + '° off centre', 'ID ' + m.id + ', ' + f2(m.distance) + ' মি দূরে, কেন্দ্র থেকে ' + Math.round(m.offCentre) + '° সরে'); }).join('; ');
            const g = this._mission.goals.filter(function (x) { return x.kind === 'checkpoint' && x.index === i; })[0];
            if (g)
                s += ' · ' + g.name + (g.done ? L(' passes at Lv' + g.level, ' Lv' + g.level + '-এ পার হয়') : L(' not passed yet', ' এখনো পার হয়নি'));
            return s + dot;
        }
        // Where to draw the robot: playback pose, else the selected waypoint, else the start.
        _robotNow() {
            if (this._drive)
                return this._drivePose();
            if (this._robotPose)
                return this._robotPose;
            if (this._sel >= 0 && this._analysis.poses[this._sel])
                return this._analysis.poses[this._sel];
            return { pos: this._config.start.pos, q: Core.qNorm(this._config.start.q) };
        }
    }

    /* ---------- route actions ---------- */
    class RouteActions {
        _snap(v) {
            const s = this._config.settings.snap;
            return s > 0 ? Core.round(Math.round(v / s) * s, 4) : Core.round(v, 4);
        }
        // Short labels keep the views readable: a marker that has a checkpoint is already labelled by it.
        _targetLabel(t) {
            const cfg = this._config;
            if (!t.pos || cfg.mission.indexOf(t.id) >= 0)
                return t.name;
            if (cfg.checkpoints.some(function (cp) { return cp.marker && Core.dist(cp.marker, t.pos) < 0.05; }))
                return '';
            return t.name.split(' ')[0];
        }
        _nearestTarget(p) {
            let best = '', bd = Infinity;
            this._config.targets.forEach(function (t) { const d = Core.dist(p, Core.targetCenter(t)); if (d < bd) {
                bd = d;
                best = t.id;
            } });
            return best;
        }
        _select(i, scroll) {
            this._clearStop();
            this._sel = i;
            if (this._drive && this._analysis.poses[i])
                this._driveTo(this._analysis.poses[i]);
            this.$$('.wp').forEach(function (c) { c.classList.toggle('sel', +c.getAttribute('data-i') === i); });
            if (scroll) {
                const card = this.$('.wp[data-i="' + i + '"]'), list = this.$('.list'), pane = this.$('.pane[data-pane=route]');
                const box = list && list.scrollHeight > list.clientHeight + 1 ? list : pane; // two columns: the list scrolls
                if (card && box) {
                    const cr = card.getBoundingClientRect(), br = box.getBoundingClientRect();
                    if (cr.top < br.top || cr.bottom > br.bottom)
                        box.scrollTop += cr.top - br.top - 40;
                }
            }
            this._drawAll();
            if (this._T)
                this._build3dDynamic();
        }
        _addWaypoint(at) {
            const self = this, cfg = this._config;
            const idx = this._sel >= 0 ? this._sel + 1 : this._route.length;
            const basePos = this._sel >= 0 ? this._route[this._sel].pos : (this._route.length ? this._route[this._route.length - 1].pos : cfg.start.pos);
            let p = at || Core.nearestFree(cfg, Core.add(basePos, [0, 0.3, 0])) || basePos;
            p = p.map(function (v) { return self._snap(v); });
            const n = this._route.filter(function (w) { return !w.via; }).length + 1;
            this._edit(function () {
                self._route.splice(idx, 0, { name: L('Waypoint ', 'ওয়েপয়েন্ট ') + n, pos: p, mode: 'keep' });
                self._sel = idx;
            });
            this._select(idx, true);
        }
        _move(i, d) {
            const j = i + d, self = this;
            if (j < 0 || j >= this._route.length)
                return;
            this._edit(function () { const r = self._route, tmp = r[i]; r[i] = r[j]; r[j] = tmp; self._sel = j; });
        }
        _goTo(id) {
            const self = this, res = Core.appendGoTo(this._config, this._route, id);
            const wp = res.route[res.route.length - 1];
            this._edit(function () { self._route = res.route; self._sel = res.route.length - 1; }, { reason: res.routed ? 'fixed' : 'edit' });
            this._select(this._route.length - 1, true);
            const what = L('a rough pose for ' + wp.name, wp.name + '-এর জন্য একটা কাঁচা পোজ'), fix = L(' It is close but not right: use the Mission list to see what to fix.', ' এটা কাছাকাছি, তবে ঠিক নয়: কী ঠিক করতে হবে, মিশনের তালিকায় দেখো।');
            if (!res.ok)
                this._toast(L('Added ' + what + ', but the move is blocked: ', what + ' যোগ হয়েছে, কিন্তু পথটা আটকে আছে: ') + res.message);
            else if (res.routed)
                this._toast(L('Added ' + what + ', with ' + res.added + ' via point' + (res.added === 1 ? '' : 's') + ' around a blocked move.', what + ' যোগ হয়েছে; আটকে থাকা পথ এড়াতে মাঝপথে আরও ' + res.added + 'টা পয়েন্ট বসেছে।') + fix);
            else
                this._toast(L('Added ' + what + '.', what + ' যোগ হয়েছে।') + fix);
        }
        _routeAround(i) {
            const self = this, res = Core.routeAround(this._config, this._route, i);
            if (!res.ok) {
                this._toast(L('Could not route around it: ', 'ঘুরে যাওয়ার পথ পাওয়া গেল না: ') + res.message);
                return;
            }
            this._edit(function () { self._route = res.route; }, { reason: 'fixed' });
            this._toast(L('Added ' + res.added + ' via point' + (res.added === 1 ? '' : 's') + ' to go around it.', 'ঘুরে যেতে মাঝপথে ' + res.added + 'টা পয়েন্ট বসানো হয়েছে।'));
        }
        _fixAll() {
            if (!this._analysis.blocked && this._analysis.legs.every(function (l) { return l.endStatus.free; })) {
                this._toast(L('Nothing to fix: every move is clear.', 'ঠিক করার কিছু নেই: সব পথই খোলা।'));
                return;
            }
            const self = this, res = Core.fixRoute(this._config, this._route);
            this._edit(function () { self._route = res.route; }, { reason: res.fixed ? 'fixed' : 'edit' });
            const left = this._analysis.blocked;
            const msg = (res.fixed ? L('Routed around ' + res.fixed + ' blocked move' + (res.fixed === 1 ? '' : 's') + '. ', 'আটকে থাকা ' + res.fixed + 'টা পথ ঘুরিয়ে দেওয়া হয়েছে। ') : '') + res.messages.join(' ');
            this._toast((msg || L('Done.', 'হয়ে গেছে।')) + (left ? L(' ' + left + ' still blocked.', ' এখনো ' + left + 'টা আটকে আছে।') : ''));
        }
        _doUndo() {
            if (!this._undo.length) {
                this._toast(L('Nothing to undo.', 'ফেরানোর মতো কিছু নেই।'));
                return;
            }
            this._route = JSON.parse(this._undo.pop());
            this._sel = Math.min(this._sel, this._route.length - 1);
            this._commit({ reason: 'undo' });
        }
    }

    // localStorage, never throwing (private mode or blocked storage just means nothing is kept).
    const STORE_PREFIX = 'kibo-nav-sandbox:';
    function storeGet(key) { try {
        const s = window.localStorage.getItem(key);
        return s ? JSON.parse(s) : null;
    }
    catch (e) {
        return null;
    } }
    function storeSet(key, val) { try {
        window.localStorage.setItem(key, JSON.stringify(val));
        return true;
    }
    catch (e) {
        return false;
    } }
    function storeDel(key) { try {
        window.localStorage.removeItem(key);
    }
    catch (e) { /* storage blocked */ } }

    /* ---------- saves, backup, progress ---------- */
    class Saves {
        _openSaves() {
            this._overlayOpen = true;
            this.$('.overlay').hidden = false;
            this._renderSaves();
            // The tool is taller than the screen: put the dialog in the part of it that is on screen.
            const r = this._root.getBoundingClientRect(), d = this.$('.dialog'), vh = window.innerHeight || 800;
            d.style.maxHeight = Math.max(240, Math.min(vh, r.height) - 24) + 'px';
            d.style.marginTop = Math.max(0, Math.min(r.height - d.offsetHeight - 24, -r.top)) + 'px';
            try {
                d.scrollIntoView({ block: 'nearest' });
            }
            catch (e) { /* old browsers */ }
            const n = this.$('input[data-f=savename]');
            if (n && !this._narrow)
                n.focus();
        }
        _closeSaves() { this._overlayOpen = false; this.$('.overlay').hidden = true; }
        _saveNamed() {
            const inp = this.$('input[data-f=savename]'), name = inp.value.trim() || (L('Save ', 'সেভ ') + (this._saves.length + 1));
            this._saves.unshift({ name: name, savedAt: new Date().toISOString(), route: Core.copy(this._route), config: Core.copy(this._config) });
            if (this._saves.length > 30)
                this._saves.length = 30;
            inp.value = '';
            this._save();
            this._renderSaves();
            this._toast(L('Saved "' + name + '".', '“' + name + '” সেভ হয়েছে।'));
        }
        _loadNamed(k) {
            const s = this._saves[k];
            if (!s)
                return;
            try {
                const cfg = s.config ? Core.normalizeWorld(s.config) : this._config, route = Core.normalizeRoute(s.route);
                this._pushUndo(JSON.stringify(this._route));
                this._config = cfg;
                this._route = route;
                this._sel = -1;
                this._routeEdited = true;
                this._afterConfig();
                this._emitRoute();
                this._closeSaves();
                this._toast(L('Loaded "' + s.name + '".', '“' + s.name + '” লোড হয়েছে।'));
            }
            catch (ex) {
                this._toast(L('That save is damaged: ', 'এই সেভটা নষ্ট হয়ে গেছে: ') + ex.message);
            }
        }
        _exportFile() {
            const data = { app: 'kibo-nav-sandbox', version: VERSION, exportedAt: new Date().toISOString(), route: this._route, config: this._config, saves: this._saves, progress: this._progress };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'kibo-nav-sandbox-' + new Date().toISOString().slice(0, 10) + '.json';
            this.shadowRoot.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }
        _importFile(file) {
            if (!file)
                return;
            const self = this, rd = new FileReader();
            rd.onload = function () {
                try {
                    let d = JSON.parse(rd.result), cfg = self._config, route = null;
                    if (Array.isArray(d))
                        route = Core.normalizeRoute(d);
                    else if (d && d.kiz)
                        cfg = Core.normalizeWorld(d);
                    else if (d && typeof d === 'object') {
                        if (d.config)
                            cfg = Core.normalizeWorld(d.config);
                        if (d.route)
                            route = Core.normalizeRoute(d.route);
                        if (Array.isArray(d.saves)) {
                            const have = {};
                            self._saves.forEach(function (s) { have[s.name + s.savedAt] = 1; });
                            d.saves.forEach(function (s) { if (s && s.route && !have[s.name + s.savedAt])
                                self._saves.push(s); });
                        }
                        if (d.progress && typeof d.progress === 'object')
                            Object.keys(d.progress).forEach(function (k) { if (!self._progress[k])
                                self._progress[k] = d.progress[k]; });
                    }
                    else
                        throw new Error(L('Not a KIBO RPC 7 Nav Sandbox file', 'এটা KIBO RPC 7 Nav Sandbox-এর ফাইল নয়'));
                    self._pushUndo(JSON.stringify(self._route));
                    self._config = cfg;
                    if (route) {
                        self._route = route;
                        self._routeEdited = true;
                    }
                    self._sel = -1;
                    self._afterConfig();
                    self._emitRoute();
                    self._renderSaves();
                    self._toast(L('Loaded ' + file.name + '.', file.name + ' লোড হয়েছে।'));
                }
                catch (ex) {
                    self._toast(L('Could not load that file: ', 'ফাইলটা লোড করা গেল না: ') + ex.message);
                }
            };
            rd.readAsText(file);
        }
        _wipe(btn) {
            if (!btn.dataset.armed) {
                btn.dataset.armed = '1';
                btn.textContent = L('Click again to delete everything', 'সব মুছতে আবার চাপো');
                setTimeout(function () { delete btn.dataset.armed; btn.textContent = L('Delete all saved data', 'জমা থাকা সব ডেটা মুছে ফেলো'); }, 4000);
                return;
            }
            clearTimeout(this._saveTimer);
            storeDel(this._key);
            this._saves = [];
            this._progress = {};
            this._undo = [];
            this._config = Core.copy(this._base);
            this._route = this._defaultRoute();
            this._sel = -1;
            this._configFromStore = false;
            this._routeEdited = false;
            this._afterConfig({ silent: true });
            this._emitRoute();
            this._renderSaves();
            delete btn.dataset.armed;
            btn.textContent = L('Delete all saved data', 'জমা থাকা সব ডেটা মুছে ফেলো');
            this._toast(L('Deleted all saved data in this browser.', 'এই ব্রাউজারে জমা থাকা সব ডেটা মুছে ফেলা হয়েছে।'));
        }
        _mark(k) {
            if (this._progress[k])
                return;
            this._progress[k] = new Date().toISOString();
            const m = MILESTONES.filter(function (x) { return x[0] === k; })[0];
            this._toast(L('Milestone: ', 'মাইলফলক: ') + (m ? m[1] : k) + ' ✓');
            this._save();
            if (this._overlayOpen)
                this._renderSaves();
        }
        _checkProgress(reason) {
            const a = this._analysis, r = this._route, cfg = this._config, m = this._mission, self = this;
            const prevBlocked = this._lastBlocked, prevDone = this._lastDone || {};
            this._lastBlocked = a.blocked;
            this._lastDone = {};
            m.goals.forEach(function (g) { if (g.done)
                self._lastDone[g.id] = 1; });
            if (!this._userActed || reason === 'example' || reason === 'undo')
                return;
            const fresh = m.goals.filter(function (g) { return g.done && !prevDone[g.id]; });
            if (m.complete && fresh.length)
                this._toast(L('Mission complete: every goal is done on a clear route' + (m.score ? ', estimated ' + Core.fmt(m.score.total, 1) + ' pt' : '') + '. Copy the code and try it in the simulator.', 'মিশন শেষ: বাধাহীন রুটে সব লক্ষ্য পূরণ হয়েছে' + (m.score ? ', আনুমানিক ' + Core.fmt(m.score.total, 1) + ' পয়েন্ট' : '') + '। এবার কোড কপি করে সিমুলেটরে চালিয়ে দেখো।'));
            else if (fresh.length)
                this._toast(fresh.map(function (g) { return g.name + (g.kind === 'checkpoint' ? ' Lv' + g.level : ''); }).join(', ') + ' ' + VERB[fresh[0].kind] + ' ✓  (' + L(m.done + ' of ' + m.total, m.total + 'টার মধ্যে ' + m.done + 'টা') + ')');
            if (r.length)
                this._mark('firstWaypoint');
            if (r.some(function (w) { return w.mode === 'target' && Core.findTarget(cfg, w.target); }))
                this._mark('facedTarget');
            if (reason === 'fixed' || (prevBlocked > 0 && a.blocked < prevBlocked))
                this._mark('fixedBlock');
            const targets = m.goals.filter(function (g) { return g.kind === 'target' || g.kind === 'checkpoint'; });
            if (targets.some(function (g) { return g.done; }))
                this._mark('firstCapture');
            if (a.blocked)
                return;
            if (targets.length && targets.every(function (g) { return g.done; }))
                this._mark('allAreas');
            if (m.complete)
                this._mark('astronaut');
            if (cfg.koz.length && this._sawKozBlock && targets.some(function (g) { return g.done; }))
                this._mark('kozPractice');
        }
        _toggleHint(i) {
            if (this._hints[i])
                delete this._hints[i];
            else
                this._hints[i] = 1;
            const el = this.$('.leg[data-leg="' + i + '"]'), l = this._analysis.legs[i];
            if (el && l)
                el.outerHTML = this._legHtml(l);
        }
    }

    // Opt-in (the page sets the element's center-on-load attribute), on a phone held upright: once the page has
    // loaded, scroll it so the box `part()` gives (in screen coordinates) sits in the middle of the screen (one a
    // little taller than the screen loses the same at both ends), and keep it there for 1.5 s while the page settles:
    // the address bar sliding away changes the screen's height, and the layout can still move. The browser does not
    // put back an earlier scroll position on these pages. A touch, click, scroll or key before then wins. Used by the
    // sandbox .
    function centerOnLoad(el, part) {
        if (!el.hasAttribute('center-on-load') || window.innerHeight <= window.innerWidth)
            return;
        try {
            if ('scrollRestoration' in history)
                history.scrollRestoration = 'manual';
        }
        catch (e) { /* not allowed */ }
        let user = false;
        const stop = function () { user = true; };
        ['touchstart', 'pointerdown', 'wheel', 'keydown'].forEach(function (ev) { window.addEventListener(ev, stop, { once: true, passive: true }); });
        const center = function () {
            const r = part(), y = Math.max(0, Math.round(window.scrollY + r.top - (window.innerHeight - r.height) / 2));
            if (Math.abs(window.scrollY - y) > 1)
                window.scrollTo(0, y);
        };
        const settle = function (t0) {
            if (user)
                return;
            center();
            if (performance.now() - t0 < 1500)
                requestAnimationFrame(function () { settle(t0); });
        };
        const go = function () { settle(performance.now()); };
        if (document.readyState === 'complete')
            requestAnimationFrame(go);
        else
            window.addEventListener('load', go, { once: true });
    }

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
.mvl{display:inline-grid;justify-items:center}\
.mvl>span{grid-area:1/1}\
.mvl>span~span{visibility:hidden}\
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
.root.short .dbtns{gap:3px}\
.root.short .dbtns .btn{padding:0 7px}\
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

    // A key of the computer's key pad: the key, what it does (the tooltip) and its short label.
    function key(code, k, title, label) {
        return '<button data-key="' + code + '" title="' + title + ' (' + k + ')"><b>' + k + '</b><span>' + label + '</span></button>';
    }
    const MENU_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
    // The Shadow DOM markup, in the page's language; the element fills it in.
    function template() {
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
        <p class="note" data-lang-note="python">' + L('For the 7th Kibo-RPC Python template (<code>scripts/user_template.py</code>): paste it between the <code>USER EDIT AREA</code> markers in <code>__run_user_flow()</code>; it is already indented for that spot. One <code>/ctl/command</code> move per waypoint, then <code>/event/checkpoint_passed</code> at each waypoint meant for a checkpoint. The simulator draws new checkpoints every run, so your final program must read them from <code>/mission/get_checkpoints</code> instead of using these numbers. The template is under <code>"exportPython"</code> in the World JSON.', 'সপ্তম Kibo-RPC-র Python টেমপ্লেটের (<code>scripts/user_template.py</code>) জন্য: <code>__run_user_flow()</code>-এর ভেতরে <code>USER EDIT AREA</code> চিহ্ন দুটোর মাঝে পেস্ট করো; ওই জায়গার মাপে ইনডেন্ট করাই আছে। প্রতিটা ওয়েপয়েন্টের জন্য একটা করে <code>/ctl/command</code> মুভ, আর যে ওয়েপয়েন্ট কোনো চেকপয়েন্টের জন্য, সেখানে <code>/event/checkpoint_passed</code>। সিমুলেটর প্রতিবার নতুন চেকপয়েন্ট বানায়, তাই তোমার আসল প্রোগ্রামকে এই সংখ্যাগুলো ব্যবহার না করে <code>/mission/get_checkpoints</code> থেকে চেকপয়েন্ট পড়ে নিতে হবে। টেমপ্লেটটা World JSON-এর <code>"exportPython"</code>-এর ভেতরে আছে।') + '</p>\
        <p class="note" data-lang-note="cpp" hidden>' + L('For the C++14 template (<code>src/user_template_node.cpp</code>), after <code>mission_start</code>. It makes its own Action clients; if your template already has them, use those (and cancel their goals in your <code>/ib2_user/stop</code> handler). The simulator draws new checkpoints every run, so your final program must read them from <code>/mission/get_checkpoints</code>. The template is under <code>"export"</code> in the World JSON.', 'C++14 টেমপ্লেটের (<code>src/user_template_node.cpp</code>) জন্য, <code>mission_start</code>-এর পরে। এটা নিজের Action client বানিয়ে নেয়; তোমার টেমপ্লেটে আগে থেকেই থাকলে সেগুলোই ব্যবহার করো (আর তোমার <code>/ib2_user/stop</code> হ্যান্ডলারে সেগুলোর goal বাতিল করো)। সিমুলেটর প্রতিবার নতুন চেকপয়েন্ট বানায়, তাই আসল প্রোগ্রামকে <code>/mission/get_checkpoints</code> থেকে সেগুলো পড়ে নিতে হবে। টেমপ্লেটটা World JSON-এর <code>"export"</code>-এর ভেতরে আছে।') + '</p>\
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
        <p class="note">' + L('The simulator draws a new layout every run: 6 to 12 checkpoints by difficulty level (Easy, Normal, Hard, Very Hard), goal last. Pick the level above the Mission list. The documents don\'t say how many checkpoints each level has, so the sandbox\'s 6, 8, 10 and 12 are assumed. Practise on a few. To try a layout from your own simulator run, paste the <code>/mission/get_checkpoints</code> message from its log into the World JSON box and press Apply. Each checkpoint\'s margins are in the JSON.', 'সিমুলেটর প্রতিবার নতুন লেআউট বানায়: কঠিনতার লেভেল (Easy, Normal, Hard, Very Hard) অনুযায়ী 6 থেকে 12টা চেকপয়েন্ট, সবশেষে গোল পয়েন্ট। মিশনের তালিকার ওপরে লেভেল বেছে নাও। কোন লেভেলে কয়টা চেকপয়েন্ট থাকে, ডকুমেন্টে তা বলা নেই, তাই স্যান্ডবক্সের 6, 8, 10 আর 12 অনুমান করে নেওয়া। কয়েকটা লেআউটে অনুশীলন করো। নিজের সিমুলেটর রানের লেআউট চালিয়ে দেখতে চাইলে তার লগ থেকে <code>/mission/get_checkpoints</code> মেসেজটা World JSON বক্সে পেস্ট করে ‘প্রয়োগ করো’ চাপো। প্রতিটা চেকপয়েন্টের মার্জিন JSON-এ দেওয়া আছে।') + '</p>\
        <h4>' + L('Target and pose goals', 'টার্গেট আর পোজের লক্ষ্য') + '</h4>\
        <div class="settings three">\
          <label>' + L('Aim within (°)', 'নিশানার সীমা (°)') + '<input type="number" step="1" min="0" data-s="aimTolerance"></label>\
          <label>' + L('Distance ± (m)', 'দূরত্ব ± (মি)') + '<input type="number" step="0.05" min="0" data-s="rangeTolerance"></label>\
          <label>' + L('Pose within (m)', 'পোজের সীমা (মি)') + '<input type="number" step="0.01" min="0" data-s="poseTolerance"></label>\
        </div>\
        <p class="note">' + L('Only for worlds with target or pose goals in their mission (the 7th world uses checkpoints). A target counts as captured when the camera is within the aim angle of its centre and the distance is the standoff ± this value. A pose goal needs the position within the pose distance and the orientation within the aim angle.', 'শুধু সেসব ওয়ার্ল্ডের জন্য, যাদের মিশনে টার্গেট বা পোজের লক্ষ্য আছে (সপ্তম রাউন্ডের ওয়ার্ল্ডে আছে চেকপয়েন্ট)। ক্যামেরা টার্গেটের কেন্দ্র থেকে নিশানার কোণের মধ্যে থাকলে, আর দূরত্ব টার্গেট-দূরত্ব ± এই মানের মধ্যে থাকলে টার্গেট ধরা হয়েছে বলে গোনা হয়। পোজের লক্ষ্যে অবস্থান থাকতে হবে পোজের সীমার মধ্যে, আর দিক থাকতে হবে নিশানার কোণের মধ্যে।') + '</p>\
        <h4>' + L('Keep-Out Zones', 'কিপ-আউট জোন') + '</h4>\
        <button class="btn" data-act="addkoz">' + L('Add a Keep-Out Zone', 'কিপ-আউট জোন যোগ করো') + '</button>\
        <div class="kozlist"></div>\
        <h4>World JSON</h4>\
        <textarea class="json" spellcheck="false" aria-label="World JSON"></textarea>\
        <div class="row"><button class="btn primary" data-act="applyjson">' + L('Apply', 'প্রয়োগ করো') + '</button><button class="btn" data-act="copyworld">' + L('Copy', 'কপি করো') + '</button><button class="btn" data-act="resetworld">' + L('Reset to defaults', 'শুরুর মানে ফেরো') + '</button></div>\
        <div class="err" data-err="json"></div>\
        <p class="note">' + L('Positions are in the <code>iss_body</code> frame, metres, with the Int-Ball2 dock at (0.2, 0, 0); +z points to the deck (worked out from the AR marker orientations). Quaternions are [x, y, z, w]; the camera looks along body +X and body +Z is the robot\'s top. The AR markers and dock come from the 7th Kibo-RPC rulebook. The keep-in box is not published: it is a guess spanning the walls the markers are on.', 'অবস্থানগুলো <code>iss_body</code> ফ্রেমে, মিটারে; Int-Ball2-এর ডক (0.2, 0, 0)-তে, আর +z মেঝের দিকে (AR মার্কারগুলোর দিক থেকে বের করা)। কোয়াটারনিয়ন [x, y, z, w] আকারে; ক্যামেরা বডির +X বরাবর তাকায়, আর বডির +Z রোবটের মাথার দিক। AR মার্কার আর ডকের তথ্য সপ্তম Kibo-RPC-র রুলবুক থেকে নেওয়া। কিপ-ইন বক্স কোথাও প্রকাশ করা হয়নি: মার্কারগুলো যে দেয়ালে আছে, সেগুলো জুড়ে এটা একটা অনুমান।') + '</p>\
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

    /* ---------- setup ---------- */
    class Setup {
        // The first / every element in the Shadow DOM matching `sel` (the template guarantees the parts the code asks for).
        $(sel) { return this.shadowRoot.querySelector(sel); }
        $$(sel) { return Array.prototype.slice.call(this.shadowRoot.querySelectorAll(sel)); }
        _build() {
            this._built = true;
            const sr = this.shadowRoot || this.attachShadow({ mode: 'open' });
            sr.innerHTML = '<style>' + CSS + '</style>' + template();
            this._root = this.$('.root');
            const self = this;
            this._root.addEventListener('click', function (e) { self._onClick(e); });
            this._root.addEventListener('input', function (e) { self._onInput(e); });
            this._root.addEventListener('change', function (e) { self._onChange(e); });
            this._root.addEventListener('focusin', function (e) { self._onFocusIn(e); });
            this._root.addEventListener('keydown', function (e) { self._onKey(e); });
            this._root.addEventListener('keyup', function (e) { self._driveKeyUp(e); });
            this._setupDriveInputs();
            this.$('input[type=file]').addEventListener('change', function (e) { self._importFile(e.target.files && e.target.files[0]); e.target.value = ''; });
            Object.keys(VIEWS).forEach(function (k) { self._setupView(k); });
            this._setTab(this._ui.tab);
            this._renderLegend();
            this._setTermMin(true); // the log starts as one line; ▴ expands it
        }
        _boot() {
            const stored = storeGet(this._key);
            this._storageOk = storeSet(this._key + ':probe', 1);
            storeDel(this._key + ':probe');
            if (stored && typeof stored === 'object') {
                this._saves = Array.isArray(stored.saves) ? stored.saves : [];
                this._progress = stored.progress && typeof stored.progress === 'object' ? stored.progress : {};
                if (stored.ui)
                    Object.assign(this._ui, stored.ui);
                const current = stored.v >= 3;
                if (!this._configByApi && stored.config && current) {
                    try {
                        this._config = Core.normalizeWorld(stored.config);
                        this._configFromStore = true;
                    }
                    catch (e) { /* ignore a bad saved world */ }
                }
                // Only restore a route the student actually changed. Older saves (v1) also stored the untouched
                // default route, which would hide later changes to the default, so they are not restored.
                // v3 is the 7th Kibo-RPC world; routes saved for the older world would be in the wrong place.
                // v4: the 4-point demo route. Routes saved before it (v3 and older) are not restored, so every
                // browser starts once on the demo; named saves and progress are kept.
                const ownRoute = stored.v >= 4 && stored.edited && Array.isArray(stored.route);
                if (!this._routeByApi && ownRoute) {
                    try {
                        this._route = Core.normalizeRoute(stored.route);
                        this._route.forEach(function (w) { w.name = w.name.replace(/ \(rough\)$/, ''); });
                    }
                    catch (e) {
                        this._route = this._defaultRoute();
                    }
                }
                else if (!this._routeByApi)
                    this._route = this._defaultRoute();
                this._routeFromStore = ownRoute;
                this._routeEdited = ownRoute;
            }
            else if (!this._routeByApi) {
                this._route = this._defaultRoute();
            }
            this._ui.playSpeed = 2; // Play always opens at 2× (a speed picked last time, like 10×, is not restored)
            this.$('select[data-f=speed]').value = '2';
            this._setTab(this._ui.tab || 'route');
            this._onRootResize();
            this._setView('3d'); // always open on the 3D view (it falls back to Top if 3D cannot start)
            this._afterConfig({ silent: true });
            this._setLang(this._ui.lang);
            const url = this.getAttribute('config-url');
            if (url)
                this._loadConfigUrl(url, false);
            this._init3d();
            this._toggleDrive(true, true); // the sandbox opens in Drive
            // A phone held upright: the name row and the views in the middle of the screen once the page has loaded.
            const self = this;
            if (this._narrow)
                centerOnLoad(this, function () { const h = self.$('header').getBoundingClientRect(), v = self.$('.viewport').getBoundingClientRect(); return { top: h.top, height: v.bottom - h.top }; });
        }
        _loadConfigUrl(url, force) {
            const self = this;
            if (typeof fetch !== 'function')
                return;
            fetch(url, { credentials: 'same-origin' }).then(function (r) {
                if (!r.ok)
                    throw new Error('HTTP ' + r.status);
                return r.json();
            }).then(function (json) {
                const cfg = Core.normalizeWorld(json);
                self._base = cfg;
                // A world the student edited (saved in this browser) or one set from JS wins over the file.
                if (!force && (self._configByApi || self._configFromStore)) {
                    self._renderWorld();
                    return;
                }
                self._config = Core.copy(cfg);
                if (!self._routeFromStore && !self._routeByApi)
                    self._route = self._defaultRoute();
                self._afterConfig({ silent: true });
            }).catch(function (err) {
                self._toast(L('Could not load the world from ' + url + ' (' + err.message + '). Using the built-in world.', url + ' থেকে ওয়ার্ল্ড লোড করা গেল না (' + err.message + ')। ভেতরের নিজস্ব ওয়ার্ল্ডটাই ব্যবহার হচ্ছে।'));
            });
        }
        _observe() {
            const self = this;
            if (typeof ResizeObserver === 'function') {
                if (!this._ro) {
                    this._ro = new ResizeObserver(function (entries) {
                        entries.forEach(function (en) {
                            if (en.target === self._root)
                                self._onRootResize();
                            else
                                self._onCellResize(en.target);
                        });
                    });
                }
                this._ro.observe(this._root);
                this.$$('.cell').forEach(function (c) { self._ro.observe(c); });
            }
            if (window.matchMedia && !this._mq) {
                this._mq = window.matchMedia('(prefers-color-scheme: dark)');
                this._mqFn = function () { self._applyTheme(); };
            }
            if (this._mq) {
                try {
                    this._mq.addEventListener('change', this._mqFn);
                }
                catch (e) { /* old Safari */ }
            }
        }
        _onRootResize() {
            const narrow = this._root.clientWidth < 720;
            this._root.classList.toggle('tiny', this._root.clientWidth < 380); // small phones: tighter header buttons
            if (narrow !== this._narrow) {
                this._narrow = narrow;
                this._root.classList.toggle('narrow', narrow);
                if (!narrow && this._drawer && !this._fs)
                    this._setDrawer(false);
            }
            if (this._drive)
                this._layoutDrive();
            // A full-screen phone in landscape is wide but short: compact header and overlays.
            const short = !!this._fs && this._root.clientHeight < 560;
            if (short !== this._short) {
                this._short = short;
                this._root.classList.toggle('short', short);
                this._layoutDrive();
            }
            this._applyTouchMode();
            if (this._drive)
                this._driveHud(); // button labels depend on the layout
        }
    }

    /* ---------- state changes ---------- */
    class StateChanges {
        _pushUndo(snapshot) {
            if (this._undo[this._undo.length - 1] === snapshot)
                return;
            this._undo.push(snapshot);
            if (this._undo.length > 60)
                this._undo.shift();
        }
        // Change the route through fn(), with undo, save and events.
        _edit(fn, opts) {
            opts = opts || {};
            const before = JSON.stringify(this._route);
            fn();
            if (JSON.stringify(this._route) === before) {
                if (opts.keepList !== true)
                    this._renderList();
                return false;
            }
            this._pushUndo(before);
            this._userActed = true;
            this._commit(opts);
            return true;
        }
        _clearStop() {
            if (!this._playNote)
                return;
            this._playNote = '';
            this._robotPose = null;
        }
        _commit(opts) {
            opts = opts || {};
            this._clearStop();
            this._routeEdited = true;
            if (this._hintLen !== this._route.length) {
                this._hints = {};
                this._hintLen = this._route.length;
            }
            this._refresh();
            if (!opts.keepList)
                this._renderList();
            this._save();
            this._emitRoute();
            this._checkProgress(opts.reason || 'edit');
        }
        _emitRoute() {
            this.dispatchEvent(new CustomEvent('routechange', { detail: { route: this.getRoute(), summary: { blocked: this._analysis.blocked, distance: this._analysis.distance, time: this._analysis.time, oasis: this._analysis.oasis } }, bubbles: true, composed: true }));
        }
        _afterConfig(opts) {
            opts = opts || {};
            this._analysis = Core.analyzeRoute(this._config, this._route);
            this._mission = Core.missionStatus(this._config, this._route, this._analysis);
            Object.keys(this._views).forEach(function (k) { this._views[k].fitted = false; this._views[k].touched = false; }, this);
            Object.keys(this._views).forEach(function (k) { this._resizeView(this._views[k]); }, this);
            if (this._T) {
                this._build3dStatic();
                this._fit3d();
            }
            if (this._built)
                this._renderLegend();
            this._refresh();
            this._renderList();
            if (opts.world !== false)
                this._renderWorld();
            // Loading a world or a save is not an achievement: remember what is already done.
            this._lastBlocked = this._analysis.blocked;
            this._lastDone = {};
            this._mission.goals.forEach(function (g) { if (g.done)
                this._lastDone[g.id] = 1; }, this);
            if (!opts.silent) {
                this._save();
                this.dispatchEvent(new CustomEvent('configchange', { detail: { config: this.getConfig() }, bubbles: true, composed: true }));
            }
        }
        _refresh() {
            this._analysis = Core.analyzeRoute(this._config, this._route);
            this._mission = Core.missionStatus(this._config, this._route, this._analysis);
            if (this._analysis.legs.some(function (l) { return !l.clear && l.why === 'koz'; }))
                this._sawKozBlock = true;
            if (this._sel >= this._route.length)
                this._sel = this._route.length - 1;
            if (!this._built)
                return;
            this._renderStatus();
            this._renderMission();
            if (this._drive)
                this._driveHud();
            this.$('pre.code').textContent = this.getCode(this._ui.lang);
            this._updateListLive();
            this._drawAll();
            if (this._T)
                this._build3dDynamic();
        }
        _save() {
            const self = this;
            clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(function () {
                const sameAsBase = JSON.stringify(self._config) === JSON.stringify(self._base);
                self._storageOk = storeSet(self._key, {
                    v: 4, app: 'kibo-nav-sandbox', route: self._route, edited: !!self._routeEdited, config: sameAsBase ? null : self._config,
                    saves: self._saves, progress: self._progress, ui: self._ui
                });
                if (self._overlayOpen)
                    self._renderSaves();
            }, 250);
        }
    }

    const BLACK = '#121317', FOAM = '#141518', STEEL = '#8d949e', LED_BLUE = '#4f78ff';
    function canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return [c, c.getContext('2d')];
    }
    function texture(T, c) {
        const t = new T.CanvasTexture(c);
        t.encoding = T.sRGBEncoding;
        t.anisotropy = 8;
        return t;
    }
    // A colour as written here: the page renders in sRGB, and three.js r128 otherwise takes the numbers as linear, which washes dark colours out.
    function col(T, hex) { return new T.Color(hex).convertSRGBToLinear(); }
    function std(T, color, o) {
        const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.5, metalness: 0.05 }, o || {}));
        m.color = col(T, color);
        if (o && o.emissive)
            m.emissive = col(T, o.emissive);
        return m;
    }
    function aim(T, mesh, p, n) {
        mesh.position.set(p[0], p[1], p[2]);
        mesh.lookAt(new T.Vector3(p[0] + n[0], p[1] + n[1], p[2] + n[2]));
        return mesh;
    }
    function disc(T, r, depth, mat) {
        const g = new T.CylinderGeometry(r, r, depth, 32);
        g.rotateX(Math.PI / 2);
        return new T.Mesh(g, mat);
    }
    function dome(T, r, height, mat) {
        const g = new T.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        g.rotateX(Math.PI / 2);
        g.scale(1, 1, height / r);
        return new T.Mesh(g, mat);
    }
    function unit(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function smooth(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
    /* ---------- Int-Ball2 ---------- */
    let ballCanvas = null, ballSkin = null;
    // The ball's skin, worked out point by point on the sphere (front +z, up +y, the robot's left +x): white, a black mask across the face with
    // a stem up the middle, a grilled panel over each of the eight fans, slits round the bottom, the panel at the back.
    function paintBall() {
        if (ballCanvas)
            return ballCanvas;
        const W = 1280, H = 640, [cv, x] = canvas(W, H), img = x.createImageData(W, H), out = img.data;
        const ducts = [];
        for (let i = 0; i < 8; i++) {
            const n = unit([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]), e1 = unit([n[2], 0, -n[0]]);
            ducts.push({ n: n, e1: e1, e2: [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]] });
        }
        const edge = 0.0075, cover = function (f) { return clamp01(f / edge + 0.5); };
        for (let j = 0; j < H; j++) {
            const th = (j + 0.5) / H * Math.PI, st = Math.sin(th), dy = Math.cos(th);
            for (let i = 0; i < W; i++) {
                const ph = (i + 0.5) / W * Math.PI * 2, dx = -Math.cos(ph) * st, dz = Math.sin(ph) * st;
                let r = 238, g = 240, b = 243;
                const mix = function (cr, cg, cb, k) { r += (cr - r) * k; g += (cg - g) * k; b += (cb - b) * k; };
                // Seams between the shell's halves.
                mix(176, 182, 192, cover(0.0035 - Math.abs(dz)));
                // The fans' panels, with their rows of slits.
                for (let d = 0; d < 8; d++) {
                    const D = ducts[d], c = dx * D.n[0] + dy * D.n[1] + dz * D.n[2];
                    if (c < 0.6)
                        continue;
                    const u = dx * D.e1[0] + dy * D.e1[1] + dz * D.e1[2], v = dx * D.e2[0] + dy * D.e2[1] + dz * D.e2[2];
                    const q = Math.hypot(Math.max(Math.abs(u) - 0.19, 0), Math.max(Math.abs(v) - 0.19, 0)) - 0.1, k = cover(-q);
                    if (k <= 0)
                        continue;
                    mix(16, 17, 20, k);
                    if (q < -0.035)
                        mix(58, 62, 70, 0.75 * smooth(0.25, 0.75, Math.sin(u * 86)));
                }
                // Slits round the bottom.
                if (dy < -0.74 && dy > -0.95) {
                    const az = Math.atan2(dx, dz);
                    if (Math.abs(az) < 1.25)
                        mix(30, 32, 37, cover(Math.sin(az * 52) * 0.01 - 0.003) * cover(0.95 + dy) * cover(-0.74 - dy));
                }
                // The black face, with a white line round it.
                if (dz > 0) {
                    const ax = Math.abs(dx), hi = 0.86 - 0.5 * smooth(0.13, 0.75, ax), lo = -0.2 + 0.3 * dx * dx, f = Math.min(dy - lo, hi - dy, 0.93 - ax);
                    if (f > -0.04) {
                        mix(238, 240, 243, cover(f + 0.028));
                        mix(14, 15, 18, cover(f));
                    }
                }
                else {
                    mix(26, 28, 32, cover(0.42 - Math.hypot(dx, dy + 0.1))); // the back panel, round the docking plug
                }
                // The stereo pair's strip on the left, the velcro on the right.
                if (dx > 0)
                    mix(14, 15, 18, cover(0.08 - Math.hypot(Math.max(Math.abs(dz) - 0.31, 0), Math.max(Math.abs(dy) - 0.06, 0))));
                else if (Math.abs(dz - 0.12) < 0.1 && Math.abs(dy) < 0.18)
                    mix(141, 145, 152, 1);
                const o = (j * W + i) * 4;
                out[o] = r;
                out[o + 1] = g;
                out[o + 2] = b;
                out[o + 3] = 255;
            }
        }
        x.putImageData(img, 0, 0);
        ballCanvas = cv;
        return cv;
    }
    // A blue ring eye: dark glass, a lit ring with a white-hot core, and a soft glow.
    function ballEye(T, g, side) {
        const n = unit([side * 0.47, 0.22, 0.85]);
        const at = function (d) { return [n[0] * d, n[1] * d, n[2] * d]; };
        g.add(aim(T, dome(T, 0.2, 0.05, std(T, '#050608', { roughness: 0.08, metalness: 0.4 })), at(0.985), n));
        g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.034, 14, 64), new T.MeshBasicMaterial({ color: col(T, LED_BLUE) })), at(0.995), n));
        g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.012, 8, 64), new T.MeshBasicMaterial({ color: col(T, '#d6e2ff') })), at(1.026), n));
        g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.228, 0.07, 10, 64), new T.MeshBasicMaterial({ color: col(T, '#2f55d8'), transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false })), at(0.99), n));
    }
    // The ball on the sandbox's robot, radius R (body frame: +X the camera, +Y left, +Z the top): the same skin, turned from the model's axes.
    function addBallDetails(T, group, R, mat) {
        const skin = new T.Mesh(new T.SphereGeometry(R * 1.006, 40, 28), new T.MeshLambertMaterial({ map: ballSkin || (ballSkin = texture(T, paintBall())) }));
        skin.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1), new T.Vector3(1, 0, 0)));
        skin.userData.ownGeo = true;
        group.add(skin);
        [-1, 1].forEach(function (s) {
            const d = new T.Vector3(0.85, s * 0.47, 0.22).normalize(), ring = new T.Mesh(new T.TorusGeometry(R * 0.228, R * 0.04, 8, 28), mat(LED_BLUE));
            ring.position.copy(d).multiplyScalar(R * 1.0);
            ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), d);
            ring.userData.ownGeo = true;
            group.add(ring);
        });
    }
    // Int-Ball2 for the robots page: radius 1 (about 10 cm), front +z, up +y, the robot's left +x. `shells` are the outer materials (the page makes
    // them see-through to show the inside). Its fans are behind grilles, as on the real one, so nothing turns.
    function buildBall(T) {
        const shells = [], spinners = [], g = new T.Group();
        const shell = new T.MeshStandardMaterial({ map: texture(T, paintBall()), roughness: 0.3, metalness: 0, transparent: true });
        shells.push(shell);
        g.add(new T.Mesh(new T.SphereGeometry(1, 96, 64), shell));
        ballEye(T, g, -1);
        ballEye(T, g, 1);
        // The main camera, between the eyes.
        const main = unit([0, 0.12, 1]);
        g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.085, 0.013, 10, 36), std(T, '#3a3f49', { metalness: 0.5, roughness: 0.3 })), [main[0] * 1.0, main[1] * 1.0, main[2] * 1.0], main));
        g.add(aim(T, dome(T, 0.075, 0.03, std(T, '#0a0c10', { roughness: 0.06, metalness: 0.5 })), [main[0] * 0.995, main[1] * 0.995, main[2] * 0.995], main));
        g.add(aim(T, disc(T, 0.03, 0.02, std(T, '#111318')), [0, 0.62, 0.785], [0, 0.62, 0.78]));
        // The stereo pair on the left, the docking plug at the back.
        [-0.26, 0.26].forEach(function (z) {
            const n = unit([1, 0, z]);
            g.add(aim(T, dome(T, 0.06, 0.025, std(T, '#0a0c10', { roughness: 0.06, metalness: 0.5 })), [n[0], n[1], n[2]], n));
        });
        g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.14, 0.02, 10, 40), std(T, STEEL, { metalness: 0.6, roughness: 0.3 })), [0, -0.1, -0.985], [0, 0, -1]));
        g.add(aim(T, disc(T, 0.07, 0.05, std(T, '#c9b37a', { metalness: 0.6, roughness: 0.3 })), [0, -0.1, -0.99], [0, 0, -1]));
        const inside = new T.Group();
        inside.name = 'inside';
        const board = new T.Mesh(new T.BoxGeometry(0.75, 0.07, 0.55), std(T, '#2e7d4f'));
        inside.add(board);
        const chip = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.2), std(T, '#23262d'));
        chip.position.set(0.12, 0.07, 0.02);
        inside.add(chip);
        const imu = new T.Mesh(new T.BoxGeometry(0.14, 0.08, 0.14), std(T, '#d4a017'));
        imu.position.set(-0.2, 0.08, -0.1);
        inside.add(imu);
        const cell = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.3), std(T, '#5b6475'));
        cell.position.set(0, -0.22, 0);
        inside.add(cell);
        g.add(inside);
        return { group: g, shells: shells, spinners: spinners };
    }
    /* ---------- Astrobee ---------- */
    // The front plate, 1.16 by 1.38 in the model, as the real one is laid out. `glow` gets what lights up: the screen and the status lights.
    function paintPlate() {
        const W = 812, H = 966, [cv, x] = canvas(W, H), [gv, gl] = canvas(W, H);
        gl.fillStyle = '#000';
        gl.fillRect(0, 0, W, H);
        const U = function (u) { return u * W; }, V = function (v) { return v * H; };
        const grad = x.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#f2f3f5');
        grad.addColorStop(1, '#e2e4e8');
        x.fillStyle = grad;
        x.fillRect(0, 0, W, H);
        x.strokeStyle = '#c3c7ce';
        x.lineWidth = 4;
        x.strokeRect(2, 2, W - 4, H - 4);
        const rect = function (u0, v0, u1, v1, c) { x.fillStyle = c; x.fillRect(U(u0), V(v0), U(u1 - u0), V(v1 - v0)); };
        const dot = function (u, v, r, c) { x.fillStyle = c; x.beginPath(); x.arc(U(u), V(v), r, 0, Math.PI * 2); x.fill(); };
        const text = function (s, u, v, size, align) {
            x.fillStyle = '#2b2e35';
            x.font = '600 ' + size + 'px system-ui, sans-serif';
            x.textAlign = align || 'center';
            x.textBaseline = 'middle';
            x.fillText(s, U(u), V(v));
        };
        // Screws.
        [[0.05, 0.035], [0.95, 0.075], [0.05, 0.925], [0.95, 0.965]].forEach(function (p) { dot(p[0], p[1], 13, '#b9a26b'); dot(p[0], p[1], 7, '#6e6243'); });
        // Laser: its warning label and lens, and the three slits.
        x.fillStyle = '#f2c230';
        x.beginPath();
        x.moveTo(U(0.045), V(0.15));
        x.lineTo(U(0.1), V(0.15));
        x.lineTo(U(0.0725), V(0.105));
        x.fill();
        x.fillStyle = '#f2c230';
        x.beginPath();
        x.moveTo(U(0.045), V(0.215));
        x.lineTo(U(0.1), V(0.215));
        x.lineTo(U(0.0725), V(0.17));
        x.fill();
        text('Laser', 0.17, 0.095, 21);
        dot(0.165, 0.15, 17, '#23262d');
        dot(0.165, 0.15, 8, '#5a6170');
        [0.15, 0.185, 0.22].forEach(function (v) { rect(0.25, v, 0.36, v + 0.009, '#2b2e35'); });
        // SciCam, HazCam, NavCam.
        text('SciCam', 0.49, 0.085, 21);
        rect(0.385, 0.115, 0.6, 0.285, '#0d0e11');
        rect(0.44, 0.115, 0.56, 0.21, '#16181d');
        text('HazCam', 0.2, 0.262, 19);
        rect(0.03, 0.285, 0.62, 0.4, '#0d0e11');
        rect(0.1, 0.315, 0.3, 0.37, '#1d2026');
        text('NavCam', 0.78, 0.235, 19);
        rect(0.645, 0.26, 0.9, 0.435, '#101115');
        // The name label.
        rect(0.62, 0.095, 0.96, 0.205, '#fbfbfb');
        text('Astrobee', 0.79, 0.125, 25);
        for (let i = 0; i < 44; i++)
            rect(0.66 + i * 0.0062, 0.15, 0.66 + i * 0.0062 + (i % 3 === 0 ? 0.005 : 0.0026), 0.185, '#1d1f24');
        // The speaker grille.
        rect(0.21, 0.455, 0.74, 0.555, '#3a3d44');
        for (let j = 0; j < 8; j++)
            for (let i = 0; i < 44; i++)
                dot(0.222 + i * 0.0118, 0.466 + j * 0.0115, 3, '#16171b');
        // SpeedCam, beside it.
        dot(0.84, 0.505, 21, '#16181d');
        dot(0.84, 0.505, 10, '#39404c');
        // The screen, with its two eyes.
        rect(0.19, 0.585, 0.79, 0.85, '#0c1c33');
        const sc = gl.createRadialGradient(U(0.49), V(0.715), 10, U(0.49), V(0.715), U(0.33));
        sc.addColorStop(0, '#0f4f8c');
        sc.addColorStop(0.75, '#0a3056');
        sc.addColorStop(1, '#071c36');
        gl.fillStyle = sc;
        gl.fillRect(U(0.19), V(0.585), U(0.6), V(0.265));
        x.fillStyle = sc;
        x.fillRect(U(0.19), V(0.585), U(0.6), V(0.265));
        [0.385, 0.6].forEach(function (u) {
            [x, gl].forEach(function (c) {
                const e = c.createRadialGradient(U(u), V(0.715), 6, U(u), V(0.715), 74);
                e.addColorStop(0, '#f2fbff');
                e.addColorStop(0.42, '#7fe0ff');
                e.addColorStop(1, 'rgba(60,170,240,0)');
                c.fillStyle = e;
                c.beginPath();
                c.arc(U(u), V(0.715), 74, 0, Math.PI * 2);
                c.fill();
            });
        });
        // Home, the status lights, Pwr, the microphone, Wake.
        text('Home', 0.095, 0.655, 19);
        dot(0.13, 0.715, 18, '#1a1c20');
        dot(0.13, 0.715, 12, '#21a35a');
        [['Vid', 0.655], ['Aud', 0.7], ['Live', 0.745]].forEach(function (l) {
            text(l[0], 0.875, l[1], 18);
            gl.fillStyle = '#39e27a';
            gl.fillRect(U(0.93), V(l[1]) - 5, 20, 10);
            dot(0.94, l[1], 5, '#39e27a');
        });
        rect(0.83, 0.775, 0.965, 0.865, '#f9f9fa');
        text('A', 0.85, 0.79, 15);
        text('B', 0.85, 0.82, 15);
        text('C', 0.85, 0.85, 15);
        [0.79, 0.82, 0.85].forEach(function (v) { [0.895, 0.935].forEach(function (u) { dot(u, v, 6, '#2fbf68'); gl.fillStyle = '#39e27a'; gl.beginPath(); gl.arc(U(u), V(v), 6, 0, Math.PI * 2); gl.fill(); }); });
        text('Pwr', 0.135, 0.895, 19);
        dot(0.3, 0.9, 26, '#17181c');
        dot(0.485, 0.9, 20, '#d7d9de');
        dot(0.485, 0.9, 7, '#55595f');
        dot(0.67, 0.91, 26, '#14161a');
        dot(0.67, 0.91, 16, '#1f9a57');
        text('Wake', 0.82, 0.91, 19);
        return { base: cv, glow: gv };
    }
    // One fabric side cover, 2 by 2 in the model: blue, as on the robot called Bumble, with a black X across it, slatted vents on two of its
    // arms, an alignment square near each corner, and stitching round the edge.
    function paintCover() {
        const S = 1024, [cv, x] = canvas(S, S), c = S / 2;
        const img = x.createImageData(S, S), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 14;
            d[i] = 112 + n;
            d[i + 1] = 156 + n;
            d[i + 2] = 214 + n;
            d[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        x.save();
        x.translate(c, c);
        x.fillStyle = '#121317';
        [Math.PI / 4, -Math.PI / 4].forEach(function (a) { x.save(); x.rotate(a); x.fillRect(-S, -118, S * 2, 236); x.restore(); });
        x.beginPath();
        x.arc(0, 0, 268, 0, Math.PI * 2);
        x.fill();
        // Vents on two arms.
        [Math.PI / 4, Math.PI * 1.25].forEach(function (a) {
            x.save();
            x.rotate(a);
            x.fillStyle = '#34373e';
            for (let i = 0; i < 16; i++)
                x.fillRect(282 + i * 10, -84, 5, 168);
            x.restore();
        });
        // The alignment squares, on the arms' ends.
        [Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 1.25].forEach(function (a, k) {
            x.save();
            x.rotate(a);
            x.translate(k < 2 ? 470 : 520, 0);
            x.rotate(Math.PI / 4);
            x.fillStyle = '#f4f5f7';
            x.fillRect(-58, -58, 116, 116);
            x.fillStyle = '#101114';
            x.fillRect(-44, -44, 88, 88);
            x.fillStyle = '#f4f5f7';
            [[0, 0], [1, 2], [2, 1], [3, 3], [0, 3], [2, 2]].forEach(function (p) { x.fillRect(-44 + p[0] * 22, -44 + p[1] * 22, 22, 22); });
            x.restore();
        });
        x.restore();
        x.strokeStyle = '#d8dee8';
        x.lineWidth = 3;
        x.setLineDash([12, 10]);
        x.strokeRect(22, 22, S - 44, S - 44);
        x.setLineDash([]);
        x.save();
        x.translate(S - 72, 330);
        x.rotate(Math.PI / 2);
        x.fillStyle = '#10131a';
        x.font = '600 34px system-ui, sans-serif';
        x.textAlign = 'center';
        x.fillText('Bumble', 0, 0);
        x.restore();
        return cv;
    }
    // A front or back face of a fan module: black, a tall vent of fine slats, a few screws.
    function paintVent() {
        const W = 256, H = 1000, [cv, x] = canvas(W, H);
        x.fillStyle = '#16171b';
        x.fillRect(0, 0, W, H);
        x.fillStyle = '#08090b';
        x.fillRect(46, 200, 164, 400);
        x.fillStyle = '#3a3d45';
        for (let j = 0; j < 40; j++)
            for (let i = 0; i < 9; i++)
                x.fillRect(54 + i * 17, 208 + j * 9.6, 12, 4);
        x.fillStyle = '#4b4f58';
        [[40, 120], [216, 120], [40, 680], [216, 680]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 7, 0, Math.PI * 2); x.fill(); });
        x.fillStyle = '#25272d';
        x.fillRect(0, 760, W, 6);
        return cv;
    }
    // The top: dark, with the three payload bays' outlines and a band of vents.
    function paintTop() {
        const S = 512, [cv, x] = canvas(S, S);
        x.fillStyle = '#1b1c21';
        x.fillRect(0, 0, S, S);
        x.strokeStyle = '#3f434c';
        x.lineWidth = 4;
        [[70, 60, 170, 180], [272, 60, 170, 180], [150, 290, 212, 170]].forEach(function (r) { x.strokeRect(r[0], r[1], r[2], r[3]); });
        x.fillStyle = '#34373f';
        for (let i = 0; i < 26; i++)
            x.fillRect(84 + i * 13.4, 256, 7, 20);
        return cv;
    }
    // A round mesh of fine holes, for the fan's grille: grey wires, see-through between them.
    function paintMesh() {
        const S = 512, [cv, x] = canvas(S, S);
        x.fillStyle = '#6f7379';
        x.fillRect(0, 0, S, S);
        x.globalCompositeOperation = 'destination-out';
        for (let j = 0; j < 64; j++)
            for (let i = 0; i < 64; i++) {
                x.beginPath();
                x.arc((i + (j % 2 ? 0.5 : 0)) * 8, j * 7, 3, 0, Math.PI * 2);
                x.fill();
            }
        return cv;
    }
    // Soft fuzz for the foam corners.
    function paintFoam() {
        const S = 128, [cv, x] = canvas(S, S), img = x.createImageData(S, S), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = 90 + Math.random() * 120;
            d[i] = d[i + 1] = d[i + 2] = n;
            d[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        return cv;
    }
    // Astrobee for the robots page: half the cube's width is 1 (16 cm). Front +z, up +y, the robot's left +x. `shells` are the outer materials and
    // `spinners` the two fans, turning behind their mesh grilles.
    function buildCube(T) {
        const shells = [], spinners = [], g = new T.Group();
        const shelled = function (o) { const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.05, transparent: true }, o)); if (typeof o.color === 'string')
            m.color = col(T, o.color); shells.push(m); return m; };
        const cover = texture(T, paintCover()), vent = texture(T, paintVent()), top = texture(T, paintTop()), plate = paintPlate();
        const dark = shelled({ color: '#17181c', roughness: 0.65 }), ventMat = shelled({ map: vent }), topMat = shelled({ map: top }), coverMat = shelled({ map: cover, roughness: 0.85 });
        // The core between the fan modules, and the white front plate on it.
        const core = new T.Mesh(new T.BoxGeometry(1.16, 1.84, 1.72), [dark, dark, topMat, dark, dark, dark]);
        g.add(core);
        const face = new T.Mesh(new T.PlaneGeometry(1.16, 1.38), shelled({ map: texture(T, plate.base), emissive: '#ffffff', emissiveMap: texture(T, plate.glow), emissiveIntensity: 0.8, roughness: 0.45 }));
        face.position.set(0, 0.23, 0.875);
        g.add(face);
        const stow = new T.Mesh(new T.BoxGeometry(0.46, 0.3, 0.05), std(T, '#7c828c', { metalness: 0.4 }));
        stow.position.set(0.04, -0.68, 0.86);
        g.add(stow);
        // A fan module on each side.
        const mesh = new T.CanvasTexture(paintMesh());
        [-1, 1].forEach(function (s, k) {
            const faces = s > 0 ? [coverMat, dark, topMat, dark, ventMat, ventMat] : [dark, coverMat, topMat, dark, ventMat, ventMat];
            const mod = new T.Mesh(new T.BoxGeometry(0.42, 1.9, 1.9), faces);
            mod.position.set(s * 0.79, 0, 0);
            g.add(mod);
            // The fan, its grille and collar, and the lights that curve round it.
            const rotor = new T.Group();
            aim(T, rotor, [s * 1.004, 0, 0], [s, 0, 0]);
            rotor.add(disc(T, 0.4, 0.002, std(T, '#0b0c0e')));
            for (let b = 0; b < 7; b++) {
                const a = b * Math.PI * 2 / 7, bl = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.004), std(T, '#31343b', { metalness: 0.3 }));
                bl.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.004);
                bl.rotation.z = a;
                bl.rotateX(0.5);
                rotor.add(bl);
            }
            rotor.userData.dir = k ? 1 : -1;
            g.add(rotor);
            spinners.push(rotor);
            const grille = new T.Mesh(new T.CircleGeometry(0.405, 72), new T.MeshStandardMaterial({ map: mesh, transparent: true, roughness: 0.5, metalness: 0.5 }));
            aim(T, grille, [s * 1.012, 0, 0], [s, 0, 0]);
            g.add(grille);
            g.add(aim(T, new T.Mesh(new T.TorusGeometry(0.42, 0.028, 12, 72), std(T, '#1a1b1f', { roughness: 0.5 })), [s * 1.01, 0, 0], [s, 0, 0]));
            [0.35, Math.PI + 0.35].forEach(function (a) {
                const arc = new T.Mesh(new T.TorusGeometry(0.49, 0.016, 8, 40, 1.5), new T.MeshBasicMaterial({ color: col(T, '#e6efff') }));
                aim(T, arc, [s * 1.006, 0, 0], [s, 0, 0]);
                arc.rotateZ(a);
                g.add(arc);
            });
            // The small lights where the cover meets the front and back.
            [0.955, -0.955].forEach(function (z) { const l = new T.Mesh(new T.BoxGeometry(0.03, 0.14, 0.02), new T.MeshBasicMaterial({ color: col(T, '#dbe7ff') })); l.position.set(s * 0.985, 0, z); g.add(l); });
        });
        // The soft foam corners.
        const foam = new T.CanvasTexture(paintFoam());
        foam.wrapS = foam.wrapT = T.RepeatWrapping;
        foam.repeat.set(5, 3);
        const foamMat = new T.MeshStandardMaterial({ roughness: 1, bumpMap: foam, bumpScale: 0.02 });
        foamMat.color = col(T, FOAM);
        const pad = new T.SphereGeometry(1, 36, 24);
        for (let i = 0; i < 8; i++) {
            const b = new T.Mesh(pad, foamMat);
            b.scale.set(0.23, 0.17, 0.23);
            b.position.set(i & 1 ? 0.8 : -0.8, i & 2 ? 0.95 : -0.95, i & 4 ? 0.84 : -0.84);
            g.add(b);
            const c = new T.Mesh(pad, foamMat);
            c.scale.set(0.17, 0.23, 0.17);
            c.position.set(i & 1 ? 0.87 : -0.87, i & 2 ? 0.86 : -0.86, i & 4 ? 0.93 : -0.93);
            g.add(c);
        }
        // The back: a dark plate with DockCam, PerchCam and the AR flashlight; the perching arm folded along the bottom.
        const back = new T.Mesh(new T.BoxGeometry(1.16, 1.0, 0.03), std(T, '#23252b', { roughness: 0.6 }));
        back.position.set(0, 0.4, -0.875);
        g.add(back);
        [[-0.3, 0.45], [0.3, 0.45]].forEach(function (p) {
            const c = [p[0], p[1], -0.895], n = [0, 0, -1];
            g.add(aim(T, new T.Mesh(new T.BoxGeometry(0.24, 0.24, 0.03), std(T, '#0e0f13')), c, n));
            g.add(aim(T, dome(T, 0.08, 0.03, std(T, '#07080b', { roughness: 0.06, metalness: 0.5 })), [p[0], p[1], -0.91], n));
        });
        g.add(aim(T, disc(T, 0.05, 0.03, std(T, '#fff4c2', { emissive: '#fff4c2', emissiveIntensity: 0.4 })), [0, 0.45, -0.9], [0, 0, -1]));
        const arm = std(T, '#aeb4bd', { metalness: 0.35, roughness: 0.4 }), joint = std(T, '#5d636e', { metalness: 0.5 });
        const armBase = new T.Mesh(new T.BoxGeometry(0.28, 0.24, 0.16), arm);
        armBase.position.set(-0.42, -0.6, -0.92);
        g.add(armBase);
        const link = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.8, 20), arm);
        link.rotation.z = Math.PI / 2;
        link.position.set(0.02, -0.6, -0.97);
        g.add(link);
        [-0.38, 0.42].forEach(function (x) { const j = new T.Mesh(new T.SphereGeometry(0.095, 20, 14), joint); j.position.set(x, -0.6, -0.97); g.add(j); });
        [-1, 1].forEach(function (s) { const f = new T.Mesh(new T.BoxGeometry(0.2, 0.045, 0.05), arm); f.position.set(0.53, -0.6 + s * 0.06, -0.97); g.add(f); });
        const inside = new T.Group();
        inside.name = 'inside';
        ['#2e7d4f', '#2e6f7d', '#4f2e7d'].forEach(function (col, k) { const bd = new T.Mesh(new T.BoxGeometry(0.8, 0.06, 0.9), std(T, col)); bd.position.set(0, 0.35 - k * 0.28, 0); inside.add(bd); });
        const imu = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.16), std(T, '#d4a017'));
        imu.position.set(0.2, 0.42, 0.2);
        inside.add(imu);
        [-0.25, 0.25].forEach(function (x) { [-0.25, 0.25].forEach(function (z) { const bt = new T.Mesh(new T.BoxGeometry(0.2, 0.3, 0.2), std(T, '#5b6475')); bt.position.set(x, -0.55, z); inside.add(bt); }); });
        g.add(inside);
        return { group: g, shells: shells, spinners: spinners };
    }
    function ballParts() {
        return [
            { id: 'main', kind: 'cam', name: L('Main camera', 'মূল ক্যামেরা'), pos: [0, 0.12, 1.02], n: [0, 0.12, 1],
                text: L('Takes the photos and video for the crew and the ground. In Kibo-RPC this is the camera that reads the AR markers (/camera_main). It sits 0.14 m in front of the centre and looks straight ahead.', 'ক্রু আর মাটির মানুষদের জন্য ছবি আর ভিডিও তোলে। Kibo-RPC-তে এই ক্যামেরাই AR মার্কার পড়ে (/camera_main)। কেন্দ্র থেকে ০.১৪ মি সামনে বসানো, সোজা সামনে তাকায়।') },
            { id: 'stereo', kind: 'cam', name: L('Stereo camera', 'স্টেরিও ক্যামেরা'), pos: [1.02, 0, 0], n: [1, 0, 0],
                text: L('Two navigation cameras side by side, like a pair of eyes, on the robot\'s left side. Int-Ball2 uses them for Visual SLAM: it builds a map of the module and finds itself in it.', 'পথ চেনার জন্য পাশাপাশি দুটো ক্যামেরা, একজোড়া চোখের মতো, রোবটের বাঁ পাশে। Int-Ball2 এগুলো দিয়ে ভিজ্যুয়াল SLAM করে: মডিউলের ম্যাপ বানায় আর সেই ম্যাপে নিজেকে খুঁজে নেয়।') },
            { id: 'fans', kind: 'move', name: L('Propeller fans ×8', 'প্রপেলার পাখা ×৮'), pos: [0.6, 0.6, 0.6], n: [1, 1, 1],
                text: L('Eight ducted propellers pointing out at angles, half spinning clockwise and half anticlockwise. Running different ones pushes and turns the ball any way. The strongest push is 155 mN, about the weight of a 16 g object on Earth.', 'নালির ভেতরে বসানো আটটা প্রপেলার, কোণাকুণি বাইরের দিকে মুখ করা; অর্ধেক ঘোরে ঘড়ির কাঁটার দিকে, অর্ধেক উল্টো দিকে। আলাদা আলাদা পাখা চালিয়ে বলটাকে যেকোনো দিকে ঠেলা আর ঘোরানো যায়। সবচেয়ে জোরালো ঠেলা ১৫৫ mN, পৃথিবীতে ১৬ গ্রামের কোনো জিনিসের ওজনের মতো।') },
            { id: 'leds', kind: 'body', name: L('LED rings ×2', 'LED রিং ×২'), pos: [0.47, 0.22, 0.87], n: [0.47, 0.22, 0.85],
                text: L('Two light rings (its "eyes") that show the crew what Int-Ball2 is doing. Their colours can be changed.', 'দুটো আলোর রিং (এর “চোখ”), Int-Ball2 কী করছে তা ক্রুদের দেখায়। এদের রং বদলানো যায়।') },
            { id: 'mic', kind: 'body', name: L('Microphone', 'মাইক্রোফোন'), pos: [0, 0.62, 0.8], n: [0, 0.62, 0.78],
                text: L('Records sound along with the video.', 'ভিডিওর সঙ্গে শব্দ রেকর্ড করে।') },
            { id: 'dock', kind: 'move', name: L('Docking plug', 'ডকিং প্লাগ'), pos: [0, -0.1, -1.02], n: [0, 0, -1],
                text: L('Connects to the docking station, where Int-Ball2 parks itself to recharge its battery without help from the crew.', 'ডকিং স্টেশনের সঙ্গে জোড়া লাগে; ক্রুদের সাহায্য ছাড়াই Int-Ball2 সেখানে গিয়ে বসে ব্যাটারি চার্জ নেয়।') },
            { id: 'usb', kind: 'body', name: L('Velcro and USB', 'ভেলক্রো আর USB'), pos: [-1.0, 0, 0.12], n: [-1, 0, 0],
                text: L('A Velcro patch so the crew can stick it to a wall, and a micro USB connector.', 'ক্রুরা যাতে দেয়ালে আটকে রাখতে পারেন, সেজন্য একটুকরো ভেলক্রো, আর একটা মাইক্রো USB সংযোগ।') },
            { id: 'inside', kind: 'sense', name: L('Inside: IMU and computer', 'ভেতরে: IMU আর কম্পিউটার'), pos: [-0.35, 0.35, 0], n: [0.2, 0.45, 1], inside: true,
                text: L('An Epson IMU (gyroscopes and accelerometers) feels it turn and speed up, and an NVIDIA Jetson TX2 computer runs ROS, the flight software and user programs (in Docker containers).', 'Epson-এর একটা IMU (জাইরোস্কোপ আর অ্যাক্সেলেরোমিটার) টের পায় রোবট কতটা ঘুরছে আর গতি বাড়াচ্ছে, আর একটা NVIDIA Jetson TX2 কম্পিউটারে চলে ROS, ওড়ার সফটওয়্যার আর ইউজারদের প্রোগ্রাম (Docker কন্টেইনারে)।') }
        ];
    }

    // three.js r128 and OrbitControls, loaded the first time the 3D view is needed. They are files of this project, found next to the
    // script (../vendor/ from dist/kibo-nav-sandbox.js), so the tool needs no other site, whatever folder of a website it is put in.
    // Run as a module or a bundle with no script tag (no address to go by), it falls back to the CDNs.
    const HERE = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';
    const THREE_URL = HERE ? new URL('../vendor/three.min.js', HERE).href : 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    const ORBIT_URL = HERE ? new URL('../vendor/OrbitControls.js', HERE).href : 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
    // The exact files (they match the npm package): a CDN that was broken into could otherwise run anything here, tokens in reach.
    const THREE_HASH = 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';
    const ORBIT_HASH = 'sha384-wagZhIFgY4hD+7awjQjR4e2E294y6J2HSnd8eTNc15ZubTeQeVRZwhQJ+W6hnBsf';
    let threePromise = null;
    function loadScript(src, hash) {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.crossOrigin = 'anonymous';
            s.integrity = hash;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error(L('Could not load ', 'লোড করা গেল না: ') + src)); };
            document.head.appendChild(s);
        });
    }
    function ensureThree() {
        if (window.THREE && window.THREE.OrbitControls)
            return Promise.resolve(window.THREE);
        if (!threePromise) {
            threePromise = (window.THREE ? Promise.resolve() : loadScript(THREE_URL, THREE_HASH))
                .then(function () { return window.THREE.OrbitControls ? null : loadScript(ORBIT_URL, ORBIT_HASH); })
                .then(function () { return window.THREE; });
            threePromise.catch(function () { threePromise = null; });
        }
        return threePromise;
    }

    /* ---------- 3D view (three.js r128) ---------- */
    /** How far one drag along the whole roll wheel rolls the module (radians). */
    const ROLL_PER_WHEEL = 1.5 * Math.PI;
    class View3D {
        _init3d() {
            const self = this, msg = this.$('.msg3d');
            msg.style.display = 'flex';
            msg.textContent = L('Loading the 3D view…', '3D ভিউ লোড হচ্ছে…');
            // In Bangla the labels (drawn once into textures) wait for the Bangla font.
            Promise.all([ensureThree(), fontReady()]).then(function (res) {
                const T = res[0];
                if (!T || !T.OrbitControls)
                    throw new Error('three.js loaded without OrbitControls');
                self._setup3d(T);
                msg.style.display = 'none';
            }).catch(function (err) {
                self._no3d = true;
                msg.style.display = 'flex';
                msg.textContent = L('The 3D view could not start (' + err.message + '). The Top, Side and End views still work.', '3D ভিউ চালু করা গেল না (' + err.message + ')। ওপর, পাশ আর মাথার ভিউ ঠিকই কাজ করবে।');
                if (self._ui.view === '3d')
                    self._setView('top');
            });
        }
        _setup3d(T) {
            const holder = this.$('.three'), self = this;
            const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
            holder.appendChild(renderer.domElement);
            this._T = T;
            this._renderer = renderer;
            this._scene = new T.Scene();
            this._camera = new T.PerspectiveCamera(45, 1, 0.02, 200);
            this._controls = new T.OrbitControls(this._camera, renderer.domElement);
            // Touch: one finger turns around the module (a tap still picks a waypoint); two fingers are ours
            // (_setupMapTouch): pinch to zoom, drag to slide the view.
            this._controls.touches = { ONE: T.TOUCH.ROTATE, TWO: -1 };
            this._applyTouchMode();
            this._controls.screenSpacePanning = true;
            this._setupMapTouch(renderer.domElement);
            this._setupRollWheel();
            this._controls.addEventListener('change', function () { self._render3d(); });
            // Once the student moves the view, stop reframing it when the panel changes size.
            this._controls.addEventListener('start', function () { self._touched3d = true; });
            // r128 OrbitControls only zooms toward its target. Take the wheel first (capture phase on the
            // holder) and zoom toward the point under the cursor instead; pinch still goes to OrbitControls.
            holder.addEventListener('wheel', function (e) { e.preventDefault(); e.stopPropagation(); self._zoom3dAt(e); }, { capture: true, passive: false });
            this._scene.add(new T.AmbientLight(0xffffff, 0.75));
            const dl = new T.DirectionalLight(0xffffff, 0.55);
            dl.position.set(3, 6, 4);
            this._scene.add(dl);
            // three.js is y-up. Rotating +90° about x maps ISS (x, y, z) to (x, -z, y), so +z (deck) points down.
            // Rolling the module about its long (airlock - dock) axis turns this group (the roll wheel, _setupRollWheel).
            const issRoot = new T.Group();
            issRoot.rotation.x = Math.PI / 2;
            this._scene.add(issRoot);
            this._issRoot = issRoot;
            this._iss = new T.Group();
            issRoot.add(this._iss);
            this._static = new T.Group();
            this._dynamic = new T.Group();
            this._robot3 = new T.Group();
            this._iss.add(this._static, this._dynamic, this._robot3);
            this._geo = {
                box: new T.BoxGeometry(1, 1, 1), sphere: new T.SphereGeometry(1, 20, 14), plane: new T.PlaneGeometry(1, 1),
                cyl: new T.CylinderGeometry(1, 1, 1, 10), cone: new T.ConeGeometry(1, 1, 14)
            };
            this._mats = {};
            this._labels = {};
            this._raycaster = new T.Raycaster();
            this._camera.layers.enable(1); // the robot's own meshes sit on layer 1
            const lg = new T.BufferGeometry();
            lg.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
            this._driveLine3 = new T.Line(lg, new T.LineDashedMaterial({ dashSize: 0.05, gapSize: 0.04 }));
            this._driveLine3.visible = false;
            this._driveLine3.frustumCulled = false;
            this._iss.add(this._driveLine3);
            let down = null;
            renderer.domElement.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
            let lastTap = null;
            renderer.domElement.addEventListener('pointerup', function (e) {
                if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
                    return;
                down = null;
                self._pick3d(e);
                // Touch: a double tap puts the 3D view back to its starting angle.
                if (e.pointerType !== 'touch')
                    return;
                const now = performance.now();
                if (lastTap && now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
                    lastTap = null;
                    self._touched3d = false;
                    if (self._drive)
                        self._driveView3d();
                    else
                        self._fit3d();
                    self._render3d();
                }
                else
                    lastTap = { t: now, x: e.clientX, y: e.clientY };
            });
            this._build3dStatic();
            this._build3dDynamic();
            this._resize3d();
            this._fit3d();
            this._drawAll(); // the camera picture can now be rendered as the station
        }
        _mat(color, opacity, kind) {
            const key = color + '|' + opacity + '|' + (kind || 'basic');
            if (this._mats[key])
                return this._mats[key];
            let T = this._T, m;
            if (kind === 'line')
                m = new T.LineBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity });
            else if (kind === 'dash')
                m = new T.LineDashedMaterial({ color: color, dashSize: 0.04, gapSize: 0.03 });
            else if (kind === 'lambert')
                m = new T.MeshLambertMaterial({ color: color, transparent: opacity < 1, opacity: opacity });
            else
                m = new T.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: opacity >= 1, side: T.DoubleSide });
            this._mats[key] = m;
            return m;
        }
        _label3d(text, color, h) {
            const key = text + '|' + color;
            let T = this._T, tex = this._labels[key];
            if (!tex) {
                const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), px = 48;
                ctx.font = '600 ' + px + 'px system-ui,"Noto Sans Bengali",sans-serif';
                const w = Math.ceil(ctx.measureText(text).width) + 16;
                cv.width = w;
                cv.height = px + 16;
                ctx.font = '600 ' + px + 'px system-ui,"Noto Sans Bengali",sans-serif';
                ctx.fillStyle = color;
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 8, cv.height / 2 + 2);
                tex = new T.CanvasTexture(cv);
                tex.userData = { aspect: w / cv.height };
                this._labels[key] = tex;
            }
            const mat = new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
            const sp = new T.Sprite(mat);
            h = h || 0.1;
            sp.scale.set(h * tex.userData.aspect, h, 1);
            sp.userData.lh = h;
            sp.userData.aspect = tex.userData.aspect; // shrunk near the camera in _renderNow
            sp.renderOrder = 10;
            return sp;
        }
        // An ArUco pattern as a texture: 8 x 8 cells (white margin, black border, 4 x 4 bits), sharp pixels.
        _markerTex(bits) {
            const key = 'aruco:' + bits, T = this._T;
            if (this._labels[key])
                return this._labels[key];
            const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), u = 8;
            cv.width = cv.height = 8 * u;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 8 * u, 8 * u);
            ctx.fillStyle = '#000';
            ctx.fillRect(u, u, 6 * u, 6 * u);
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 16; i++)
                if (bits.charAt(i) === '1')
                    ctx.fillRect((2 + i % 4) * u, (2 + Math.floor(i / 4)) * u, u, u);
            const tex = new T.CanvasTexture(cv);
            tex.magFilter = T.NearestFilter;
            tex.minFilter = T.LinearFilter;
            tex.generateMipmaps = false;
            this._labels[key] = tex;
            return tex;
        }
        _boxMesh(b, color, opacity, group) {
            const T = this._T, size = Core.boxSize(b).map(function (s) { return Math.max(s, 0.012); }), c = Core.boxCenter(b);
            const m = new T.Mesh(this._geo.box, this._mat(color, opacity));
            m.scale.set(size[0], size[1], size[2]);
            m.position.set(c[0], c[1], c[2]);
            group.add(m);
            const eg = new T.EdgesGeometry(new T.BoxGeometry(size[0], size[1], size[2]));
            const e = new T.LineSegments(eg, this._mat(color, 0.9, 'line'));
            e.position.copy(m.position);
            e.userData.ownGeo = true;
            group.add(e);
            return m;
        }
        _rod(a, b, r, mat, group) {
            const T = this._T, d = Core.sub(b, a), L = Core.len(d);
            if (L < 1e-6)
                return null;
            const m = new T.Mesh(this._geo.cyl, mat), mid = Core.lerp(a, b, 0.5);
            m.scale.set(r, L, r);
            m.position.set(mid[0], mid[1], mid[2]);
            m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(d[0] / L, d[1] / L, d[2] / L));
            group.add(m);
            return m;
        }
        _arrow3d(from, dir, L, r, mat, group) {
            const T = this._T, head = Math.min(L * 0.35, 0.08), u = Core.norm(dir);
            const tip = Core.add(from, Core.scale(u, L)), neck = Core.add(from, Core.scale(u, L - head));
            this._rod(from, neck, r, mat, group);
            const cone = new T.Mesh(this._geo.cone, mat), mid = Core.lerp(neck, tip, 0.5);
            cone.scale.set(r * 2.6, head, r * 2.6);
            cone.position.set(mid[0], mid[1], mid[2]);
            cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(u[0], u[1], u[2]));
            group.add(cone);
        }
        _clearGroup(g) {
            while (g.children.length) {
                const o = g.children.pop();
                o.traverse(function (x) {
                    if (x.userData && x.userData.ownGeo && x.geometry)
                        x.geometry.dispose();
                    if ((x.isSprite || (x.userData && x.userData.ownMat)) && x.material)
                        x.material.dispose();
                });
            }
        }
        _build3dStatic() {
            if (!this._T)
                return;
            const T = this._T, c = this._c, cfg = this._config, g = this._static, self = this;
            this._clearGroup(g);
            Object.keys(this._mats).forEach(function (k) { self._mats[k].dispose(); });
            this._mats = {};
            Object.keys(this._labels).forEach(function (k) { self._labels[k].dispose(); });
            this._labels = {};
            this._scene.background = new T.Color(c['view-bg']);
            const wb = Core.worldBounds(cfg), center = Core.lerp(wb.min, wb.max, 0.5);
            this._iss.position.set(-center[0], -center[1], -center[2]);
            this._center = center;
            cfg.kiz.forEach(function (b) {
                self._boxMesh(b, c.kiz, 0.05, g);
                if (cfg.kiz.length < 2)
                    return;
                const l = self._label3d(b.name, c.kiz, 0.09);
                l.position.set(b.min[0] + 0.15, b.min[1] + 0.1, b.min[2] - 0.05);
                g.add(l);
            });
            // Side names at the ends, overhead and deck of the keep-in box.
            const kb = Core.kizBounds(cfg), kc = Core.lerp(kb.min, kb.max, 0.5);
            [['-x', [kb.min[0] - 0.25, kc[1], kc[2]]], ['+x', [kb.max[0] + 0.25, kc[1], kc[2]]], ['-z', [kc[0], kc[1], kb.min[2] - 0.15]], ['+z', [kc[0], kb.max[1] + 0.2, kb.max[2]]]].forEach(function (sd) {
                if (!cfg.sides[sd[0]])
                    return;
                const l = self._label3d(sideName(cfg, sd[0]), c.muted, 0.13);
                l.position.set(sd[1][0], sd[1][1], sd[1][2]);
                g.add(l);
            });
            cfg.oasis.forEach(function (b) { self._boxMesh(b, c.oasis, 0.12, g); });
            cfg.koz.forEach(function (b) {
                self._boxMesh(b, c.koz, 0.3, g);
                const l = self._label3d(b.name, c.koz, 0.09), cc = Core.boxCenter(b);
                l.position.set(cc[0], cc[1], b.min[2] - 0.06);
                g.add(l);
            });
            cfg.targets.forEach(function (t) {
                // A 2 cm marker is invisible at this scale, so draw its real pattern 3x larger (6 cm plus margin).
                const bits = Core.markerBits(t);
                if (bits) {
                    const plate = new T.Mesh(self._geo.plane, new T.MeshBasicMaterial({ map: self._markerTex(bits), side: T.FrontSide }));
                    const pp = Core.add(t.pos, Core.scale(t.normal, 0.003)), ps = t.size * 3 * 8 / 6;
                    plate.scale.set(ps, ps, 1);
                    plate.position.set(pp[0], pp[1], pp[2]);
                    plate.quaternion.set(t.q[0], t.q[1], t.q[2], t.q[3]);
                    plate.userData.ownMat = true;
                    g.add(plate);
                }
                else {
                    const shown = t.pos ? { min: t.min.map(function (v, k) { return t.max[k] - v > 1e-6 ? t.pos[k] - 0.03 : v; }), max: t.max.map(function (v, k) { return v - t.min[k] > 1e-6 ? t.pos[k] + 0.03 : v; }) } : t;
                    self._boxMesh(shown, c.target, 0.8, g);
                }
                const text = self._targetLabel(t);
                if (!text)
                    return;
                const cc = Core.add(Core.targetCenter(t), Core.scale(t.normal, 0.1)), l = self._label3d(text, c.target, 0.09);
                l.position.set(cc[0], cc[1], cc[2]);
                g.add(l);
            });
            // checkpoints: a solid point, the line of sight and the top (+Z) to match
            cfg.checkpoints.forEach(function (cp) {
                const p = cp.pos, m = new T.Mesh(self._geo.sphere, self._mat(c.cp, 1, 'lambert'));
                m.scale.set(0.025, 0.025, 0.025);
                m.position.set(p[0], p[1], p[2]);
                g.add(m);
                if (cp.marker) {
                    const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(p[0], p[1], p[2]), new T.Vector3(cp.marker[0], cp.marker[1], cp.marker[2])]), self._mat(c.cp, 1, 'dash'));
                    ln.computeLineDistances();
                    ln.userData.ownGeo = true;
                    g.add(ln);
                }
                if (cp.q)
                    self._rod(p, Core.add(p, Core.scale(Core.topDir(cp.q), 0.14)), 0.006, self._mat(c.top, 1), g);
                const l = self._label3d(cp.name + (cp.id === cfg.goal ? L(' (goal)', ' (গোল)') : ''), c.cp, 0.09);
                l.position.set(p[0], p[1], p[2] - 0.08);
                g.add(l);
            });
            // start (dock) and preset poses
            const dock = new T.Mesh(this._geo.box, this._mat(c.robot, 0.8, 'lambert')), sp = cfg.start.pos;
            dock.scale.set(0.08, 0.08, 0.08);
            dock.position.set(sp[0], sp[1], sp[2]);
            g.add(dock);
            const dl = this._label3d(cfg.start.name, c.muted, 0.09);
            dl.position.set(sp[0], sp[1], sp[2] + 0.12);
            g.add(dl);
            cfg.poses.forEach(function (p) {
                const m = new T.Mesh(self._geo.sphere, self._mat(c.sel, 1, 'lambert'));
                m.scale.set(0.03, 0.03, 0.03);
                m.position.set(p.pos[0], p.pos[1], p.pos[2]);
                g.add(m);
                self._arrow3d(p.pos, Core.cameraDir(p.q), 0.25, 0.007, self._mat(c.sel, 1), g);
                const l = self._label3d(p.name, c.sel, 0.09);
                l.position.set(p.pos[0], p.pos[1], p.pos[2] - 0.1);
                g.add(l);
            });
            // 0.5 m grid on the deck plane (largest z)
            const zDeck = wb.max[2] + 0.01, pts = [], step = 0.5;
            const x0 = Math.floor(wb.min[0] / step) * step, x1 = Math.ceil(wb.max[0] / step) * step;
            const y0 = Math.floor(wb.min[1] / step) * step, y1 = Math.ceil(wb.max[1] / step) * step;
            for (let x = x0; x <= x1 + 1e-9; x += step)
                pts.push(new T.Vector3(x, y0, zDeck), new T.Vector3(x, y1, zDeck));
            for (let y = y0; y <= y1 + 1e-9; y += step)
                pts.push(new T.Vector3(x0, y, zDeck), new T.Vector3(x1, y, zDeck));
            const grid = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), this._mat(c.grid, 1, 'line'));
            grid.userData.ownGeo = true;
            g.add(grid);
            // axes gizmo
            const o = [x0, y0, zDeck], len = 0.5;
            [[[1, 0, 0], '#e5484d', '+x'], [[0, 1, 0], '#30a46c', '+y'], [[0, 0, 1], '#3e63dd', L('+z (deck)', '+z (মেঝে)')]].forEach(function (ax) {
                self._arrow3d(o, ax[0], len, 0.009, self._mat(ax[1], 1), g);
                const l = self._label3d(ax[2], ax[1], 0.09), tip = Core.add(o, Core.scale(ax[0], len + 0.1));
                l.position.set(tip[0], tip[1], tip[2]);
                g.add(l);
            });
            // robot
            this._clearGroup(this._robot3);
            let rs = cfg.robot.size, body;
            // A solid, near-white body (like Int-Ball2) with a thin dark outline (its back faces drawn a little larger),
            // so it stands out against the walls, the grid and the deck in either theme.
            const sphere = cfg.robot.shape === 'sphere', geo = sphere ? this._geo.sphere : this._geo.box, half = sphere ? rs / 2 : rs;
            body = new T.Mesh(geo, this._mat('#eef1f6', 1, 'lambert'));
            body.scale.set(half, half, half);
            const edge = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#0d1118', side: T.BackSide }));
            edge.scale.set(half * 1.12, half * 1.12, half * 1.12);
            edge.userData.ownMat = true;
            this._robot3.add(body, edge);
            if (sphere)
                this._robotDetails(rs / 2);
            else {
                const lens = new T.Mesh(this._geo.box, this._mat(c.cam, 1, 'lambert'));
                lens.scale.set(0.02, rs * 0.35, rs * 0.35);
                lens.position.set(rs / 2 + 0.01, 0, 0);
                this._robot3.add(lens);
            }
            this._arrow3d([0, 0, 0], [1, 0, 0], rs / 2 + 0.25, 0.008, this._mat(c.cam, 1), this._robot3);
            // The robot's top (body +Z), to compare with each checkpoint's: that is the roll to match.
            this._rod([0, 0, rs / 2 - 0.01], [0, 0, rs / 2 + 0.1], 0.006, this._mat(c.top, 1), this._robot3);
            this._robot3.traverse(function (o) { o.layers.set(1); });
            this._place3dRobot();
        }
        _build3dDynamic() {
            if (!this._T)
                return;
            const T = this._T, c = this._c, g = this._dynamic, a = this._analysis, self = this, cfg = this._config;
            this._clearGroup(g);
            this._wpMeshes = [];
            const okMat = this._mat(c.route, 1), badMat = this._mat(c.bad, 1);
            a.legs.forEach(function (l) {
                self._rod(l.from, l.to, l.clear ? 0.006 : 0.008, l.clear ? okMat : badMat, g);
                if (!l.clear) {
                    const h = new T.Mesh(self._geo.sphere, badMat);
                    h.scale.set(0.03, 0.03, 0.03);
                    h.position.set(l.hit[0], l.hit[1], l.hit[2]);
                    g.add(h);
                }
            });
            this._route.forEach(function (w, i) {
                const sel = i === self._sel, r = w.via ? 0.022 : 0.035;
                const m = new T.Mesh(self._geo.sphere, self._mat(sel ? c.sel : (w.via ? c.robot : c.wp), 1, 'lambert'));
                m.scale.set(r, r, r);
                m.position.set(w.pos[0], w.pos[1], w.pos[2]);
                m.userData.wp = i;
                g.add(m);
                self._wpMeshes.push(m);
                if (!w.via || sel)
                    self._arrow3d(w.pos, Core.cameraDir(a.poses[i].q), sel ? 0.3 : 0.2, sel ? 0.007 : 0.005, self._mat(sel ? c.sel : c.wp, 1), g);
                if (!w.via) {
                    const l = self._label3d(String(i + 1), sel ? c.sel : c.wp, 0.1);
                    l.position.set(w.pos[0], w.pos[1], w.pos[2] - 0.08);
                    g.add(l);
                }
            });
            this._mission.goals.forEach(function (gl) {
                const cpd = gl.done && gl.kind === 'checkpoint' && Core.findCheckpoint(cfg, gl.id);
                if (cpd) {
                    const ms = new T.Mesh(self._geo.sphere, self._mat(c.ok, 1, 'lambert'));
                    ms.scale.set(0.03, 0.03, 0.03);
                    ms.position.set(cpd.pos[0], cpd.pos[1], cpd.pos[2]);
                    g.add(ms);
                    return;
                }
                const tg = gl.done && Core.findTarget(cfg, gl.id);
                if (!tg)
                    return;
                const grow = { min: Core.sub(tg.min, [0.02, 0.02, 0.02]), max: Core.add(tg.max, [0.02, 0.02, 0.02]) };
                self._boxMesh(grow, c.ok, 0.35, g);
            });
            let sw = this._route[this._sel], tt;
            if (sw && sw.mode === 'target' && (tt = Core.findTarget(cfg, sw.target))) {
                const tc = Core.targetCenter(tt);
                const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(sw.pos[0], sw.pos[1], sw.pos[2]), new T.Vector3(tc[0], tc[1], tc[2])]), this._mat(c.cam, 1, 'dash'));
                line.computeLineDistances();
                line.userData.ownGeo = true;
                g.add(line);
            }
            this._place3dRobot();
        }
        // The ball's stripe, lens and fan sockets on a ball of radius R (robots.ts).
        _robotDetails(R) {
            const self = this;
            addBallDetails(this._T, this._robot3, R, function (color) { return self._mat(color, 1, 'lambert'); });
        }
        _place3dRobot() {
            if (!this._T || !this._robot3)
                return;
            const p = this._robotNow();
            this._robot3.position.set(p.pos[0], p.pos[1], p.pos[2]);
            this._robot3.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
            this._update3dDriveLine();
            this._render3d();
        }
        _update3dDriveLine() {
            const L = this._driveLine3;
            if (!L)
                return;
            L.visible = !!this._drive;
            if (!this._drive)
                return;
            const a = this._driveFrom().pos, b = this._drive.pos, arr = L.geometry.attributes.position.array;
            arr[0] = a[0];
            arr[1] = a[1];
            arr[2] = a[2];
            arr[3] = b[0];
            arr[4] = b[1];
            arr[5] = b[2];
            L.geometry.attributes.position.needsUpdate = true;
            L.computeLineDistances();
            L.material.color.set(Core.checkSegment(this._config, a, b).clear ? this._c.route : this._c.bad);
        }
        _pick3d(e) {
            if (!this._wpMeshes || !this._wpMeshes.length)
                return;
            const T = this._T, r = this._renderer.domElement.getBoundingClientRect();
            const ndc = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
            this._raycaster.setFromCamera(ndc, this._camera);
            const hit = this._raycaster.intersectObjects(this._wpMeshes, false)[0];
            if (hit)
                this._select(hit.object.userData.wp, true);
        }
        // Zoom so the point under the cursor (on the plane through the orbit target, facing the camera)
        // stays under the cursor: scale the camera and the target about that point.
        _zoom3dAt(e) {
            this._touched3d = true;
            const T = this._T, cam = this._camera, ctl = this._controls, r = this._renderer.domElement.getBoundingClientRect();
            if (!r.width || !r.height)
                return;
            this._raycaster.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
            const n = new T.Vector3(), p = new T.Vector3();
            cam.getWorldDirection(n);
            if (!this._raycaster.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(n, ctl.target), p))
                return;
            const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
            let dist = cam.position.distanceTo(ctl.target), k = Math.exp(Math.max(-300, Math.min(300, dy)) * 0.0015);
            k = Math.min(Math.max(k, 0.15 / dist), 80 / dist); // stay between 15 cm and 80 m from the target
            cam.position.sub(p).multiplyScalar(k).add(p);
            ctl.target.sub(p).multiplyScalar(k).add(p);
            ctl.update();
            this._render3d();
        }
        // Touch, the usual way for a 3D view: one finger turns around the module (orbit), two fingers pinch to zoom
        // toward them and drag to slide the view, both at once. On a phone held upright in a page (_scroll3d) one
        // finger up or down still scrolls the page and sideways turns the view, so the 3D view never traps the page.
        _setupMapTouch(el) {
            let self = this, g = null;
            function read(e) {
                const a = e.touches[0], b = e.touches[1];
                return { dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
            }
            el.addEventListener('touchstart', function (e) {
                if (e.touches.length !== 2) {
                    g = null;
                    return;
                }
                g = { last: read(e) };
                self._touched3d = true;
                e.preventDefault();
            }, { passive: false });
            el.addEventListener('touchmove', function (e) {
                if (!g || e.touches.length !== 2)
                    return;
                e.preventDefault();
                e.stopPropagation();
                const r = read(e), p = g.last, T = self._T, cam = self._camera, ctl = self._controls;
                // Pinch: zoom toward the point between the fingers.
                if (Math.abs(Math.log(r.dist / p.dist)) > 1e-4)
                    self._zoom3dAt({ clientX: r.mx, clientY: r.my, deltaY: Math.log(p.dist / r.dist) / 0.0015, deltaMode: 0 });
                // Drag: slide the view with the fingers (the point under them follows them).
                const h = el.getBoundingClientRect().height || 1, d = cam.position.distanceTo(ctl.target);
                const k = 2 * d * Math.tan(cam.fov * Math.PI / 360) / h;
                const right = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrix, 1);
                const mv = right.multiplyScalar(-(r.mx - p.mx) * k).add(up.multiplyScalar((r.my - p.my) * k));
                cam.position.add(mv);
                ctl.target.add(mv);
                g.last = r;
                ctl.update();
                self._render3d();
            }, { passive: false });
            el.addEventListener('touchend', function (e) { if (e.touches.length < 2)
                g = null; });
            el.addEventListener('touchcancel', function () { g = null; });
            // Upright in a page: OrbitControls would block the page scroll (it cancels every touch), so single touches
            // are stopped on the way down (capture phase on the canvas's parent) and handled here: sideways turns the
            // view; up / down is left to the browser, which scrolls the page (touch-action: pan-y). Rolling the
            // module needs the roll wheel (_setupRollWheel): a phone scrolls as soon as a vertical drag starts.
            let one = null;
            const holder = el.parentNode;
            holder.addEventListener('touchstart', function (e) {
                one = e.touches.length === 1 && self._scroll3d ? { x: e.touches[0].clientX, y: e.touches[0].clientY, turning: false } : null;
                if (one)
                    e.stopPropagation();
            }, { capture: true, passive: true });
            holder.addEventListener('touchmove', function (e) {
                if (!one || e.touches.length !== 1)
                    return;
                e.stopPropagation();
                const x = e.touches[0].clientX, y = e.touches[0].clientY;
                if (!one.turning && Math.abs(x - one.x) > 8 && Math.abs(x - one.x) > Math.abs(y - one.y))
                    one.turning = true;
                if (!one.turning)
                    return;
                const T = self._T, cam = self._camera, ctl = self._controls, h = el.getBoundingClientRect().height || 1;
                cam.position.sub(ctl.target).applyAxisAngle(new T.Vector3(0, 1, 0), -2 * Math.PI * (x - one.x) / h).add(ctl.target);
                one.x = x;
                one.y = y;
                self._touched3d = true;
                ctl.update();
                self._render3d();
            }, { capture: true, passive: true });
        }
        // The roll wheel on the upright 3D view's left edge: drag it up / down to roll the module about its long
        // (airlock - dock) axis. It takes the touch itself (touch-action: none), so the page never scrolls from it.
        _setupRollWheel() {
            const self = this, wheel = this.$('.rollwheel');
            let drag = null;
            wheel.addEventListener('pointerdown', function (e) {
                if (drag)
                    return;
                e.preventDefault();
                e.stopPropagation();
                try {
                    wheel.setPointerCapture(e.pointerId);
                }
                catch (err) { /* already gone */ }
                // Which way to roll so the near side of the module follows the finger: from the side, the near wall
                // moves with it; looking down the axis (from an end) there is no near side, so keep the default.
                const T = self._T, cam = self._camera, c = new T.Vector3(0, cam.position.y, cam.position.z);
                const up = new T.Vector3().setFromMatrixColumn(cam.matrix, 1), v = new T.Vector3(1, 0, 0).cross(c);
                drag = { id: e.pointerId, y: e.clientY, sgn: c.length() > 0.2 * cam.position.length() && v.dot(up) < 0 ? -1 : 1 };
                wheel.classList.add('on');
            });
            wheel.addEventListener('pointermove', function (e) {
                if (!drag || e.pointerId !== drag.id)
                    return;
                e.preventDefault();
                const dy = e.clientY - drag.y, h = wheel.getBoundingClientRect().height || 1;
                drag.y = e.clientY;
                self._issRoot.rotation.x -= drag.sgn * ROLL_PER_WHEEL * dy / h;
                self._rollWheelUi();
                self._touched3d = true;
                self._render3d();
            });
            const end = function (e) { if (drag && e.pointerId === drag.id) {
                drag = null;
                wheel.classList.remove('on');
            } };
            wheel.addEventListener('pointerup', end);
            wheel.addEventListener('pointercancel', end);
            wheel.addEventListener('lostpointercapture', end);
        }
        // The wheel's ridges move with the roll, like a real thumbwheel.
        _rollWheelUi() {
            const wheel = this.$('.rollwheel');
            if (wheel && this._issRoot)
                wheel.style.backgroundPositionY = Math.round((this._issRoot.rotation.x - Math.PI / 2) * 40) + 'px';
        }
        // Reset view: every view back to its starting framing (3D angle, Top / Side / End fit, the camera
        // picture and the small camera window).
        _resetViews() {
            this._touched3d = false;
            if (this._drive)
                this._driveView3d();
            else
                this._fit3d();
            const self = this;
            Object.keys(this._views).forEach(function (k) { const v = self._views[k]; v.fitted = false; v.touched = false; self._resizeView(v); });
            this._ui.pip = true;
            this._camInfoKey = '';
            this._resizeCam();
            this._drawAll();
            this._save();
        }
        // The small log (terminal) shown with the camera + 3D views: short lines from Play and Drive.
        _log(msg, kind) {
            const box = this.$('.term .tlines');
            if (!box)
                return;
            const t = this._logT0 || (this._logT0 = Date.now()), sec = Math.floor((Date.now() - t) / 1000);
            const line = document.createElement('div');
            line.className = kind ? 't-' + kind : '';
            line.innerHTML = '<span class="t-time">' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + '</span>' + esc(msg);
            box.appendChild(line);
            while (box.childNodes.length > 80)
                box.removeChild(box.firstChild);
            box.scrollTop = box.scrollHeight;
        }
        // Collapsed: one line (the latest message); expanded: the usual three lines.
        _setTermMin(min) {
            this._termMin = !!min;
            this._root.classList.toggle('term-min', this._termMin);
            const b = this.$('.termbtn');
            if (b) {
                b.textContent = this._termMin ? '▴' : '▾';
                b.setAttribute('aria-expanded', String(!this._termMin));
                b.title = this._termMin ? L('Expand the log', 'লগ বড় করো') : L('Collapse the log', 'লগ গুটিয়ে রাখো');
                b.setAttribute('aria-label', b.title);
            }
            const box = this.$('.term .tlines');
            if (box)
                box.scrollTop = box.scrollHeight;
        }
        // On a phone held upright (outside full screen) the page must scroll past the tall 3D view: one finger up or
        // down scrolls the page, sideways it turns the view. Elsewhere one finger turns (orbits) the view.
        _applyTouchMode() {
            const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches), on = !!this._narrow && !this._fs && coarse;
            // Drive sticks are for phones and tablets (a narrow layout or full screen). A computer gets the keys: the
            // desktop layout, a mouse or touchpad beside a touch screen, or once a Drive key is pressed.
            this._sticks = touchFirst() && !this._keyboard && (!!this._narrow || !!this._fs);
            this._root.classList.toggle('sticks', this._sticks);
            this._scroll3d = on;
            this._root.classList.toggle('scroll3d', on);
            if (!this._controls || !this._renderer)
                return;
            this._controls.touches.ONE = on ? -1 : this._T.TOUCH.ROTATE;
            this._renderer.domElement.style.touchAction = on ? 'pan-y' : 'none';
        }
        _resize3d() {
            if (!this._renderer)
                return;
            const r = this.$('.cell[data-cell="3d"]').getBoundingClientRect();
            if (r.width < 2 || r.height < 2)
                return;
            this._renderer.setSize(r.width, r.height);
            this._camera.aspect = r.width / r.height;
            this._camera.updateProjectionMatrix();
            // Until the student moves the view, keep the whole module framed (full screen, turning the phone).
            if (!this._touched3d)
                this._fit3d();
            this._drawInsets();
            this._render3d(true);
        }
        // Look at the whole world from direction `dirIss` (ISS frame; default VIEW3D_DIR, the side view),
        // backing off until every corner of the world fills `fill` of the view (default 0.85).
        _fit3d(dirIss, fill) {
            if (!this._camera)
                return;
            const T = this._T, cam = this._camera, wb = Core.worldBounds(this._config), center = Core.lerp(wb.min, wb.max, 0.5);
            const dir = Core.norm(dirIss || VIEW3D_DIR), dv = new T.Vector3(dir[0], -dir[2], dir[1]); // ISS -> three.js (x, -z, y)
            let corners = [], d = Core.dist(wb.min, wb.max), want = fill || 0.85, v = new T.Vector3();
            for (let i = 0; i < 8; i++) {
                const p = Core.sub([[wb.min[0], wb.max[0]][i & 1], [wb.min[1], wb.max[1]][(i >> 1) & 1], [wb.min[2], wb.max[2]][(i >> 2) & 1]], center);
                corners.push(new T.Vector3(p[0], -p[2], p[1]));
            }
            cam.up.set(0, 1, 0);
            this._controls.target.set(0, 0, 0);
            this._issRoot.rotation.x = Math.PI / 2; // the module upright again (deck down)
            this._rollWheelUi();
            for (let it = 0; it < 4; it++) { // the projected size goes roughly as 1 / distance
                cam.position.copy(dv).multiplyScalar(d);
                cam.lookAt(0, 0, 0);
                cam.updateMatrixWorld(true);
                let m = 0;
                corners.forEach(function (c) { v.copy(c).project(cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); });
                if (!isFinite(m) || m <= 0)
                    break;
                d *= m / want;
            }
            cam.position.copy(dv).multiplyScalar(d);
            this._controls.update();
            this._render3d();
        }
        _render3d(now) {
            if (!this._renderer)
                return;
            const self = this;
            if (now) {
                this._renderNow();
                return;
            }
            if (this._raf3d)
                return;
            this._raf3d = requestAnimationFrame(function () { self._raf3d = 0; self._renderNow(); });
        }
        _renderNow() {
            // Labels have a size in metres, so close up (Drive, zoomed in) they would fill the view: shrink the
            // ones nearer than 2.5 m, down to 30 %. Far labels keep their size.
            const cam = this._camera.position, v = this._tmpV || (this._tmpV = new this._T.Vector3());
            this._scene.traverse(function (o) {
                if (!o.isSprite || !o.userData.lh)
                    return;
                o.getWorldPosition(v);
                const k = Math.min(1, Math.max(0.3, v.distanceTo(cam) / 2.5));
                o.scale.set(o.userData.lh * o.userData.aspect * k, o.userData.lh * k, 1);
            });
            // The robot keeps its true size up close, and is drawn larger further away (up to 2.5x) so it never
            // looks smaller than about 13 px in radius: it stays easy to find in the whole-module view.
            if (this._robot3) {
                this._robot3.getWorldPosition(v);
                const r = this._config.robot.size / 2, h = this._renderer.domElement.clientHeight || 1;
                const px = r * (h / 2) / (v.distanceTo(cam) * Math.tan(this._camera.fov * Math.PI / 360));
                const k = Math.min(2.5, Math.max(1, 13 / px));
                this._robot3.scale.set(k, k, k);
            }
            this._renderer.render(this._scene, this._camera);
        }
    }

    /* ---------- 2D orthographic views ---------- */
    class Views2D {
        _setupView(key) {
            const cell = this.$('.cell[data-cell=' + key + ']'), canvas = cell.querySelector('canvas');
            const v = { key: key, def: VIEWS[key], cell: cell, canvas: canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, cx: 0, cy: 0, s: 100, fitted: false, pointers: new Map(), hover: null };
            this._views[key] = v;
            const self = this;
            canvas.addEventListener('pointerdown', function (e) { self._vDown(v, e); });
            canvas.addEventListener('pointermove', function (e) { self._vMove(v, e); });
            canvas.addEventListener('pointerup', function (e) { self._vUp(v, e); });
            canvas.addEventListener('pointercancel', function (e) { self._vUp(v, e); });
            canvas.addEventListener('pointerleave', function () { if (!v.pointers.size) {
                v.hover = null;
                self._drawView(v);
            } });
            canvas.addEventListener('wheel', function (e) {
                e.preventDefault();
                const r = canvas.getBoundingClientRect();
                self._zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
            }, { passive: false });
            canvas.addEventListener('dblclick', function (e) {
                const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
                if (self._hitWp(v, sx, sy, 12) < 0)
                    self._addAt(v, sx, sy);
            });
        }
        _resizeView(v) {
            const r = v.cell.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
            if (r.width < 2 || r.height < 2)
                return;
            v.w = r.width;
            v.h = r.height;
            v.canvas.width = Math.round(r.width * dpr);
            v.canvas.height = Math.round(r.height * dpr);
            v.dpr = dpr;
            if (!v.fitted || !v.touched)
                this._fitView(v); // follow the panel size until the student pans or zooms
            this._drawView(v);
        }
        _fitView(v) {
            const b = Core.worldBounds(this._config), d = v.def;
            const rh = Math.max(0.5, b.max[d.h] - b.min[d.h]), rv = Math.max(0.5, b.max[d.v] - b.min[d.v]);
            // Margins: caption on top, side names around the box, axis numbers along the edges.
            v.s = Math.min((v.w - 70) / (rh * 1.08), (v.h - 96) / (rv * 1.08));
            v.cx = (b.min[d.h] + b.max[d.h]) / 2;
            v.cy = (b.min[d.v] + b.max[d.v]) / 2 - 4 / v.s;
            v.fitted = true;
        }
        _toS(v, p) { return [v.w / 2 + (p[v.def.h] - v.cx) * v.s, v.h / 2 + (p[v.def.v] - v.cy) * v.s]; }
        _toW(v, sx, sy) { return [v.cx + (sx - v.w / 2) / v.s, v.cy + (sy - v.h / 2) / v.s]; }
        _zoomAt(v, sx, sy, f) {
            v.touched = true;
            const before = this._toW(v, sx, sy);
            v.s = Math.max(20, Math.min(4000, v.s * f));
            const after = this._toW(v, sx, sy);
            v.cx += before[0] - after[0];
            v.cy += before[1] - after[1];
            this._drawView(v);
        }
        _hitWp(v, sx, sy, r) {
            let best = -1, bd = r * r, self = this;
            this._route.forEach(function (w, i) {
                const s = self._toS(v, w.pos), dx = s[0] - sx, dy = s[1] - sy, d = dx * dx + dy * dy;
                if (d <= bd || (d <= bd * 1.0001 && i === self._sel)) {
                    bd = d;
                    best = i;
                }
            });
            return best;
        }
        _depthRef() {
            if (this._sel >= 0 && this._route[this._sel])
                return { pos: this._route[this._sel].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + (this._sel + 1) };
            if (this._route.length)
                return { pos: this._route[this._route.length - 1].pos, label: L('waypoint ', 'ওয়েপয়েন্ট ') + this._route.length };
            return { pos: this._config.start.pos, label: this._config.start.name };
        }
        _addAt(v, sx, sy) {
            const wv = this._toW(v, sx, sy), p = this._depthRef().pos.slice(), self = this;
            p[v.def.h] = wv[0];
            p[v.def.v] = wv[1];
            this._addWaypoint(p.map(function (n) { return self._snap(n); }));
        }
        _vDown(v, e) {
            const r = v.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
            try {
                v.canvas.setPointerCapture(e.pointerId);
            }
            catch (err) { /* ignore */ }
            v.pointers.set(e.pointerId, [sx, sy]);
            this._closeMenus();
            if (v.pointers.size === 2) {
                const pts = Array.from(v.pointers.values());
                if (v.drag && v.drag.moved)
                    this._endDrag(v);
                v.drag = null;
                v.pinch = { d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), s: v.s, mid: [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], c: [v.cx, v.cy] };
                v.pan = null;
                return;
            }
            const hit = this._hitWp(v, sx, sy, e.pointerType === 'touch' ? 22 : 12);
            if (hit >= 0) {
                if (this._play)
                    this._stopPlay();
                this._select(hit, true);
                const p = this._route[hit].pos, s = this._toS(v, p);
                v.drag = { i: hit, moved: false, before: JSON.stringify(this._route), off: [s[0] - sx, s[1] - sy], start: [sx, sy] };
            }
            else {
                v.pan = { sx: sx, sy: sy, cx: v.cx, cy: v.cy, moved: false };
            }
        }
        _vMove(v, e) {
            const r = v.canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
            if (v.pointers.has(e.pointerId))
                v.pointers.set(e.pointerId, [sx, sy]);
            v.hover = [sx, sy];
            if (v.pinch && v.pointers.size === 2) {
                const pts = Array.from(v.pointers.values());
                const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
                const mid = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
                v.s = Math.max(20, Math.min(4000, v.pinch.s * d / Math.max(1, v.pinch.d)));
                v.touched = true;
                // keep the world point under the starting midpoint under the current midpoint
                const wx = v.pinch.c[0] + (v.pinch.mid[0] - v.w / 2) / v.pinch.s, wy = v.pinch.c[1] + (v.pinch.mid[1] - v.h / 2) / v.pinch.s;
                v.cx = wx - (mid[0] - v.w / 2) / v.s;
                v.cy = wy - (mid[1] - v.h / 2) / v.s;
                this._drawView(v);
                return;
            }
            if (v.drag) {
                if (!v.drag.moved && Math.hypot(sx - v.drag.start[0], sy - v.drag.start[1]) < 3)
                    return;
                v.drag.moved = true;
                const wv = this._toW(v, sx + v.drag.off[0], sy + v.drag.off[1]), w = this._route[v.drag.i];
                w.pos[v.def.h] = this._snap(wv[0]);
                w.pos[v.def.v] = this._snap(wv[1]);
                const card = this.$('.wp[data-i="' + v.drag.i + '"]');
                if (card)
                    AX.forEach(function (k, j) { const inp = card.querySelector('input[data-f=' + k + ']'); if (inp)
                        inp.value = Core.round(w.pos[j], 4); });
                this._refresh();
                return;
            }
            if (v.pan) {
                if (Math.hypot(sx - v.pan.sx, sy - v.pan.sy) > 3) {
                    v.pan.moved = true;
                    v.touched = true;
                }
                v.cx = v.pan.cx - (sx - v.pan.sx) / v.s;
                v.cy = v.pan.cy - (sy - v.pan.sy) / v.s;
            }
            this._drawView(v);
        }
        _vUp(v, e) {
            v.pointers.delete(e.pointerId);
            if (v.pinch) {
                if (v.pointers.size < 2)
                    v.pinch = null;
                v.pan = null;
                return;
            }
            if (v.drag) {
                if (v.drag.moved)
                    this._endDrag(v);
                v.drag = null;
            }
            if (v.pan) {
                if (!v.pan.moved && e.pointerType === 'touch') {
                    // double tap on empty space adds a waypoint
                    const now = Date.now(), last = v.lastTap;
                    if (last && now - last.t < 350 && Math.hypot(last.x - v.pan.sx, last.y - v.pan.sy) < 24) {
                        this._addAt(v, v.pan.sx, v.pan.sy);
                        v.lastTap = null;
                    }
                    else
                        v.lastTap = { t: now, x: v.pan.sx, y: v.pan.sy };
                }
                v.pan = null;
            }
            if (e.pointerType === 'touch') {
                v.hover = null;
                this._drawView(v);
            }
        }
        _endDrag(v) {
            this._pushUndo(v.drag.before);
            this._userActed = true;
            this._commit({});
        }
        _drawAll() {
            if (!this._built)
                return;
            for (const k in this._views) {
                const v = this._views[k];
                if (v.w && (this._ui.view === 'quad' || this._ui.view === k))
                    this._drawView(v);
            }
            if (this._ui.view === 'cam' || this._ui.view === 'split')
                this._drawCam();
            this._drawInsets();
        }
    }

    /* ---------- world actions ---------- */
    class WorldActions {
        _changeSetting(t) {
            const k = t.getAttribute('data-s'), v = parseFloat(t.value), err = this.$('[data-err=json]');
            const cfg = Core.copy(this._config);
            cfg.settings[k] = v;
            try {
                this._config = Core.normalizeWorld(cfg);
                err.textContent = '';
            }
            catch (ex) {
                err.textContent = ex.message;
                t.value = this._config.settings[k];
                return;
            } // the input shows the number
            this._afterConfig({ world: false });
            this._renderJson();
        }
        _changeKoz(t) {
            const k = +t.getAttribute('data-k'), f = t.getAttribute('data-kf'), z = this._config.koz[k];
            if (!z)
                return;
            if (f === 'name') {
                z.name = t.value || ('KOZ ' + (k + 1));
            }
            else {
                const v = parseFloat(t.value);
                if (!isFinite(v))
                    return;
                const c = Core.boxCenter(z), s = Core.boxSize(z), a = +f.charAt(1);
                if (f.charAt(0) === 'c')
                    c[a] = v;
                else
                    s[a] = Math.max(0.01, v);
                z.min = [0, 1, 2].map(function (j) { return Core.round(c[j] - s[j] / 2, 4); });
                z.max = [0, 1, 2].map(function (j) { return Core.round(c[j] + s[j] / 2, 4); });
            }
            this._afterConfig({ world: false });
            this._renderJson();
        }
        _addKoz() {
            let a = this._analysis, best = null;
            // Put it in the middle of the longest clear move so there is something to route around.
            a.legs.forEach(function (l) { if (l.clear && (!best || l.dist > best.dist))
                best = l; });
            let c = best && best.dist > 0.4 ? Core.lerp(best.from, best.to, 0.5) : Core.boxCenter(this._config.kiz[0]);
            c = c.map(function (v) { return Core.round(v, 3); });
            const n = this._config.koz.length + 1, h = 0.15;
            this._config.koz.push({ name: 'KOZ ' + n, min: Core.sub(c, [h, h, h]), max: Core.add(c, [h, h, h]) });
            this._afterConfig();
            this._toast(L('Added KOZ ' + n + ' (30 cm cube). Edit it in the World tab, then fix the red moves.', 'KOZ ' + n + ' যোগ হয়েছে (30 সেমি কিউব)। ওয়ার্ল্ড ট্যাবে এটা বদলাতে পারো, তারপর লাল পথগুলো ঠিক করো।'));
        }
        // Replace the checkpoint layout, keep the rest of the world.
        // `layout` is raw: checkpoints in either form and the goal (or goalpoint_id); normalizeWorld checks them.
        _setCheckpoints(layout, msg) {
            const cfg = Core.copy(this._config);
            cfg.checkpoints = layout.checkpoints;
            cfg.goal = (layout.goal != null ? layout.goal : layout.goalpoint_id);
            cfg.mission = [];
            this._config = Core.normalizeWorld(cfg);
            this.$('[data-err=json]').textContent = '';
            this._afterConfig();
            if (msg)
                this._toast(msg);
        }
        // A new random layout at difficulty `key` (default: the current layout's level, else Normal).
        _newCheckpoints(key) {
            if (!this._config.targets.some(function (t) { return Core.markerNumber(t) != null && t.pos; })) {
                this._toast(L('This world has no AR markers to place checkpoints at.', 'এই ওয়ার্ল্ডে চেকপয়েন্ট বসানোর মতো কোনো AR মার্কার নেই।'));
                return;
            }
            const lv = Core.levelFor(key) || Core.levelFor(this._config.checkpoints.length) || Core.levelFor('normal');
            const seed = Math.floor(Math.random() * 1e6), layout = Core.makeCheckpoints(this._config, { seed: seed, count: lv.count });
            this._setCheckpoints(layout, L('New ' + lv.name + ' layout (seed ' + seed + '): ' + layout.checkpoints.length + ' checkpoints, goal CP ' + layout.goal + '. Your waypoints stay where they were: plan the route again.', 'নতুন ' + lv.name + ' লেআউট (seed ' + seed + '): ' + layout.checkpoints.length + 'টা চেকপয়েন্ট, গোল CP ' + layout.goal + '। তোমার ওয়েপয়েন্টগুলো আগের জায়গাতেই আছে: রুটটা আবার সাজাও।'));
        }
        _sampleCheckpoints() {
            const d = Core.normalizeWorld(Core.DEFAULT_WORLD);
            this._setCheckpoints({ checkpoints: d.checkpoints, goal: d.goal }, L('Back to the sample checkpoint layout.', 'নমুনা চেকপয়েন্ট লেআউটে ফেরা হলো।'));
        }
        _applyJson() {
            const err = this.$('[data-err=json]'), ta = this.$('textarea.json');
            try {
                let json = JSON.parse(ta.value);
                // A /mission/get_checkpoints response (or its "message" string) pasted from a simulator log.
                if (json && typeof json.message === 'string' && /checkpoints/.test(json.message))
                    json = JSON.parse(json.message);
                if (json && !Array.isArray(json) && !json.kiz && (json.checkpoint_count != null || (Array.isArray(json.checkpoints) && !json.targets))) {
                    this._setCheckpoints({ checkpoints: json.checkpoints, goal: json.goalpoint_id != null ? json.goalpoint_id : json.goal }, L('Loaded ' + json.checkpoints.length + ' checkpoints from the pasted response.', 'পেস্ট করা রেসপন্স থেকে ' + json.checkpoints.length + 'টা চেকপয়েন্ট লোড হয়েছে।'));
                    return;
                }
                this._config = Core.normalizeWorld(json);
                err.textContent = '';
                this._afterConfig();
                this._toast(L('World applied.', 'ওয়ার্ল্ড প্রয়োগ করা হয়েছে।'));
            }
            catch (ex) {
                err.textContent = ex.message;
            }
        }
    }

    /* =====================================================================
     * Web component: <kibo-nav-sandbox>
     * ===================================================================== */
    // HTMLElement only exists in browsers. Node (the tests) loads this module too, but never uses the class.
    const HTMLElementBase = (typeof HTMLElement !== 'undefined' ? HTMLElement : Object);
    class KiboNavSandbox extends HTMLElementBase {
        static get observedAttributes() { return ['theme', 'height', 'config-url', 'mode']; }
        constructor() {
            super();
            this._base = Core.normalizeWorld(Core.DEFAULT_WORLD);
            this._config = Core.copy(this._base);
            this._route = [];
            this._analysis = Core.analyzeRoute(this._config, this._route);
            this._mission = Core.missionStatus(this._config, this._route, this._analysis);
            this._hints = {};
            this._sel = -1;
            this._undo = [];
            this._saves = [];
            this._progress = {};
            this._ui = { tab: 'route', view: null, playSpeed: 2, lang: 'python' };
            this._views = {};
            this._built = false;
            this._userActed = false;
            this._configByApi = false;
            this._routeByApi = false;
            this._play = null;
        }
        /* ---------- lifecycle ---------- */
        connectedCallback() {
            if (!this._built)
                this._build();
            this._applyMode();
            this._applyHeight();
            this._applyTheme();
            this._observe();
            this._refresh();
            this._renderList();
            this._renderWorld();
            this._renderSaves();
            if (!this._booted) {
                this._booted = true;
                this._boot();
            }
            const self = this;
            if (!this._fsFn)
                this._fsFn = function () { if (self._fs === 'real' && !(document.fullscreenElement || document.webkitFullscreenElement))
                    self._exitFullscreen(); };
            document.addEventListener('fullscreenchange', this._fsFn);
            document.addEventListener('webkitfullscreenchange', this._fsFn);
        }
        disconnectedCallback() {
            if (this._fs)
                this._exitFullscreen();
            document.removeEventListener('fullscreenchange', this._fsFn);
            document.removeEventListener('webkitfullscreenchange', this._fsFn);
            this._stopPlay();
            if (this._drive)
                this._toggleDrive(false); // also drops the page-wide key listeners
            if (this._ro)
                this._ro.disconnect();
            if (this._mq && this._mqFn) {
                try {
                    this._mq.removeEventListener('change', this._mqFn);
                }
                catch (e) { /* old Safari */ }
            }
        }
        attributeChangedCallback(name, oldV, newV) {
            if (!this._built || oldV === newV)
                return;
            if (name === 'theme')
                this._applyTheme();
            if (name === 'height')
                this._applyHeight();
            if (name === 'config-url' && newV)
                this._loadConfigUrl(newV, true);
            if (name === 'mode') {
                this._applyMode();
                this._renderList();
            }
        }
        // Guided (default): helpers give rough drafts students must fix. Practice: no helpers at all.
        get _guided() { return (this.getAttribute('mode') || '').toLowerCase() !== 'practice'; }
        get _key() { return STORE_PREFIX + (this.id || 'default'); }
        _applyMode() { if (this._root)
            this._root.classList.toggle('practice', !this._guided); }
        _defaultRoute() { return this._guided ? Core.starterRoute(this._config) : []; }
        /* ---------- public API ---------- */
        setConfig(obj) {
            const cfg = Core.normalizeWorld(obj);
            this._configByApi = true;
            this._config = cfg;
            this._afterConfig();
        }
        getConfig() { return Core.copy(this._config); }
        setRoute(arr) {
            const r = Core.normalizeRoute(arr);
            this._routeByApi = true;
            this._pushUndo(JSON.stringify(this._route));
            this._route = r;
            this._sel = -1;
            this._commit({});
        }
        getRoute() { return Core.copy(this._route); }
        getSummary() {
            const a = this._analysis;
            return { blocked: a.blocked, distance: a.distance, time: a.time, oasis: a.oasis, poses: Core.copy(a.poses), mission: Core.copy(this._mission), score: Core.copy(this._mission.score) };
        }
        getCpp() { return Core.toCpp(this._config, this._route, this._analysis); }
        // Older name: the code from the world's "export" template (C++ in the 7th world).
        getJava() { return Core.toJava(this._config, this._route, this._analysis); }
        getPython() { return Core.toPython(this._config, this._route, this._analysis); }
        getCode(lang) { return Core.toCode(this._config, this._route, this._analysis, lang); }
        // What the robot camera reads now (selected waypoint, Drive or Play pose, else the start).
        readMarkers() { return Core.readMarkers(this._config, this._robotNow()); }
    }
    function defineElement() {
        [Setup, Fullscreen, StateChanges, Events, RouteActions, WorldActions, Saves, Panel, Playback, Views2D, CameraView, View3D, Insets, Drive].forEach(function (part) { mixin(KiboNavSandbox, part); });
        if (!customElements.get('kibo-nav-sandbox'))
            customElements.define('kibo-nav-sandbox', KiboNavSandbox);
        return KiboNavSandbox;
    }

    // Entry point. The build (rollup.config.mjs) bundles src/ into dist/kibo-nav-sandbox.js, one file that works
    // as a plain <script>, as an import in a bundler, and from Node (require() returns Core, for the tests).
    if (typeof module === 'object' && module.exports)
        module.exports = Core;
    if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
        // Namespace for scripts; never overwrite something the host page already named KiboNavSandbox.
        const ns = { Core: Core, version: VERSION, buildBall: buildBall, buildCube: buildCube, ballParts: ballParts };
        if (window.KiboNavSandbox === undefined)
            window.KiboNavSandbox = ns;
        ns.Element = defineElement();
    }

})();
