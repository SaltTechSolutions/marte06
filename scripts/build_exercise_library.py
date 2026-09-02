#!/usr/bin/env python3
"""Regenerate `gymentra-mobile/src/data/exerciseLibrary.ts` (PER-19).

Three inputs, one output:

  exercise_library/Exercise Library.dc.html   the Claude Design canvas the
      anatomy SVG came from — the 39-region body chart is lifted from it
      verbatim, so the design file is kept here as provenance rather than
      the paths being retyped.
  CANONICAL (below)                           the 46 movements, their muscle
      activation and their pose archetype.
  ALIAS (below)                               every exercise line that appears
      in program_templates.seed.json, mapped to one of those 46 — or to None
      where there is deliberately nothing to show.

Run after editing either table, or after the design file changes:

    python3 scripts/build_exercise_library.py

Then run the mobile app's `npm test` — `exerciseLibrary.test.ts` is what
catches an alias pointing at an id that no longer exists.
"""

import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DESIGN = os.path.join(HERE, 'exercise_library', 'Exercise Library.dc.html')
SEED = os.path.join(HERE, 'program_templates.seed.json')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'gymentra-mobile', 'src', 'data', 'exerciseLibrary.ts'))


MUSCLES = {
 "sterno":"Boyun ön","trapFront":"Trapez (üst-ön)","deltFront":"Ön omuz","pecClav":"Göğüs (üst)",
 "pecSternal":"Göğüs (orta-alt)","serratus":"Serratus","biceps":"Biceps","brachialis":"Brachialis",
 "forearmFlex":"Ön kol bükücüler","absUpper":"Karın (üst)","absMid":"Karın (orta)","absLower":"Karın (alt)",
 "oblique":"Yan karın","quadRF":"Ön bacak (orta)","quadVL":"Ön bacak (dış)","quadVM":"Ön bacak (iç)",
 "adductors":"İç bacak","sartorius":"Sartorius","tibialis":"Ön incik","peroneus":"Dış incik",
 "trapUpper":"Trapez (üst)","trapMid":"Trapez (orta)","trapLower":"Trapez (alt)","deltPost":"Arka omuz",
 "infra":"Infraspinatus","teres":"Teres major","lat":"Kanat kası (lat)","erector":"Bel dikleştirici",
 "triLat":"Triceps (yan baş)","triLong":"Triceps (uzun baş)","forearmExt":"Ön kol açıcılar",
 "gluteMax":"Kalça","gluteMed":"Yan kalça","hamBF":"Arka bacak (dış)","hamST":"Arka bacak (iç)",
 "addMagnus":"İç bacak (arka)","gastroLat":"Baldır (dış baş)","gastroMed":"Baldır (iç baş)","soleus":"Soleus",
}

# ---- 15 pose "archetypes" — hand-set joint coords, same viewBox/joint model as the
# 3 designer-authored poses (bench/squat/deadlift kept verbatim). Every canonical
# exercise references one; several exercises legitimately share an archetype
# (e.g. goblet squat and back squat are the same movement, different load).
ARCH = {
 "squat": {  # designer original
  "A": dict(head=[150,46],shoulder=[150,70],elbow=[134,96],wrist=[138,68],hip=[152,134],knee=[152,172],ankle=[150,206],toe=[174,206],bar=[146,66],arrow=[196,112,180,158]),
  "B": dict(head=[144,76],shoulder=[146,100],elbow=[128,124],wrist=[132,98],hip=[130,166],knee=[170,176],ankle=[150,206],toe=[174,206],bar=[142,96]),
 },
 "squat_goblet": {  # bar held at chest, not on back
  "A": dict(head=[150,46],shoulder=[150,70],elbow=[144,100],wrist=[150,120],hip=[152,134],knee=[152,172],ankle=[150,206],toe=[174,206],bar=[150,122],arrow=[196,112,180,158]),
  "B": dict(head=[144,76],shoulder=[146,100],elbow=[140,128],wrist=[146,148],hip=[130,166],knee=[170,176],ankle=[150,206],toe=[174,206],bar=[146,150]),
 },
 "hinge": {  # designer original (deadlift)
  "A": dict(head=[128,96],shoulder=[144,112],elbow=[150,146],wrist=[152,180],hip=[178,142],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[152,182],arrow=[204,172,204,118]),
  "B": dict(head=[150,46],shoulder=[150,70],elbow=[150,104],wrist=[152,140],hip=[152,136],knee=[152,172],ankle=[150,206],toe=[174,206],bar=[152,142]),
 },
 "hip_hinge_dumbbell": {  # RDL / kettlebell deadlift, weight in front not on floor
  "A": dict(head=[150,46],shoulder=[150,70],elbow=[150,102],wrist=[152,138],hip=[152,136],knee=[152,172],ankle=[150,206],toe=[174,206],bar=[152,140]),
  "B": dict(head=[130,94],shoulder=[144,110],elbow=[150,142],wrist=[152,172],hip=[176,140],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[152,174],arrow=[204,168,204,118]),
 },
 "hip_thrust": {  # shoulders on bench, hips drive up
  "A": dict(head=[70,150],shoulder=[92,152],elbow=[92,176],wrist=[92,196],hip=[132,180],knee=[168,180],ankle=[168,206],toe=[190,206],bar=[150,168],
            props=[{"x":56,"y":150,"w":16,"h":42}]),
  "B": dict(head=[70,150],shoulder=[92,150],elbow=[92,174],wrist=[92,194],hip=[132,140],knee=[168,168],ankle=[168,206],toe=[190,206],bar=[150,132],arrow=[150,168,150,140],
            props=[{"x":56,"y":150,"w":16,"h":42}]),
 },
 "bench_press": {  # designer original
  "A": dict(head=[100,138],shoulder=[120,144],elbow=[120,116],wrist=[118,90],hip=[198,148],knee=[230,172],ankle=[230,204],toe=[248,204],bar=[118,90],arrow=[152,96,152,126],
            props=[{"x":70,"y":150,"w":180,"h":14,"r":5},{"x":88,"y":164,"w":12,"h":42},{"x":220,"y":164,"w":12,"h":42}]),
  "B": dict(head=[100,138],shoulder=[120,144],elbow=[138,120],wrist=[118,124],hip=[198,148],knee=[230,172],ankle=[230,204],toe=[248,204],bar=[118,124],
            props=[{"x":70,"y":150,"w":180,"h":14,"r":5},{"x":88,"y":164,"w":12,"h":42},{"x":220,"y":164,"w":12,"h":42}]),
 },
 "incline_press": {  # 30° bench
  "A": dict(head=[86,120],shoulder=[108,132],elbow=[112,104],wrist=[110,78],hip=[176,158],knee=[214,178],ankle=[218,204],toe=[238,204],bar=[110,78],arrow=[146,86,146,116],
            props=[{"x":60,"y":90,"w":40,"h":110,"r":8},{"x":74,"y":160,"w":140,"h":14,"r":5},{"x":200,"y":174,"w":12,"h":34}]),
  "B": dict(head=[86,120],shoulder=[108,132],elbow=[128,108],wrist=[110,110],hip=[176,158],knee=[214,178],ankle=[218,204],toe=[238,204],bar=[110,110],
            props=[{"x":60,"y":90,"w":40,"h":110,"r":8},{"x":74,"y":160,"w":140,"h":14,"r":5},{"x":200,"y":174,"w":12,"h":34}]),
 },
 "seated_overhead_press": {
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[132,90],wrist=[130,64],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[172,206],bar=[130,64],arrow=[178,96,178,66],
            props=[{"x":140,"y":150,"w":22,"h":58,"r":6}]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[144,54],wrist=[150,28],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[172,206],bar=[150,28],
            props=[{"x":140,"y":150,"w":22,"h":58,"r":6}]),
 },
 "standing_row_hinged": {  # barbell row — hinged torso, pull to belly
  "A": dict(head=[128,96],shoulder=[144,112],elbow=[150,146],wrist=[152,178],hip=[178,142],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[152,180]),
  "B": dict(head=[128,96],shoulder=[144,112],elbow=[168,120],wrist=[176,142],hip=[178,142],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[176,144],arrow=[204,182,204,150]),
 },
 "seated_row": {  # cable row, seated, torso upright, pull to torso
  "A": dict(head=[210,60],shoulder=[196,80],elbow=[168,88],wrist=[140,86],hip=[196,150],knee=[196,182],ankle=[196,206],toe=[218,206],bar=[140,86],arrow=[104,86,140,86],
            props=[{"x":178,"y":150,"w":36,"h":16,"r":6}]),
  "B": dict(head=[210,60],shoulder=[196,80],elbow=[214,90],wrist=[212,64],hip=[196,150],knee=[196,182],ankle=[196,206],toe=[218,206],bar=[212,64],
            props=[{"x":178,"y":150,"w":36,"h":16,"r":6}]),
 },
 "lat_pulldown": {  # seated, bar pulled from overhead to chest
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[122,66],wrist=[100,40],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[172,206],bar=[100,40],arrow=[110,86,100,52],
            props=[{"x":140,"y":150,"w":22,"h":58,"r":6}]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[124,96],wrist=[126,122],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[172,206],bar=[126,122],
            props=[{"x":140,"y":150,"w":22,"h":58,"r":6}]),
 },
 "pullup": {  # dead hang → chin over bar. Knees tucked back so the feet are
             # visibly clear of the floor — a hanging figure standing on the
             # ground reads as someone holding a bar, not hanging from one.
  "A": dict(head=[152,74],shoulder=[150,100],elbow=[138,68],wrist=[126,36],hip=[150,160],knee=[148,186],ankle=[176,176],toe=[192,172],bar=[126,34]),
  "B": dict(head=[152,52],shoulder=[150,78],elbow=[140,58],wrist=[126,36],hip=[150,138],knee=[148,164],ankle=[176,154],toe=[192,150],bar=[126,34],arrow=[196,110,196,84]),
 },
 "unilateral_lunge": {  # front leg loaded, rear leg trailing
  "A": dict(head=[150,46],shoulder=[150,70],elbow=[136,96],wrist=[140,120],hip=[152,134],knee=[152,172],ankle=[150,206],toe=[174,206],bar=[140,122]),
  "B": dict(head=[144,70],shoulder=[146,94],elbow=[132,118],wrist=[136,142],hip=[142,152],knee=[176,178],ankle=[176,206],toe=[198,206],bar=[136,144],
            props=[{"x":96,"y":180,"w":14,"h":26,"r":5}]),
 },
 "step_up": {  # stepping onto a box
  "A": dict(head=[110,66],shoulder=[112,90],elbow=[100,116],wrist=[104,140],hip=[114,150],knee=[114,182],ankle=[114,206],toe=[136,206],bar=[104,142],
            props=[{"x":150,"y":174,"w":70,"h":32,"r":4}]),
  "B": dict(head=[176,52],shoulder=[178,76],elbow=[166,102],wrist=[170,126],hip=[180,136],knee=[188,166],ankle=[188,174],toe=[210,174],bar=[170,128],
            props=[{"x":150,"y":174,"w":70,"h":32,"r":4}]),
 },
 "leg_press": {  # seated machine, legs push a sled
  "A": dict(head=[70,146],shoulder=[92,148],elbow=[92,172],wrist=[92,190],hip=[130,172],knee=[104,180],ankle=[104,152],toe=[104,132],bar=[104,120],
            props=[{"x":50,"y":100,"w":30,"h":90,"r":8}]),
  "B": dict(head=[70,146],shoulder=[92,148],elbow=[92,172],wrist=[92,190],hip=[130,172],knee=[178,178],ankle=[220,178],toe=[220,158],bar=[220,148],
            props=[{"x":50,"y":100,"w":30,"h":90,"r":8}]),
 },
 "leg_extension_curl": {  # seated machine, knee flexion/extension
  "A": dict(head=[80,66],shoulder=[92,88],elbow=[80,106],wrist=[92,120],hip=[100,148],knee=[100,180],ankle=[76,190],toe=[60,190],bar=[76,190],
            props=[{"x":64,"y":118,"w":50,"h":36,"r":6}]),
  "B": dict(head=[80,66],shoulder=[92,88],elbow=[80,106],wrist=[92,120],hip=[100,148],knee=[100,180],ankle=[150,168],toe=[168,158],bar=[150,168],
            props=[{"x":64,"y":118,"w":50,"h":36,"r":6}]),
 },
 "calf_raise": {  # standing, heel drop → rise
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[142,110],wrist=[144,136],hip=[150,150],knee=[150,182],ankle=[148,200],toe=[170,206]),
  "B": dict(head=[150,50],shoulder=[150,76],elbow=[142,102],wrist=[144,128],hip=[150,142],knee=[150,174],ankle=[148,192],toe=[168,198],arrow=[110,180,110,158]),
 },
 "plank_prone": {  # forearm plank
  "A": dict(head=[262,150],shoulder=[228,152],elbow=[210,178],wrist=[210,198],hip=[150,150],knee=[90,150],ankle=[46,150],toe=[46,168]),
  "B": None,
 },
 "side_plank": {
  "A": dict(head=[254,120],shoulder=[224,128],elbow=[210,158],wrist=[210,180],hip=[150,142],knee=[90,150],ankle=[46,156],toe=[46,174]),
  "B": None,
 },
 "floor_core_supine": {  # dead bug / curl-up / bird-dog-lite on back
  "A": dict(head=[248,168],shoulder=[220,168],elbow=[200,146],wrist=[200,118],hip=[150,168],knee=[110,150],ankle=[80,168],toe=[60,168]),
  "B": dict(head=[248,168],shoulder=[220,168],elbow=[236,148],wrist=[248,124],hip=[150,168],knee=[150,168],ankle=[176,180],toe=[196,182],arrow=[130,132,158,150]),
 },
 "bird_dog": {  # quadruped, opposite arm and leg extended
  "A": dict(head=[244,134],shoulder=[216,140],elbow=[216,172],wrist=[216,204],hip=[150,140],knee=[150,174],ankle=[150,204],toe=[132,206]),
  # The figure only has one arm and one leg drawn, so extending BOTH left it
  # touching nothing and reading as someone lying down. The supporting arm
  # stays planted; the leg is the limb that visibly extends.
  "B": dict(head=[248,128],shoulder=[218,138],elbow=[218,170],wrist=[218,204],hip=[150,140],knee=[104,130],ankle=[68,122],toe=[52,120],arrow=[92,152,64,136]),
 },
 "quadruped_spine": {  # cat-cow — same setup, but the spine moves, not a limb.
                       # It had been sharing bird-dog's frames, which showed a
                       # leg extending: the wrong movement entirely.
  "A": dict(head=[248,120],shoulder=[216,138],elbow=[216,172],wrist=[216,204],hip=[150,148],knee=[150,174],ankle=[150,204],toe=[132,206]),
  "B": dict(head=[242,148],shoulder=[214,142],elbow=[214,174],wrist=[214,204],hip=[150,126],knee=[150,166],ankle=[150,204],toe=[132,206],arrow=[180,108,180,130]),
 },
 "hinged_fly": {  # reverse fly — needs the hinged torso the standing isolation
                  # rig does not have; upright, it was just a lateral raise.
  "A": dict(head=[128,96],shoulder=[144,112],elbow=[148,144],wrist=[150,176],hip=[178,142],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[150,178]),
  "B": dict(head=[128,96],shoulder=[144,112],elbow=[160,126],wrist=[178,110],hip=[178,142],knee=[156,172],ankle=[150,206],toe=[174,206],bar=[180,108],arrow=[200,168,204,124]),
 },
 "leg_curl_prone": {  # face down, heel toward the glutes. Sharing the seated
                      # extension rig had the knee moving the wrong way.
  "A": dict(head=[262,146],shoulder=[228,148],elbow=[210,166],wrist=[200,182],hip=[150,150],knee=[104,152],ankle=[74,154],toe=[58,154],bar=[74,156],
            props=[{"x":64,"y":158,"w":204,"h":12,"r":5}]),
  "B": dict(head=[262,146],shoulder=[228,148],elbow=[210,166],wrist=[200,182],hip=[150,150],knee=[104,152],ankle=[112,110],toe=[112,94],bar=[112,108],arrow=[58,138,94,114],
            props=[{"x":64,"y":158,"w":204,"h":12,"r":5}]),
 },
 "mobility_bodyweight": {  # arm circles, chin tuck — same rig as the banded
                           # moves but with no implement, so no phantom plate
                           # floating at the hand.
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[122,96],wrist=[98,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[178,96],wrist=[202,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],arrow=[130,60,170,60]),
 },
 "anti_rotation_standing": {  # pallof press
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[132,96],wrist=[112,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[112,96],arrow=[70,96,110,96]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[150,96],wrist=[178,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[178,96]),
 },
 "carry": {  # farmer/suitcase carry — walking, weight at side
  "A": dict(head=[120,58],shoulder=[120,84],elbow=[110,110],wrist=[108,140],hip=[120,150],knee=[110,182],ankle=[104,206],toe=[126,206],bar=[108,142]),
  "B": dict(head=[190,58],shoulder=[190,84],elbow=[180,110],wrist=[178,140],hip=[190,150],knee=[204,182],ankle=[210,206],toe=[232,206],bar=[178,142],arrow=[150,60,180,60]),
 },
 "standing_arm_isolation": {  # curl / lateral raise / triceps pushdown / shrug / ext-rotation share this rig
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[146,110],wrist=[148,138],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[148,140]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[146,110],wrist=[130,86],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[130,86],arrow=[112,120,112,92]),
 },
 "rollout": {  # ab wheel — kneeling, roll out and back
  "A": dict(head=[214,140],shoulder=[192,148],elbow=[178,168],wrist=[176,188],hip=[150,150],knee=[110,182],ankle=[100,192],toe=[118,196]),
  "B": dict(head=[286,166],shoulder=[254,168],elbow=[228,178],wrist=[210,186],hip=[150,150],knee=[110,182],ankle=[100,192],toe=[118,196],arrow=[300,150,270,158]),
 },
 "mobility_generic": {  # arm circles / band pull-apart / chin tuck / face-pull-band — small ROM, standing
  "A": dict(head=[150,58],shoulder=[150,84],elbow=[122,96],wrist=[98,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[98,96]),
  "B": dict(head=[150,58],shoulder=[150,84],elbow=[178,96],wrist=[202,96],hip=[150,150],knee=[150,182],ankle=[150,206],toe=[170,206],bar=[202,96],arrow=[130,60,170,60]),
 },
}

def pattern(id_, tr, en, primary, secondary, diff, equip_tr, equip_en, arch, sets="", rest="", steps=None):
    return dict(id=id_, tr=tr, en=en, difficulty=diff, equipTr=equip_tr, equipEn=equip_en,
                primary=primary, secondary=secondary, archetype=arch,
                setsHint=sets, restHint=rest, steps=steps or [], poseReviewed=False)

EXO = []
def add(*a, **k): EXO.append(pattern(*a, **k))

# ---- ISINMA / MOBILITY (6) ----
add("arm-circles","Kol çevirme","Arm circles",[],[],"BAŞLANGIÇ","Yok","None","mobility_bodyweight",
    steps=[["Kolları yana aç, küçük daireler çiz, gitgide büyüt.","Extend arms out, small circles growing larger."]])
add("cat-cow","Kedi-deve","Cat-cow",["erector"],["absMid"],"BAŞLANGIÇ","Mat","Mat","quadruped_spine",
    steps=[["Emekleme pozisyonunda, nefes verirken sırtı yuvarla, nefes alırken kavis ver.","On all fours, round the spine on exhale, arch on inhale."]])
add("band-pull-apart","Bant pull-apart","Band pull-apart",["deltPost","trapMid"],["infra"],"BAŞLANGIÇ","Direnç bandı","Resistance band","mobility_generic",
    steps=[["Bandı iki elle omuz genişliğinde tut, kürek kemiklerini sıkarak yanlara çek.","Hold band shoulder-width, pull apart squeezing shoulder blades."]])
add("band-external-rotation","Bant ile dış rotasyon","Band external rotation",["infra","teres"],["deltPost"],"BAŞLANGIÇ","Direnç bandı","Resistance band","mobility_generic",
    steps=[["Dirsek gövdeye yapışık 90°, ön kolu dışarı döndür.","Elbow pinned to side at 90°, rotate forearm outward."]])
add("chin-tuck","Çene içeri çekme","Chin tuck",["sterno"],[],"BAŞLANGIÇ","Yok","None","mobility_bodyweight",
    steps=[["Başı geriye kaydır, 5 sn tut, çeneyi kaldırma.","Glide head straight back, hold 5s, don't lift the chin."]])
add("worlds-greatest-stretch","Lunge + gövde rotasyonu","World's greatest stretch",["adductors","oblique"],["gluteMax"],"BAŞLANGIÇ","Yok","None","unilateral_lunge",
    steps=[["Uzun adımla çök, ön diz 90°, göğsü o taraf dizin üstüne döndürerek aç.","Long-step lunge, front knee 90°, rotate chest open over the front knee."]])

# ---- ALT VÜCUT (14) ----
add("goblet-squat","Goblet squat","Goblet squat",["quadRF","quadVL","quadVM","gluteMax"],["adductors","erector"],"BAŞLANGIÇ","Dumbbell/Kettlebell","Dumbbell or kettlebell","squat_goblet",
    sets="3×10",rest="60-90 sn",
    steps=[["Dumbbell'ı göğüs önünde iki elle tut.","Hold the dumbbell at chest height with both hands."],["Kalçayı geriye-aşağı götürerek in, dizler ayak ucu yönünde.","Sit hips back and down, knees tracking over toes."],["Topuklardan iterek kalk.","Drive up through the heels."]])
add("back-squat","Back squat","Barbell back squat",["quadRF","quadVL","quadVM","gluteMax","erector","adductors"],["hamBF","hamST","gastroMed","absMid","trapUpper"],"ORTA-İLERİ","Squat rack + Bar","Squat rack, barbell","squat",
    sets="4×5-8",rest="120-180 sn",
    steps=[["Barı üst trapezin üstüne yerleştir.","Rack the bar on the upper traps."],["Kalçayı geriye-aşağı götürerek in, uyluk en az paralel.","Sit back and down until thighs are at least parallel."],["Topuklardan iterek kalk, dizler içe düşmesin.","Drive through the heels, knees track out."]])
add("front-hack-squat","Front squat / Hack squat","Front squat or hack squat",["quadRF","quadVL","quadVM"],["gluteMax","adductors","absMid"],"ORTA","Squat rack veya makine","Rack or machine","squat_goblet",
    sets="3×8-10",rest="90-120 sn",
    steps=[["Bar ön omuzlarda ya da makinede sırt sabit.","Bar racked on front shoulders, or back braced on the machine."],["Diklemesine in, göğüs yukarıda kalsın.","Descend vertically, chest stays up."]])
add("leg-press","Leg press","Leg press",["quadRF","quadVL","quadVM","gluteMax"],["hamBF","hamST"],"BAŞLANGIÇ","Leg press makinesi","Leg press machine","leg_press",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Ayaklar omuz genişliği, sırt sedyeye yaslı.","Feet shoulder-width, back flat against the pad."],["Dizleri göğse yaklaştır, sonra topuklardan it.","Lower knees toward chest, then drive through the heels."]])
add("rdl","Romanian deadlift","Romanian deadlift",["hamBF","hamST","gluteMax","erector"],["addMagnus","forearmFlex"],"ORTA","Bar veya dumbbell","Barbell or dumbbell","hip_hinge_dumbbell",
    sets="3×8-10",rest="90-120 sn",
    steps=[["Kalçayı geriye it, bar/dumbbell bacağa yakın kalsın.","Push hips back, keep the weight close to the legs."],["Hamstring gerginliğini hissedince kalçayı öne sıkarak kalk.","Feel the hamstring stretch, then drive hips forward to stand."]])
add("deadlift","Deadlift","Conventional deadlift",["erector","gluteMax","hamBF","hamST","lat","trapMid","trapUpper"],["quadRF","forearmFlex","absMid"],"İLERİ","Bar + Plakalar","Barbell and plates","hinge",
    sets="3×4-6",rest="150-240 sn",
    steps=[["Bar orta ayak hizasında, kalçayı geriye it, sırt düz.","Bar over mid-foot, hinge hips back, neutral spine."],["Yerden iterek barı bacak hattına yakın tutup kalk.","Push the floor away, drag the bar close, stand tall."]])
add("hip-thrust","Hip thrust","Hip thrust",["gluteMax"],["hamBF","hamST","absMid"],"BAŞLANGIÇ","Bar veya makine","Barbell or machine","hip_thrust",
    sets="3×10-12",rest="90-120 sn",
    steps=[["Üst sırt sedyeye yaslı, kalçayı yukarı it.","Upper back braced on the bench, drive hips upward."],["Üstte kalçayı 1 sn sık, çene içeride.","Squeeze glutes 1s at the top, chin tucked."]])
add("bulgarian-split-squat","Bulgarian split squat","Bulgarian split squat",["quadRF","quadVL","gluteMax"],["adductors"],"ORTA","Bench + dumbbell","Bench and dumbbells","unilateral_lunge",
    sets="3×8",rest="90 sn",
    steps=[["Arka ayak arkadaki banka yerleştir.","Rear foot elevated on a bench behind you."],["Ön dizle in, topuktan iterek kalk.","Descend on the front leg, drive up through that heel."]])
add("walking-lunge","Walking lunge","Walking lunge",["quadRF","quadVL","gluteMax"],["adductors","hamBF"],"BAŞLANGIÇ","Dumbbell (opsiyonel)","Dumbbells (optional)","unilateral_lunge",
    sets="3×10/bacak",rest="60-90 sn",
    steps=[["Uzun adım at, ön diz 90° olana kadar in.","Step forward, lower until the front knee is ~90°."],["Arka ayağı öne getirerek bir sonraki adıma geç.","Bring the rear foot forward into the next step."]])
add("reverse-lunge","Reverse lunge","Reverse lunge",["quadRF","gluteMax"],["adductors"],"BAŞLANGIÇ","Yok / hafif dumbbell","None or light dumbbells","unilateral_lunge",
    sets="2-3×8/bacak",rest="60-90 sn",
    steps=[["Bir adım geriye çık, ön dizle in.","Step one leg back, lower on the front leg."],["Ön topuktan iterek başlangıca dön.","Drive through the front heel back to start."]])
add("step-up","Step-up","Step-up",["quadRF","gluteMax"],["hamBF"],"BAŞLANGIÇ","Kutu/bench","Box or bench","step_up",
    sets="3×10/bacak",rest="60-90 sn",
    steps=[["Bir ayağı kutuya koy, o bacakla it.","Place one foot on the box, drive through that leg."],["Üstte dikleş, kontrollü in.","Stand tall at the top, step down with control."]])
add("leg-extension","Leg extension","Leg extension",["quadRF","quadVL","quadVM"],[],"BAŞLANGIÇ","Makine","Machine","leg_extension_curl",
    sets="3×12",rest="60-75 sn",
    steps=[["Diz makinenin dönüş noktasıyla hizalı.","Knee aligned with the machine's pivot."],["Bacakları uzat, üstte 1 sn sık.","Extend the legs, squeeze 1s at the top."]])
add("leg-curl","Leg curl","Leg curl",["hamBF","hamST"],["gastroMed"],"BAŞLANGIÇ","Makine","Machine","leg_curl_prone",
    sets="3×12",rest="60-75 sn",
    steps=[["Dizi bük, topuğu kalçaya yaklaştır.","Flex the knee, bring the heel toward the glutes."]])
add("calf-raise","Calf raise","Calf raise",["gastroLat","gastroMed","soleus"],[],"BAŞLANGIÇ","Yok / makine","Bodyweight or machine","calf_raise",
    sets="3×15",rest="45-60 sn",
    steps=[["Topuğu tam indir, sonra parmak ucunda yüksel.","Lower the heel fully, then rise onto the toes."],["Üstte 1 sn tut.","Hold 1s at the top."]])

# ---- ÜST VÜCUT — İTİŞ (5) ----
add("bench-press","Bench press","Barbell bench press",["pecSternal","pecClav","deltFront","triLat","triLong"],["serratus","trapMid","absUpper","lat"],"ORTA","Bench + Bar","Flat bench, barbell","bench_press",
    sets="4×8-10",rest="90-120 sn",
    steps=[["Kürek kemiklerini sık ve aşağı bastır.","Retract and depress the shoulder blades."],["Barı göğsün alt kısmına indir, dirsekler ~45°.","Lower to the lower chest, elbows ~45°."],["Göğüsten iterek kilitle.","Press up and lock out."]])
add("incline-press","Incline dumbbell pres","Incline dumbbell press",["pecClav","deltFront","triLat"],["serratus"],"ORTA","Bank (30°) + dumbbell","Incline bench, dumbbells","incline_press",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Bank 30°, dumbbell'lar göğüs hizasında.","Bench at 30°, dumbbells at chest height."],["Yukarı it, tam kilitleme yapma.","Press up without fully locking the elbows."]])
add("machine-chest-press","Göğüs pres (makine)","Machine chest press",["pecSternal","deltFront","triLat"],["serratus"],"BAŞLANGIÇ","Makine","Machine","bench_press",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Kollar tutamağa, dirsekler bilek altında.","Grip handles, elbows under wrists."],["İterek kilitle, kontrollü geri getir.","Press to lockout, return with control."]])
add("shoulder-press","Omuz pres","Overhead press",["deltFront","triLat","triLong"],["trapUpper","absUpper"],"ORTA","Bar/dumbbell/makine","Barbell, dumbbells, or machine","seated_overhead_press",
    sets="3×8-10",rest="90-120 sn",
    steps=[["Ağırlığı omuz hizasında tut, karnı sık.","Hold the weight at shoulder height, brace the core."],["Baş üstüne it, kilitle.","Press overhead to lockout."]])

# ---- ÜST VÜCUT — ÇEKİŞ (8) ----
add("barbell-row","Barbell row","Barbell row",["lat","trapMid","deltPost","biceps"],["erector","forearmFlex"],"ORTA","Bar","Barbell","standing_row_hinged",
    sets="3-4×6-8",rest="120-150 sn",
    steps=[["Gövde ~45° öne eğik, sırt düz.","Torso hinged ~45°, spine neutral."],["Barı karın altına çek, kürek kemiklerini sık.","Pull the bar to the lower belly, squeeze the shoulder blades."]])
add("single-arm-row","Tek kol dumbbell row","Single-arm dumbbell row",["lat","trapMid","biceps"],["deltPost"],"BAŞLANGIÇ","Bank + dumbbell","Bench, dumbbell","standing_row_hinged",
    sets="3×10-12/kol",rest="60-90 sn",
    steps=[["Bir el ve diz bankta, sırt düz.","One hand and knee on the bench, flat back."],["Dumbbell'ı kalçaya doğru çek.","Row the dumbbell toward the hip."]])
add("chest-supported-row","Chest-supported row","Chest-supported row",["lat","trapMid","deltPost"],["biceps"],"BAŞLANGIÇ","Eğimli bank + dumbbell","Incline bench, dumbbells","standing_row_hinged",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Göğüs eğimli banka yaslı — bel devre dışı.","Chest braced on the incline bench — no low-back strain."],["Dirsekleri gövdeye yakın çekerek kürek kemiklerini sık.","Row with elbows close to the body, squeeze shoulder blades."]])
add("seated-cable-row","Oturarak kürek","Seated cable row",["lat","trapMid","deltPost","biceps"],["erector"],"BAŞLANGIÇ","Kablo makinesi","Cable machine","seated_row",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Göğsü aç, dirsekleri gövdeye yakın çek.","Open the chest, pull with elbows close to the body."],["Kürek kemiklerini sıkarak bitir.","Finish by squeezing the shoulder blades."]])
add("lat-pulldown","Lat pulldown","Lat pulldown",["lat","biceps","trapLower"],["deltPost"],"BAŞLANGIÇ","Kablo makinesi","Cable machine","lat_pulldown",
    sets="3×10-12",rest="75-90 sn",
    steps=[["Barı göğsün üstüne çek, dirsekler aşağı-geri.","Pull the bar to the upper chest, elbows down and back."],["Kontrollü olarak yukarı bırak.","Return under control."]])
add("pullup","Barfiks","Pull-up",["lat","biceps","trapLower"],["deltPost","forearmFlex"],"İLERİ","Barfiks barı","Pull-up bar","pullup",
    sets="3×max",rest="90-120 sn",
    steps=[["Omuzlar aşağı-geri, çeneyi bara kadar çek.","Shoulders down and back, pull chin to the bar."],["Kontrollü in.","Lower with control."]])
add("face-pull","Yüz çekişi","Face pull",["deltPost","trapMid","infra"],[],"BAŞLANGIÇ","Kablo/bant","Cable or band","mobility_generic",
    sets="3×15",rest="45-60 sn",
    steps=[["İpi yüze doğru çek, dirsekler yukarı-geri.","Pull the rope toward the face, elbows up and back."],["Dış rotasyonla bitir.","Finish with external rotation."]])
add("reverse-fly","Dumbbell reverse fly","Dumbbell reverse fly",["deltPost","trapMid"],["infra"],"BAŞLANGIÇ","Dumbbell","Dumbbells","hinged_fly",
    sets="3×12-15",rest="45-60 sn",
    steps=[["Öne eğil, kolları yana açarak kaldır.","Hinge forward, raise arms out to the sides."],["Kürek kemiklerini sıkarak üstte tut.","Squeeze shoulder blades at the top."]])

# ---- İZOLASYON KOL / OMUZ (4) ----
add("lateral-raise","Lateral raise","Lateral raise",["deltFront"],["deltPost"],"BAŞLANGIÇ","Dumbbell","Dumbbells","standing_arm_isolation",
    sets="3×12-15",rest="45-60 sn",
    steps=[["Kolları omuz hizasına kadar yana kaldır.","Raise arms out to shoulder height."],["Kontrollü indir.","Lower with control."]])
add("biceps-curl","Biceps curl","Biceps curl",["biceps","brachialis"],["forearmFlex"],"BAŞLANGIÇ","Dumbbell/bar","Dumbbells or barbell","standing_arm_isolation",
    sets="3×12",rest="45-60 sn",
    steps=[["Dirsekleri gövdeye sabitle, ağırlığı kaldır.","Pin elbows to the sides, curl the weight up."]])
add("triceps-pushdown","Triceps pushdown","Triceps pushdown",["triLat","triLong"],[],"BAŞLANGIÇ","Kablo makinesi","Cable machine","standing_arm_isolation",
    sets="3×12-15",rest="45-60 sn",
    steps=[["Dirsekler gövdeye sabit, ipi aşağı it.","Elbows pinned to the sides, push the rope down."]])
add("shrug","Omuz silkme","Shrug",["trapUpper"],[],"BAŞLANGIÇ","Dumbbell/bar","Dumbbells or barbell","standing_arm_isolation",
    sets="3×12",rest="45-60 sn",
    steps=[["Omuzları kulağa doğru kaldır, 1 sn tut.","Shrug shoulders toward the ears, hold 1s."]])

# ---- CORE (10) ----
add("plank","Plank","Plank",["absMid","absUpper"],["oblique","gluteMax"],"BAŞLANGIÇ","Mat","Mat","plank_prone",
    sets="3×30 sn",rest="30-45 sn",
    steps=[["Dirsekler omuz altında, gövde düz bir çizgi.","Elbows under shoulders, body in a straight line."],["Kalçayı sık, nefes al.","Brace the glutes, breathe."]])
add("side-plank","Side plank","Side plank",["oblique"],["gluteMed"],"BAŞLANGIÇ","Mat","Mat","side_plank",
    sets="3×20-30 sn/taraf",rest="30 sn",
    steps=[["Dirsek omuz altında, kalça, omuz, diz bir çizgide.","Elbow under shoulder, hip-shoulder-knee in one line."]])
add("dead-bug","Ölü böcek","Dead bug",["absMid","absLower"],["oblique"],"BAŞLANGIÇ","Mat","Mat","floor_core_supine",
    sets="3×8/taraf",rest="30-45 sn",
    steps=[["Sırtüstü, kollar tavana, dizler 90°.","Lie on back, arms toward ceiling, knees at 90°."],["Karşı kol ve bacağı uzat, bel yere yapışık kalsın.","Extend opposite arm and leg, keep the low back flat."]])
add("bird-dog","Bird-dog","Bird-dog",["erector","gluteMax"],["absMid"],"BAŞLANGIÇ","Mat","Mat","bird_dog",
    sets="3×6/taraf",rest="30-45 sn",
    steps=[["Emekleme pozisyonunda, karşı kol ve bacağı uzat.","On all fours, extend opposite arm and leg."],["Bel düz kalsın, 5 sn tut.","Keep the spine neutral, hold 5s."]])
add("mcgill-curl-up","McGill curl-up","McGill curl-up",["absUpper"],[],"BAŞLANGIÇ","Mat","Mat","floor_core_supine",
    sets="3×8",rest="30 sn",
    steps=[["Eller belin altında, bir diz bükük.","Hands under the low back, one knee bent."],["Baş ve omuzları 2-3 cm kaldır, 8 sn tut.","Lift head and shoulders 2-3cm, hold 8s."]])
add("pallof-press","Pallof pres","Pallof press",["oblique","absMid"],[],"ORTA","Kablo/bant","Cable or band","anti_rotation_standing",
    sets="3×12/taraf",rest="45 sn",
    steps=[["Kabloyu göğüs önünde tut, öne uzat.","Hold the cable at chest, press straight out."],["Gövde dönmesin.","Resist rotation."]])
add("ab-wheel-rollout","Ab wheel rollout","Ab wheel rollout",["absMid","absUpper"],["lat"],"ORTA","Ab wheel","Ab wheel","rollout",
    sets="3×8",rest="60 sn",
    steps=[["Dizden başla, bel çökmeden ileri yuvarla.","Start kneeling, roll forward without the low back sagging."],["Kalçayı sıkarak geri çek.","Squeeze glutes to pull back."]])
add("hanging-knee-raise","Asılı diz çekme","Hanging knee raise",["absLower","absMid"],["forearmFlex"],"ORTA","Barfiks barı","Pull-up bar","pullup",
    sets="3×10-12",rest="45-60 sn",
    steps=[["Barda asıl, sallanmadan dizleri göğse çek.","Hang from the bar, raise knees to chest without swinging."]])
add("suitcase-carry","Suitcase carry","Suitcase carry",["oblique","absMid"],["forearmFlex","trapUpper"],"BAŞLANGIÇ","Kettlebell/dumbbell","Kettlebell or dumbbell","carry",
    sets="3×30 sn/kol",rest="45 sn",
    steps=[["Tek elde ağırlıkla dik dur, yana eğilmeden yürü.","Stand tall with weight in one hand, walk without leaning."]])
add("glute-bridge","Kalça köprüsü","Glute bridge",["gluteMax"],["hamBF","absMid"],"BAŞLANGIÇ","Mat","Mat","hip_thrust",
    sets="3×12-15",rest="30-45 sn",
    steps=[["Sırtüstü, dizler bükük, ayaklar yerde.","Lie on back, knees bent, feet flat."],["Kalçayı yukarı it, üstte 1-2 sn sık.","Drive hips up, squeeze 1-2s at the top."]])


ALIAS = {
 # warmup/mobility
 "Kol çevirme (öne / arkaya)": "arm-circles",
 "Kol çevirme + kedi-deve": "arm-circles",   # first half; cat-cow covered separately when it's its own line
 "Kol çevirme + omuz silkme": "arm-circles",
 "Kedi-deve (cat-cow)": "cat-cow",
 "Bant pull-apart": "band-pull-apart",
 "Bant pull-apart (veya boş elle kürek kemiği sıkma)": "band-pull-apart",
 "Bant ile dış rotasyon": "band-external-rotation",
 "Bant dış rotasyon": "band-external-rotation",
 "Bant ile omuz dış rotasyon (yoksa boş elle)": "band-external-rotation",
 "Kablo dış rotasyon": "band-external-rotation",
 "Çene içeri çekme (chin tuck)": "chin-tuck",
 "Lunge + gövde rotasyonu (world's greatest stretch)": "worlds-greatest-stretch",
 "Ayak bileği duvar mobilizasyonu": None,
 "Bacak sallama (öne-arkaya, yana)": None,
 "Torasik açılma (yan yatarak kitap açma)": None,
 "Torasik açılma (foam roller üstünde)": None,
 "Scapular şınav / duvarda scapular kaydırma": None,
 "Dead hang (barda asılma)": "pullup",
 "Yerinde hafif koşu / ip atlama": None,
 "Yerinde yürüyüş / hafif zıplama": None,
 "Bisiklet / kürek / yürüyüş bandı": None,
 "Kürek / kol ergometresi / ip atlama": None,
 "Bitiş: bisiklet / kürek": None,
 "Bitiş: yürüyüş bandı eğimli": None,
 "Isınma: hafif kardiyo": None,
 "Soğuma: hafif kardiyo": None,
 "Tempolu kardiyo (bisiklet / eliptik / yürüyüş bandı / dışarıda tempolu yürüyüş)": None,
 "Aralık: 30 sn sert / 90 sn hafif (bisiklet, kürek veya koşu bandı)": None,
 "Devre: goblet squat → şınav → dumbbell row → kettlebell swing → mountain climber": None,
 "Dumbbell devre: curl → lateral raise → pushdown": None,
 "Ana hareketin hafif ilk seti": None,
 "Günün ilk hareketi — boş bar / hafif": None,
 "Vücut ağırlığıyla squat": "goblet-squat",
 "Yan yatarak bacak kaldırma / bantlı yan adım": None,

 # lower
 "Goblet squat": "goblet-squat",
 "Goblet squat (hafif dumbbell)": "goblet-squat",
 "Goblet squat veya leg press": "goblet-squat",
 "Back squat": "back-squat",
 "Hack squat veya front squat": "front-hack-squat",
 "Leg press": "leg-press",
 "Romanian deadlift": "rdl",
 "Romanian deadlift (bar)": "rdl",
 "Romanian deadlift (dumbbell)": "rdl",
 "Kettlebell deadlift (1–4. hafta) → Romanian deadlift (5. haftadan)": "rdl",
 "Deadlift (trap bar tercih) ": "deadlift",
 "Hip thrust (bar veya makine)": "hip-thrust",
 "Kalça köprüsü": "glute-bridge",
 "Kalça köprüsü (glute bridge)": "glute-bridge",
 "Kalça köprüsü / hip thrust": "hip-thrust",
 "Bulgarian split squat": "bulgarian-split-squat",
 "Walking lunge": "walking-lunge",
 "Reverse lunge (geriye adım) — destekle": "reverse-lunge",
 "Step-up (kutu)": "step-up",
 "Leg extension": "leg-extension",
 "Leg curl": "leg-curl",
 "Calf raise": "calf-raise",

 # upper push
 "Bench press": "bench-press",
 "Bench press (bar veya dumbbell)": "bench-press",
 "Incline dumbbell pres": "incline-press",
 "Göğüs pres (makine veya dumbbell)": "machine-chest-press",
 "Göğüs pres (makine)": "machine-chest-press",
 "Dumbbell omuz pres": "shoulder-press",
 "Dumbbell omuz pres (oturarak)": "shoulder-press",
 "Omuz pres (makine veya dumbbell)": "shoulder-press",
 "Overhead press (bar)": "shoulder-press",

 # upper pull
 "Barbell row": "barbell-row",
 "Barbell / kablo row": "barbell-row",
 "Tek kol dumbbell row": "single-arm-row",
 "Chest-supported dumbbell row": "chest-supported-row",
 "Kablo kürek (chest-supported row)": "chest-supported-row",
 "Oturarak kürek": "seated-cable-row",
 "Oturarak kürek (seated row)": "seated-cable-row",
 "Lat pulldown": "lat-pulldown",
 "Lat pulldown (geniş)": "lat-pulldown",
 "Lat pulldown (nötr tutuş)": "lat-pulldown",
 "Lat pulldown veya barfiks": "lat-pulldown",
 "Weighted barfiks veya ağır lat pulldown": "pullup",
 "Yüz çekişi": "face-pull",
 "Yüz çekişi (face pull)": "face-pull",
 "Dumbbell reverse fly": "reverse-fly",
 "Dumbbell reverse fly (öne eğik)": "reverse-fly",
 "Omuz silkme (shrug)": "shrug",

 # arm isolation
 "Lateral raise": "lateral-raise",
 "Biceps curl + triceps pushdown (süperset)": "biceps-curl",
 "Hammer curl + overhead triceps (süperset)": "biceps-curl",

 # core
 "Plank": "plank",
 "Plank (dizden veya ayaktan)": "plank",
 "Side bridge (dizden)": "side-plank",
 "Side plank": "side-plank",
 "Side plank (ayaktan) + üst bacak kaldırma": "side-plank",
 "Ölü böcek": "dead-bug",
 "Ölü böcek (dead bug)": "dead-bug",
 "Bird-dog": "bird-dog",
 "Bird-dog (dirsek-diz temaslı)": "bird-dog",
 "McGill curl-up": "mcgill-curl-up",
 "Pallof pres": "pallof-press",
 "Ab wheel rollout (dizden)": "ab-wheel-rollout",
 "Asılı bacak kaldırma": "hanging-knee-raise",
 "Asılı bacak kaldırma / diz çekme": "hanging-knee-raise",
 "Asılı diz çekme": "hanging-knee-raise",
 "Suitcase carry (tek el kettlebell)": "suitcase-carry",
}


# --- anatomy paths, lifted from the design file ---
def extract_group(html, gid):
    m = re.search(r'<g id="' + gid + r'"[^>]*>(.*?)</g>\s*</defs>', html, re.S)
    body = m.group(1)
    out = []
    for d, fill in re.findall(r'<path d="([^"]+)" fill="([^"]+)"', body):
        out.append((d, fill[5:-3] if fill.startswith('{{ f.') else None))
    return out


def emit_paths(name, paths):
    lines = ["export const %s: { d: string; muscle: string | null }[] = [" % name]
    for d, key in paths:
        lines.append("  { d: '%s', muscle: %s }," % (d, 'null' if key is None else "'%s'" % key))
    lines.append("];")
    return "\n".join(lines)


_html = open(DESIGN).read()
paths_ts = emit_paths('FRONT_PATHS', extract_group(_html, 'halfFront')) + "\n\n" + emit_paths('BACK_PATHS', extract_group(_html, 'halfBack'))

# --- sanity: the alias table must cover every line the templates use ---
_seed = json.load(open(SEED))
_raw = {e['name'] for t in _seed['templates'] for day in t['days'] for e in day['exercises']}
_missing = sorted(n for n in _raw if n not in ALIAS)
if _missing:
    raise SystemExit('Alias haritasinda eksik satirlar:\n  ' + '\n  '.join(_missing))
_ids = {e['id'] for e in EXO}
_bad = sorted(n for n, v in ALIAS.items() if v is not None and v not in _ids)
if _bad:
    raise SystemExit('Alias yanlis hedef gosteriyor:\n  ' + '\n  '.join(_bad))

alias = ALIAS


used_arch = sorted({e['archetype'] for e in EXO})
unused = [a for a in ARCH if a not in used_arch]
print("kullanılan arketip:", len(used_arch), "| kullanılmayan (atılıyor):", unused)
ARCH = {k: v for k, v in ARCH.items() if k in used_arch}

def js(s):
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"

def joints(p):
    if p is None:
        return 'null'
    parts = []
    for k in ('head', 'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'toe'):
        parts.append(f"{k}: [{p[k][0]}, {p[k][1]}]")
    if 'bar' in p:
        parts.append(f"bar: [{p['bar'][0]}, {p['bar'][1]}]")
    if 'arrow' in p:
        parts.append("arrow: [" + ", ".join(str(n) for n in p['arrow']) + "]")
    if 'props' in p:
        pr = ", ".join(
            "{ x: %d, y: %d, w: %d, h: %d%s }" % (r['x'], r['y'], r['w'], r['h'],
                                                  (", r: %d" % r['r']) if 'r' in r else "")
            for r in p['props'])
        parts.append(f"props: [{pr}]")
    return "{ " + ", ".join(parts) + " }"

L = []
A = L.append
A("""// GENERATED — do not hand-edit. Rebuild with
// `marte06/scripts/build_exercise_library.py` (source data lives beside it).
//
// The exercise visualiser (PER-19): 46 canonical movements distilled from the
// ~146 lines across the 14 program templates, each with a muscle-activation
// map and start/end pose frames. Ported from the Claude Design canvas
// "Exercise Library.dc.html", which was itself built against this app's own
// theme tokens.
//
// IMPORTANT — pose frames are ARCHETYPE-DERIVED approximations. Three of them
// (bench press, squat, deadlift) were authored joint-by-joint in the design
// file; the rest reuse a movement-pattern archetype with the same joint model.
// Every entry carries `poseReviewed: false` until a certified trainer has
// checked it, and the detail screen says so on screen. Same discipline as the
// PER-18 template content: generated is a starting point, not an authority.
""")

# --- muscles ---
A("/** The 39 muscle regions the anatomy SVG can shade, with their Turkish labels. */")
A("export const MUSCLE_LABELS: Record<string, string> = {")
for k, v in MUSCLES.items():
    A(f"  {k}: {js(v)},")
A("};\n")
A("export type MuscleId = keyof typeof MUSCLE_LABELS;")
A("export type Activation = 'primary' | 'secondary';\n")

# --- anatomy paths ---
A("// --- Anatomy: one body half; the map mirrors it to draw the other side. ---")
A(paths_ts.strip() + "\n")

# --- pose types + archetypes ---
A("""export interface PoseFrame {
  head: [number, number];
  shoulder: [number, number];
  elbow: [number, number];
  wrist: [number, number];
  hip: [number, number];
  knee: [number, number];
  ankle: [number, number];
  toe: [number, number];
  /** Loaded implement (bar/dumbbell/handle). Absent for bodyweight moves. */
  bar?: [number, number];
  /** [x1,y1,x2,y2] motion hint, drawn dashed on the start frame only. */
  arrow?: [number, number, number, number];
  /** Bench, box, machine pad — drawn behind the figure. */
  props?: { x: number; y: number; w: number; h: number; r?: number }[];
}

/** Start/end frames. `end: null` means an isometric hold — one frame only. */
export interface PoseArchetype {
  start: PoseFrame;
  end: PoseFrame | null;
}
""")
A("export const POSE_ARCHETYPES: Record<string, PoseArchetype> = {")
for k, v in ARCH.items():
    A(f"  {k}: {{")
    A(f"    start: {joints(v['A'])},")
    A(f"    end: {joints(v['B'])},")
    A("  },")
A("};\n")

# --- exercises ---
A("""export interface Exercise {
  id: string;
  tr: string;
  en: string;
  /** BAŞLANGIÇ | ORTA | ORTA-İLERİ | İLERİ */
  difficulty: string;
  equipTr: string;
  equipEn: string;
  primary: MuscleId[];
  secondary: MuscleId[];
  archetype: keyof typeof POSE_ARCHETYPES;
  setsHint: string;
  restHint: string;
  /** [Turkish, English] pairs. */
  steps: [string, string][];
  /** False until a certified trainer has checked the pose frames. */
  poseReviewed: boolean;
}
""")
A("export const EXERCISES: Exercise[] = [")
for e in EXO:
    A("  {")
    A(f"    id: {js(e['id'])}, tr: {js(e['tr'])}, en: {js(e['en'])},")
    A(f"    difficulty: {js(e['difficulty'])}, equipTr: {js(e['equipTr'])}, equipEn: {js(e['equipEn'])},")
    A(f"    primary: [{', '.join(js(m) for m in e['primary'])}],")
    A(f"    secondary: [{', '.join(js(m) for m in e['secondary'])}],")
    A(f"    archetype: {js(e['archetype'])},")
    A(f"    setsHint: {js(e['setsHint'])}, restHint: {js(e['restHint'])},")
    if e['steps']:
        A("    steps: [")
        for tr, en in e['steps']:
            A(f"      [{js(tr)}, {js(en)}],")
        A("    ],")
    else:
        A("    steps: [],")
    A("    poseReviewed: false,")
    A("  },")
A("];\n")

# --- alias map ---
A("""/**
 * Every exercise line that appears in the program templates, mapped to a
 * library entry — or `null` where there is deliberately nothing to show:
 * cardio blocks, one-line circuit descriptions and "the day's first movement,
 * empty bar" placeholders are programming instructions, not single movements
 * with a start and an end pose.
 */""")
A("export const NAME_TO_EXERCISE: Record<string, string | null> = {")
for k in sorted(alias):
    v = alias[k]
    A(f"  {js(k)}: {js(v) if v else 'null'},")
A("};\n")

A("""const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function exerciseById(id: string | undefined): Exercise | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * Resolve a program line to a library entry. Exact match first (that is what
 * the template seed writes), then a loose contains-match so a trainer who
 * typed "Bench press (geniş tutuş)" by hand still lands on the right page.
 */
export function exerciseByName(name: string | undefined): Exercise | null {
  if (!name) return null;
  const exact = NAME_TO_EXERCISE[name];
  if (exact !== undefined) return exact ? (BY_ID.get(exact) ?? null) : null;
  const needle = name.toLocaleLowerCase('tr');
  const hit = EXERCISES.find(
    (e) => needle.includes(e.tr.toLocaleLowerCase('tr')) || needle.includes(e.en.toLocaleLowerCase('tr')),
  );
  return hit ?? null;
}""")

out = "\n".join(L)
open(OUT, 'w').write(out)
print("yazıldı:", len(out), "bayt,", len(EXO), "hareket,", len(ARCH), "arketip")
