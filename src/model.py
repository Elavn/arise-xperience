import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(ROOT, 'public', 'models')
SOURCE_DIR = os.path.join(ROOT, 'src', 'blender')
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(SOURCE_DIR, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)

PALETTE = {
    'stone': (0.64, 0.57, 0.45, 1),
    'stone_light': (0.82, 0.76, 0.64, 1),
    'stone_dark': (0.37, 0.34, 0.29, 1),
    'roof_red': (0.55, 0.075, 0.035, 1),
    'roof_orange': (0.83, 0.18, 0.055, 1),
    'roof_brown': (0.12, 0.105, 0.085, 1),
    'roof_seam': (0.29, 0.25, 0.19, 1),
    'glass': (0.075, 0.19, 0.23, 1),
    'glass_light': (0.22, 0.43, 0.47, 1),
    'metal': (0.12, 0.14, 0.13, 1),
    'gold': (0.65, 0.42, 0.12, 1),
    'paving': (0.31, 0.32, 0.29, 1),
}

def material(name, color, roughness=0.7, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if name.startswith('glass'):
        bsdf.inputs['Coat Weight'].default_value = 0.45
        bsdf.inputs['Coat Roughness'].default_value = 0.18
    return mat

MATS = {key: material(key, color, 0.28 if key.startswith('glass') else 0.72, 0.55 if key in ('metal', 'gold') else 0) for key, color in PALETTE.items()}

def group(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj

CLUB = group('Clubhouse')
GATE = group('Arrival_Gate')

def finish(obj, name, mat, parent, bevel=0):
    obj.name = name
    obj.data.materials.append(MATS[mat])
    obj.parent = parent
    if bevel:
        mod = obj.modifiers.new('Soft architectural edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return obj

def box(name, loc, scale, mat='stone', parent=CLUB, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent, bevel)

def cylinder(name, loc, radius, depth, mat='stone', parent=CLUB, vertices=24, radius_top=None):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius_top, depth=depth, location=loc)
    return finish(bpy.context.object, name, mat, parent, 0.025)

def mesh_obj(name, verts, faces, mats, parent=CLUB, indices=None):
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    for mat in mats:
        mesh.materials.append(MATS[mat])
    if indices:
        for poly, index in zip(mesh.polygons, indices):
            poly.material_index = index
    return obj

def line(name, a, b, radius=0.025, mat='metal', parent=CLUB):
    a, b = Vector(a), Vector(b)
    delta = b - a
    obj = cylinder(name, (a + b) / 2, radius, delta.length, mat, parent, vertices=8)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj

def hip_roof(name, center, radius, eave_z, apex_z, sides=8, parent=CLUB, phase=math.pi/8, striped=True):
    cx, cy = center
    verts = [(cx + radius * math.cos(phase + i * math.tau / sides), cy + radius * math.sin(phase + i * math.tau / sides), eave_z) for i in range(sides)]
    verts.append((cx, cy, apex_z))
    faces = [(i, (i + 1) % sides, sides) for i in range(sides)]
    indices = [0 if i % 3 == 0 else 1 for i in range(sides)]
    obj = mesh_obj(name, verts, faces, ['roof_red', 'roof_brown'], parent, indices)
    solid = obj.modifiers.new('Roof thickness', 'SOLIDIFY')
    solid.thickness = 0.12
    for i in range(sides):
        a, b = Vector(verts[i]), Vector(verts[(i + 1) % sides])
        line(name + '_hip', a, (cx, cy, apex_z), 0.045, 'roof_seam', parent)
        if striped:
            for j in range(1, 12):
                p = a.lerp(b, j / 12)
                p.z += 0.035
                line(name + '_standing_seam', p, (cx, cy, apex_z + 0.035), 0.015, 'roof_seam', parent)
    return obj

def crown_roof(name, center, radius, eave_z, apex_z, peaks=8, parent=CLUB, phase=-math.pi/2, deck_drop=0.06):
    # Photo-derived folded octagonal roof: eight outward gables, each on a
    # straight perimeter edge, with paired orange planes falling to a shared
    # central valley. Adjacent sectors share exact eave vertices, not overlaps.
    print('Building', name, flush=True)
    cx, cy = center
    C = Vector((cx, cy, eave_z - deck_drop))
    verts, faces, indices = [], [], []
    half = math.pi / peaks
    details = {}

    def detail_line(label, a, b, radius, mat, parent):
        # Batch narrow roof ribs directly instead of hundreds of bevelled objects.
        a, b = Vector(a), Vector(b)
        direction = (b-a).normalized()
        u = direction.cross(Vector((0,0,1))).normalized()
        if u.length < 0.5:
            u = Vector((1,0,0))
        v = direction.cross(u).normalized()
        points, quads = details.setdefault(mat, ([], []))
        start = len(points)
        for endpoint in (a,b):
            for side in range(6):
                angle = side*math.tau/6
                points.append(tuple(endpoint + radius*(math.cos(angle)*u + math.sin(angle)*v)))
        for side in range(6):
            nxt = (side+1)%6
            quads.append((start+side,start+nxt,start+6+nxt,start+6+side))
        quads.extend([tuple(start+i for i in reversed(range(6))),tuple(start+6+i for i in range(6))])

    for i in range(peaks):
        angle = phase + i * math.tau / peaks
        outward = Vector((math.cos(angle), math.sin(angle), 0))
        left = Vector((cx + radius * math.cos(angle-half), cy + radius * math.sin(angle-half), eave_z))
        right = Vector((cx + radius * math.cos(angle+half), cy + radius * math.sin(angle+half), eave_z))
        apex = (left + right) / 2
        apex.z = apex_z
        base = len(verts)
        verts.extend([tuple(left), tuple(right), tuple(apex), tuple(C)])
        faces.extend([(base,base+1,base+2),(base,base+2,base+3),(base+2,base+1,base+3)])
        indices.extend([2,0,1])
        # Delicate horizontal louvres on the outward triangular gables.
        rows = max(14, int((apex_z-eave_z)/0.115))
        for row in range(1, rows):
            t = row/rows
            a = left.lerp(apex,t) + outward*0.018
            b = right.lerp(apex,t) + outward*0.018
            detail_line(name+'_gable_louvre',a,b,0.014,'roof_seam',parent)
        # Thin metal seams follow the pitched planes, not the dark gables.
        for corner in (left,right):
            for j in range(1,12):
                a=corner.lerp(C,j/12); a.z+=0.012
                b=apex.lerp(C,j/12); b.z+=0.012
                detail_line(name+'_metal_seam',a,b,0.009,'roof_red',parent)
        detail_line(name+'_ridge',apex,C+Vector((0,0,0.018)),0.025,'roof_orange',parent)
        detail_line(name+'_valley',left,C,0.018,'roof_red',parent)
        detail_line(name+'_gable_edge',left,apex,0.025,'roof_seam',parent)
        detail_line(name+'_gable_edge',right,apex,0.025,'roof_seam',parent)
        # Straight, pale fascia follows the octagonal eave.
        tangent = right-left
        fascia=box(name+'_fascia',(left+right)/2-Vector((0,0,0.12)),(tangent.length,0.16,0.24),'stone_light',parent,0.015)
        fascia.rotation_euler.z=math.atan2(tangent.y,tangent.x)
    for mat, (points, quads) in details.items():
        mesh_obj(name+'_'+mat+'_details',points,quads,[mat],parent)
    obj=mesh_obj(name,verts,faces,['roof_orange','roof_red','roof_brown'],parent,indices)
    obj['reference']='public/photos/clubhouse-aerial.png; clubhouse-front.png; clubhouse-side.png'
    solid=obj.modifiers.new('Folded metal thickness','SOLIDIFY'); solid.thickness=0.045
    return obj

def rectangular_hip(name, center, width, depth, eave_z, apex_z, parent=GATE):
    cx, cy = center
    verts = [
        (cx-width/2, cy-depth/2, eave_z), (cx+width/2, cy-depth/2, eave_z),
        (cx+width/2, cy+depth/2, eave_z), (cx-width/2, cy+depth/2, eave_z),
        (cx-width*0.28, cy, apex_z), (cx+width*0.28, cy, apex_z)
    ]
    faces = [(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)]
    obj = mesh_obj(name, verts, faces, ['roof_orange'], parent)
    mod = obj.modifiers.new('Roof thickness', 'SOLIDIFY')
    mod.thickness = 0.14
    for a,b in [(verts[0],verts[4]),(verts[1],verts[5]),(verts[2],verts[5]),(verts[3],verts[4]),(verts[4],verts[5])]:
        line(name+'_ridge',a,b,0.04,'roof_seam',parent)
    for side in range(4):
        a,b = Vector(verts[side]),Vector(verts[(side+1)%4])
        for j in range(1,16):
            p = a.lerp(b,j/16)
            target = Vector(verts[4]).lerp(Vector(verts[5]), max(0,min(1,(p.x-(cx-width/2))/width)))
            target.z = apex_z
            line(name+'_tile_seam',p,target,0.012,'roof_seam',parent)
    return obj

def window_front(name, x, y, z, width, height, parent=CLUB, panes=3):
    box(name+'_frame',(x,y,z),(width+0.16,0.12,height+0.16),'metal',parent,0.02)
    box(name+'_glass',(x,y-0.075,z),(width,0.05,height),'glass_light',parent,0.01)
    for i in range(1,panes):
        px=x-width/2+width*i/panes
        box(name+'_mullion',(px,y-0.12,z),(0.07,0.06,height),'metal',parent,0)
    box(name+'_transom',(x,y-0.12,z+height*0.18),(width,0.06,0.06),'metal',parent,0)

def railing(name, start, end, z, parent=CLUB):
    a,b=Vector(start),Vector(end)
    length=(b-a).length
    count=max(2,int(length/1.4))
    for i in range(count+1):
        p=a.lerp(b,i/count)
        line(name+'_post',(p.x,p.y,z),(p.x,p.y,z+1.05),0.035,'metal',parent)
    for h in (0.25,0.65,1.05):
        line(name+'_rail',(a.x,a.y,z+h),(b.x,b.y,z+h),0.032,'metal',parent)

# Clubhouse: layered octagonal volumes and the signature portico.
box('Clubhouse_plinth',(0,0,0.25),(25,18,0.5),'stone_dark',CLUB,0.1)
box('Clubhouse_ground_floor',(0,0,2.45),(22,15,4.4),'stone',CLUB,0.12)
box('Clubhouse_upper_octagon',(1,2.5,6.65),(14,12,4.2),'stone_light',CLUB,0.08)
box('Clubhouse_west_lounge',(-8,1.5,5.7),(7.5,12,6.4),'stone',CLUB,0.08)
box('Clubhouse_east_service',(10,3,2.8),(6,11,5.1),'stone_light',CLUB,0.08)

# Horizontal stone courses catch light without texture downloads.
for z in [0.85+i*0.52 for i in range(7)]:
    box('Ground_stone_course',(0,-7.515,z),(22,0.035,0.022),'stone_dark',CLUB,0)
for z in [5.15+i*0.52 for i in range(7)]:
    box('Upper_stone_course',(1,-3.515,z),(14,0.035,0.022),'stone_dark',CLUB,0)

# Facade glazing and entrances.
window_front('Entry_glazing',0,-7.58,2.3,5.2,3.6,CLUB,4)
window_front('Upper_panorama',4.2,-3.59,6.85,5.1,2.8,CLUB,4)
window_front('West_panorama',-8,-4.56,6.1,5.5,3.15,CLUB,4)
window_front('East_window',8.3,-7.58,2.6,2.2,1.65,CLUB,2)
window_front('West_window',-8.5,-7.58,2.6,1.8,1.65,CLUB,2)
for x in (-5.5,5.5):
    box('Entry_side_glass',(x,-7.59,2.25),(1.3,0.06,2.1),'glass',CLUB,0.02)

# Portico canopy and flared columns.
box('Portico_canopy',(0,-9.0,5.25),(18.5,5.2,0.6),'stone_light',CLUB,0.12)
box('Portico_fascia',(0,-11.58,5.15),(18.8,0.22,0.85),'stone_light',CLUB,0.05)
for x in (-7.2,-2.5,2.5,7.2):
    cylinder('Portico_column_base',(x,-10.25,0.38),0.62,0.75,'stone_light',CLUB)
    cylinder('Portico_column',(x,-10.25,2.7),0.38,4.15,'stone_light',CLUB,radius_top=0.48)
    cylinder('Portico_flared_capital',(x,-10.25,4.75),0.5,0.75,'stone_light',CLUB,radius_top=0.95)
    cylinder('Portico_abacus',(x,-10.25,5.07),1.02,0.18,'stone_light',CLUB)
for i in range(4):
    box('Entry_step',(0,-9.25-i*0.48,0.34-i*0.07),(10.5+i*0.35,2.4+i*0.9,0.18),'stone_light',CLUB,0.025)

print('Building shell ready', flush=True)
# Eight folded gables per roof, with non-intersecting large/small footprints.
# Photo proportions are interpreted; no surveyed dimensions are available.
crown_roof('Main_crown_roof',(2.5,2.5),7.5,9.0,12.3,8,CLUB)
crown_roof('West_crown_roof',(-9.5,1.5),5.0,9.1,11.5,8,CLUB)
hip_roof('East_service_roof',(10,3),4.6,5.55,7.0,4,CLUB,phase=math.pi/4,striped=False)
# Low connecting metal roof and terrace.
box('Connecting_flat_roof',(-2,-4.8,5.15),(8,4,0.22),'metal',CLUB,0.02)
railing('West_terrace',(-11.4,-5.4),(-5.0,-5.4),5.3,CLUB)
railing('Rear_terrace',(5.5,9.0),(11.5,9.0),5.3,CLUB)

# Clubhouse lettering, converted for GLTF export.
def text_obj(name, body, loc, size, mat, parent, rotation=(math.pi/2,0,0), align='CENTER'):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=body
    curve.align_x=align
    curve.size=size
    curve.extrude=0.012
    curve.bevel_depth=0.004
    obj=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=rotation
    obj.parent=parent
    curve.materials.append(MATS[mat])
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj

text_obj('Clubhouse_sign','CLUB HOUSE',(0,-7.69,4.25),0.42,'gold',CLUB)

# Arrival gate: two gatehouses, a broad shaded entry and hipped tile roof.
GY=-42
box('Gate_plinth',(0,GY,0.16),(24,7,0.32),'paving',GATE,0.06)
for x in (-8,8):
    box('Gatehouse',(x,GY,2.25),(5.2,5.4,4.5),'stone_light',GATE,0.08)
    window_front('Gatehouse_window',x,GY-2.73,2.5,2.5,1.65,GATE,2)
    rectangular_hip('Gatehouse_roof',(x,GY),6.2,6.3,4.65,6.25,GATE)
box('Gate_beam',(0,GY,5.0),(18.5,4.2,1.15),'stone_light',GATE,0.08)
rectangular_hip('Gate_main_roof',(0,GY),20.2,5.8,5.7,7.0,GATE)
for x in (-5.8,5.8):
    box('Gate_inner_pier',(x,GY,2.35),(0.65,3.5,4.7),'stone',GATE,0.05)
text_obj('Gate_sign','ARISE PALM RESORT',(0,GY-2.14,4.73),0.58,'gold',GATE)
for side in (-1,1):
    x=side*19
    box('Boundary_wall',(x,GY+0.4,1.3),(16,0.5,2.6),'stone_light',GATE,0.06)
    for px in [side*(11.5+i*3.0) for i in range(6)]:
        box('Boundary_pier',(px,GY+0.4,1.55),(0.7,0.8,3.1),'stone',GATE,0.04)

print('Geometry ready; applying modifiers', flush=True)
# Apply modifiers, then batch static architecture by parent and material for a light GLB.
bpy.ops.object.select_all(action='DESELECT')
meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
for obj in meshes:
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)

print('Modifiers ready; batching meshes', flush=True)
batches={}
for obj in meshes:
    key=(obj.parent.name if obj.parent else 'Scene', obj.data.materials[0].name)
    batches.setdefault(key,[]).append(obj)
for (parent_name,mat_name),objects in batches.items():
    if len(objects)<2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    bpy.context.object.name=f'{parent_name}_{mat_name}_batch'

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)

print('Saving architecture', flush=True)
blend_path=os.path.join(SOURCE_DIR,'resort-architecture.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
bpy.ops.export_scene.gltf(filepath=os.path.join(MODEL_DIR,'resort-architecture.glb'),export_format='GLB',use_selection=True,export_apply=True)
print('ARCHITECTURE_EXPORTED', len([o for o in bpy.context.scene.objects if o.type=='MESH']))
