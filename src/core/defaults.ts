// Scoring bands, levels and the default 7th Kibo-RPC world.
import type { Quat, Vec3 } from './types.js';
import { L } from '../i18n.js';
const X_AXIS = [1, 0, 0];
const Z_AXIS = [0, 0, 1];
const EPS = 1e-9;

// Margins from the 7th Kibo-RPC programming manual (/mission/get_checkpoints example).
const SCORE_BANDS = [{ radius: 0.1, level: 3 }, { radius: 0.2, level: 2 }, { radius: 0.3, level: 1 }];
const ANGLE_BANDS = [{ angle: 10, level: 3 }, { angle: 20, level: 2 }, { angle: 30, level: 1 }];

// The web simulator's difficulty levels. The documents name them and say a run has 6 to 12
// checkpoints by level, but not how many each level has: these counts are assumed (spread evenly).
const LEVELS = [{ key: 'easy', name: L('Easy', 'সহজ'), count: 6 }, { key: 'normal', name: L('Normal', 'মাঝারি'), count: 8 }, { key: 'hard', name: L('Hard', 'কঠিন'), count: 10 }, { key: 'veryhard', name: L('Very Hard', 'খুব কঠিন'), count: 12 }];
function levelFor(key: string | number | undefined): { key: string; name: string; count: number } | null { for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].key === key || LEVELS[i].count === key) return LEVELS[i]; return null; }

function cpDef(n: number, pos: Vec3, marker: Vec3, q: Quat) {
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
  ].map(function (t: { id: string; name: string; pos: Vec3; q: Quat; size?: number }) { t.size = 0.02; return t; }),
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

export { ANGLE_BANDS, DEFAULT_WORLD, EPS, LEVELS, SCORE_BANDS, X_AXIS, Z_AXIS, levelFor };
