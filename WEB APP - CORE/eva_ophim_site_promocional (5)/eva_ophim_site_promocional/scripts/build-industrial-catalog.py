"""Build the versioned registry from the supplied inventory and authored recipes.
No network, manufacturer data, or external models are involved.
"""
import json
from pathlib import Path
import unicodedata
import re

ROOT = Path(__file__).resolve().parent.parent
# Each recipe identifies structural features, not just a renamed box.
# id recipe length_cm width_cm height_cm
RECIPES = """
1 mill_universal 180 150 220
2 mill_vertical 150 130 240
3 drill_column 70 90 180
4 boring_horizontal 320 200 240
5 grinder_surface 200 140 170
6 grinder_cylindrical 240 120 160
7 saw_band 160 90 160
8 shear 300 150 200
9 brake 320 180 260
10 punch 220 180 230
11 cutter_laser 400 220 160
12 cutter_plasma 400 220 150
13 edm 160 160 220
14 deburr 160 100 180
15 injection 500 160 220
16 extruder 450 130 220
17 blower 220 180 250
18 thermoform 300 200 220
19 calender 230 150 180
20 rolling 350 200 190
21 press_eccentric 180 150 260
22 stamping_cell 500 300 280
23 diecasting 420 180 240
24 blast 240 200 280
25 furnace_treatment 250 210 260
26 quench 220 160 140
27 tank_agitated 150 150 240
28 reactor 200 200 300
29 mixer_horizontal 250 120 160
30 mixer_vertical 160 160 220
31 homogenizer 160 90 130
32 dosing 140 120 200
33 silo 200 200 500
34 hopper 180 180 220
35 exchanger_shell 300 100 160
36 pasteurizer 280 160 200
37 evaporator 220 180 400
38 centrifuge 170 170 160
39 filterpress 320 140 180
40 rotarydryer 500 160 200
41 filler 300 140 220
42 capper 220 120 200
43 labeler 250 120 160
44 sealer 200 100 180
45 cartoner 320 150 180
46 casepacker 300 180 240
47 flowpack 350 100 160
48 shrinktunnel 300 140 170
49 palletizer 400 320 300
50 depalletizer 350 300 350
51 stretchwrapper 220 220 260
52 checkweigher 180 80 120
53 robot_six 180 140 220
54 robot_scara 120 100 150
55 robot_delta 180 180 240
56 robot_xyz 300 220 250
57 robot_cobot 120 100 170
58 robot_cell 350 300 260
59 pickplace 220 150 220
60 feeder_bowl 100 100 120
61 index_table 150 150 110
62 magazine 130 100 200
63 weldpositioner 180 140 160
64 vacuum_handler 220 150 250
65 conveyor_roller 300 80 90
66 conveyor_motor 300 100 90
67 conveyor_curve 200 200 90
68 conveyor_incline 300 90 160
69 belt_curve 200 200 90
70 conveyor_modular 300 100 100
71 conveyor_chain 300 100 90
72 conveyor_overhead 400 180 280
73 conveyor_screw 300 80 140
74 bucket_elevator 100 120 500
75 cargo_elevator 220 220 450
76 transfer_table 150 150 90
77 turntable 160 160 90
78 sorter 350 180 110
79 palletjack_manual 160 70 120
80 palletjack_electric 180 80 130
81 reachtruck 250 130 320
82 stacker 180 100 280
83 tug 200 110 170
84 logistic_train 600 130 170
85 agv 130 90 45
86 amr 110 80 65
87 bridgecrane 800 200 350
88 gantrycrane 700 200 450
89 hoist 80 70 180
90 jibcrane 350 150 380
91 lift_table 200 140 140
92 rack_pallet 270 110 420
93 rack_drivein 270 330 450
94 rack_pushback 270 220 420
95 rack_cantilever 300 120 380
96 rack_flow 270 200 350
97 shelf_picking 200 80 220
98 shelf_light 150 45 200
99 shelf_parts 180 60 200
100 mezzanine 600 400 350
101 miniload 450 220 500
102 shuttle 400 250 450
103 carousel 220 180 350
104 storage_cabinet 220 180 400
105 cage 160 120 160
106 plastic_bin 60 40 35
107 dock_platform 300 250 120
108 dock_leveler 240 200 110
109 dock_shelter 330 90 350
110 sectionaldoor 300 40 320
111 mobile_ramp 600 220 130
112 floor_scale 150 150 20
113 truck_scale 1600 300 40
114 check_station 220 120 180
115 packing_table 200 100 90
116 label_printer 40 35 30
117 barcode_station 50 40 100
118 sorting_station 300 140 150
119 compressor 150 100 140
120 air_receiver 120 120 240
121 air_dryer 100 80 130
122 chiller 300 160 220
123 cooling_tower 240 240 400
124 pump 140 70 90
125 motorpump 220 110 110
126 booster 260 160 180
127 boiler 400 200 240
128 steam_generator 180 150 250
129 plate_exchanger 160 90 180
130 hydraulic_unit 180 110 140
131 vacuum_pump 130 80 100
132 exhaust_fan 150 100 160
133 water_skid 350 180 220
134 buffer_tank 150 150 250
135 dust_collector 220 170 300
136 bag_filter 280 220 350
137 cyclone 150 150 400
138 scrubber 200 150 400
139 settling_tank 350 250 160
140 effluent_plant 600 400 240
141 oil_separator 240 150 140
142 compactor 350 180 200
143 skip 300 180 160
144 recycle_bins 250 80 130
145 paint_booth 400 300 280
146 extraction_booth 250 200 250
147 cmm 180 160 230
148 measuring_arm 120 100 160
149 profile_projector 100 90 150
150 roughness_meter 50 40 55
151 hardness_tester 70 70 130
152 calibration_bench 200 90 180
153 testing_bench 250 120 180
154 scanner3d 80 80 170
155 vision_inspection 160 100 180
156 metal_detector 180 120 170
157 precision_scale 60 50 70
158 inspection_jig 120 90 80
159 maintenance_bench 220 90 170
160 tool_cart 100 60 110
161 tool_cabinet 140 60 200
162 parts_washer 130 90 130
163 ultrasonic_tank 90 70 100
164 balancing_machine 200 100 140
165 electric_testbench 220 90 180
166 trestle 120 80 110
167 scissor_lift 300 180 200
168 lube_station 140 90 160
169 maintenance_cart 120 70 120
170 assembly_table 220 110 90
171 photo_sensor 15 12 25
172 inductive_sensor 15 8 8
173 capacitive_sensor 15 10 10
174 rfid_reader 25 15 30
175 reader2d 18 15 25
176 vision_camera 30 20 35
177 lidar 25 25 25
178 encoder 20 15 15
179 loadcell 25 15 10
180 pressure_sensor 20 15 30
181 thermocouple 8 8 50
182 vibration_sensor 12 12 15
183 extinguisher 35 35 80
184 hydrant 70 40 140
185 safety_shower 120 100 240
186 eyewash 70 60 110
187 spill_kit 90 70 110
188 exit_sign 60 15 30
189 railing 250 25 110
190 protection_fence 200 25 200
191 safety_gate 140 30 200
192 light_curtain 140 25 180
193 barrier 200 60 110
194 bollard 25 25 110
195 convex_mirror 80 20 160
196 traffic_light 45 35 240
197 ergonomic_table 200 90 180
198 adjustable_bench 180 90 120
199 industrial_chair 70 70 120
200 picking_cart 140 80 170
201 operator_station 180 100 180
202 andon 35 35 220
203 hmi 50 30 150
204 computer 80 60 150
205 management_board 220 70 200
206 ppe_cabinet 160 60 200
207 locker_room 400 300 280
208 supervision_cabin 350 300 280
209 column 50 50 400
210 beam 500 30 50
211 wall 400 20 300
212 partition 300 10 250
213 industrial_door 140 25 240
214 fire_door 120 25 240
215 gate 350 30 260
216 window 180 20 140
217 roof 600 400 100
218 skylight 180 140 50
219 stairs 350 120 280
220 ramp 400 150 100
221 walkway 500 120 120
222 platform 300 250 180
223 technical_floor 400 300 50
224 slab 500 400 30
225 qgbt 300 90 220
226 mcc 240 90 220
227 plc_panel 120 60 200
228 control_panel 100 60 180
229 drive 60 40 100
230 transformer 220 150 220
231 ups 120 80 180
232 generator 350 150 200
233 cable_tray 300 60 15
234 cable_ladder 300 80 15
235 busbar 300 30 20
236 luminaire 180 60 30
237 water_pipe 300 20 20
238 air_pipe 300 10 10
239 steam_pipe 300 30 30
240 condensate_pipe 300 15 15
241 exhaust_duct 300 80 80
242 conduit 300 10 10
243 drain 300 30 20
244 valve 70 40 70
245 flange 15 60 60
246 pipe_elbow 100 100 30
247 pipe_tee 140 100 30
248 pipe_support 100 60 120
"""

inventory = json.loads((ROOT / 'app/industrial-library-roadmap.json').read_text(encoding='utf8'))
recipes = {int(row.split()[0]): row.split()[1:] for row in RECIPES.strip().splitlines()}
assert set(recipes) == set(range(1, 249))
catalog = []
for row in inventory['items']:
    number = int(row['id'][-3:])
    recipe, length, width, height = recipes[number]
    length, width, height = [int(v) for v in (length, width, height)]
    conveyor = recipe.startswith(('conveyor_', 'belt_')) or recipe in ('transfer_table', 'turntable', 'sorter')
    pipe = recipe.endswith('_pipe') or recipe in ('conduit', 'exhaust_duct', 'valve', 'flange')
    ports = recipe in ('conveyor_roller', 'conveyor_motor', 'belt_incline', 'conveyor_modular', 'conveyor_chain', 'conveyor_incline', 'conduit', 'exhaust_duct', 'valve', 'flange') or recipe.endswith('_pipe')
    levels = number in (*range(92,100),101,102,103)
    geometry = 'round' if recipe in ('silo', 'tank_agitated', 'reactor', 'buffer_tank', 'air_receiver', 'cyclone', 'centrifuge', 'feeder_bowl', 'index_table', 'turntable') else 'rectangle'
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', row['name']).encode('ascii', 'ignore').decode().lower()).strip('-')
    params = {'levels': {'default': 4, 'min': 1, 'max': 12, 'integer': True}, 'modules': {'default': 2, 'min': 1, 'max': 8, 'integer': True}} if levels else {}
    if recipe == 'conveyor_incline': params['inclination'] = {'default': 12, 'min': 0, 'max': 30}
    if number in (65,66,67,69,70,76,78): params['rollers'] = {'default': 12, 'min': 3, 'max': 48, 'integer': True}
    if recipe == 'stairs': params['steps'] = {'default': 12, 'min': 3, 'max': 32, 'integer': True}
    catalog.append({
        'id': row['id'], 'slug': slug, 'version': '1.0.0', 'name': row['name'], 'category': row['category'],
        'group': 'Infraestrutura' if number > 208 else 'Produção' if number <= 64 else 'Logística' if number <= 118 else 'Utilidades' if number <= 158 else 'Automação e apoio',
        'tool': 'machine', 'w': length, 'd': width, 'height': height,
        'geometry': {'type': 'parametric', 'generator': recipe, 'lod': {'nearSegments':12,'farSegments':6,'distanceInLengths':8}}, 'geometryType': 'parametric', 'footprint': geometry,
        'dimensions': {'length': length / 100, 'width': width / 100, 'height': height / 100, 'unit': 'm'},
        'limits': {'length': {'min': .01, 'max': 50}, 'width': {'min': .01, 'max': 50}, 'height': {'min': .01, 'max': 10}},
        'parameters': params, 'variants': [{'id':'standard','name':'Padrão','scale':1},{'id':'compact','name':'Compacto','scale':.75},{'id':'extended','name':'Ampliado','scale':1.25}], 'animation': number in (65,66,68,70,71),
        'tags': [recipe.replace('_', ' '), 'industrial', 'esteira' if conveyor else 'tubulação' if pipe else slug.replace('-', ' ')],
        'connectors': [{'id':'in','type':'material_flow' if conveyor else 'process_flow','end':-1}, {'id':'out','type':'material_flow' if conveyor else 'process_flow','end':1}] if ports else [],
        'capabilities': {'resizable':True, 'rotatable':True, 'snap':True, 'connectors': ports, 'collision':True, 'assetLink':True},
        'operationClearance': .8 if 53 <= number <= 64 or 79 <= number <= 91 else 0, 'maintenanceClearance': .6 if number < 171 else 0, 'anchor': {'x':0.5,'y':0,'z':0.5}, 'material': {'body':'#487c91','structure':'#667b8e'},
        'origin':'ASTHA · geometria procedural autoral', 'license':'Projeto ASTHA', 'thumbnail':'generated://'+row['id']
    })
out = "/* Generated by scripts/build-industrial-catalog.py; versioned data only. */\n(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ASTHAIndustrialCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{\nconst models=" + json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + ";\nconst byId=Object.fromEntries(models.map(model=>[model.id,Object.freeze(model)]));\nreturn Object.freeze({version:'1.0.0',models:Object.freeze(models),byId:Object.freeze(byId)});\n});\n"
(ROOT / 'app/js/sistema-industrial-catalog.js').write_text(out, encoding='utf8')
print(f'Generated {len(catalog)} unique manifests with explicit geometry recipes.')
