// Words shown in the panel: goal verbs, orientation modes and the progress milestones.
import { L } from '../i18n.js';

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

export { MILESTONES, MODE_LABELS, VERB };
