import bpy
import os
import math
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'verification-blender')
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'src','blender','resort-architecture.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=12
scene.cycles.use_denoising=True
scene.render.resolution_x=800
scene.render.resolution_y=800
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(0.22,0.22,0.22)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.42,0.46,0.5,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=0.55
bpy.ops.object.light_add(type='SUN',location=(20,-30,45))
sun=bpy.context.object
sun.name='Inspection_sun'
sun.data.energy=2.3
sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-32))
bpy.ops.object.camera_add()
cam=bpy.context.object
cam.name='Inspection_camera'
scene.camera=cam
cam.data.clip_start=0.1
cam.data.clip_end=600
cam.data.lens=46

def shot(name,target,distance,angle,elevation=32):
    target=Vector(target)
    elev=math.radians(elevation)
    theta=math.radians(angle)
    pos=target+Vector((math.cos(theta)*math.cos(elev)*distance,math.sin(theta)*math.cos(elev)*distance,math.sin(elev)*distance))
    cam.location=pos
    cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(OUT,name+'.png')
    bpy.ops.render.render(write_still=True)

for i in range(8):
    shot(f'context_orbit_{i}',(0,-17,4),100,i*45,32)
shot('context_top',(0,-17,0),95,90,89)
for i in range(5):
    shot(f'clubhouse_close_{i}',(0,0,5),43,i*72,25)
for i in range(5):
    shot(f'gate_close_{i}',(0,-42,3),36,i*72,23)
print('INSPECTION_RENDERED',len(os.listdir(OUT)))
