"""
Prepare Tencent Hunyuan 3D Pro Mai Shiranui (tools/mai_hunyuan.glb) for the Godot 4
Multi-Algorithm Jiggle Physics Lab:
1. Decimate 494k tris -> ~80k game-ready tris (preserving UVs & PBR textures)
2. Normalize to 1.68m height standing cleanly on Z=0, centered on X=0, facing -Y (Godot +Z)
3. Build humanoid Armature aligned to Hunyuan Mai's natural A-pose + auto-detected Breast.L / Breast.R
4. Bind with Blender Automatic Heat Weights + override bust region with smooth Gaussian weights
5. Bake 4-channel anatomical Center-of-Mass Vertex Color Map (COLOR_0) for GPU soft-body shader
6. Bake all 9 smooth KOF animations (Idle_KOF, Jump_Start, Jump_Air, Jump_Land, Run_Jog,
   Fan_Spin, Ryuuenbu, Victory_Cheer, Hip_Sway)
7. Export game-ready rigged & animated GLB to assets/mai_hunyuan_ready.glb
"""

import bpy
import math
import sys
from mathutils import Vector, Quaternion


def detect_breast_peaks(mesh_obj):
    """
    On normalized 1.68m Hunyuan Mai (facing -Y, Left=+X, Right=-X, Up=+Z):
    Find front protrusion peaks (minimum Y) in chest band Z in [1.10, 1.33].
    """
    best_l = None
    best_r = None
    for v in mesh_obj.data.vertices:
        co = v.co
        if 1.12 <= co.z <= 1.32 and co.y < -0.04:
            if 0.025 <= co.x <= 0.16:
                if best_l is None or co.y < best_l.y:
                    best_l = co.copy()
            elif -0.16 <= co.x <= -0.025:
                if best_r is None or co.y < best_r.y:
                    best_r = co.copy()

    if best_l is None:
        best_l = Vector((0.075, -0.165, 1.21))
    if best_r is None:
        best_r = Vector((-0.075, -0.165, 1.21))

    avg_x = 0.5 * (abs(best_l.x) + abs(best_r.x))
    avg_y = 0.5 * (best_l.y + best_r.y)
    avg_z = 0.5 * (best_l.z + best_r.z)
    peak_l = Vector((avg_x, avg_y, avg_z))
    peak_r = Vector((-avg_x, avg_y, avg_z))
    print(f"[HunyuanPrep] Detected breast peaks: L={tuple(round(x,3) for x in peak_l)} R={tuple(round(x,3) for x in peak_r)}")
    return peak_l, peak_r


def build_hunyuan_armature(peak_l, peak_r):
    arm_data = bpy.data.armatures.new("Hunyuan_Mai_Armature")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_b(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    # Core spine matching 1.68m Hunyuan Mai proportions
    add_b("Hip", (0.0, 0.0, 0.90), (0.0, 0.0, 1.02))
    add_b("Spine01", (0.0, 0.0, 1.02), (0.0, 0.0, 1.15), "Hip", True)
    add_b("Spine02", (0.0, 0.0, 1.15), (0.0, 0.0, 1.34), "Spine01", True)
    add_b("NeckTwist01", (0.0, 0.01, 1.34), (0.0, 0.01, 1.43), "Spine02", True)
    add_b("Head", (0.0, 0.01, 1.43), (0.0, 0.01, 1.66), "NeckTwist01", True)

    # Dedicated Breast.L / Breast.R under Spine02 (pointing forward -Y)
    for bname, pk in (("Breast.L", peak_l), ("Breast.R", peak_r)):
        add_b(bname, (pk.x, pk.y + 0.085, pk.z + 0.008), (pk.x, pk.y - 0.025, pk.z - 0.006), "Spine02")

    # Arms aligned to Hunyuan Mai's natural A-pose (arms angled ~35 deg down from shoulders)
    for side, s in (("L", 1.0), ("R", -1.0)):
        add_b(f"{side}_Clavicle", (s * 0.03, 0.0, 1.31), (s * 0.145, 0.01, 1.31), "Spine02")
        add_b(f"{side}_Upperarm", (s * 0.145, 0.01, 1.31), (s * 0.275, 0.02, 1.08), f"{side}_Clavicle", True)
        add_b(f"{side}_Forearm", (s * 0.275, 0.02, 1.08), (s * 0.365, -0.02, 0.88), f"{side}_Upperarm", True)
        add_b(f"{side}_Hand", (s * 0.365, -0.02, 0.88), (s * 0.405, -0.04, 0.80), f"{side}_Forearm", True)

    # Legs aligned to Hunyuan Mai's natural stance
    for side, s in (("L", 1.0), ("R", -1.0)):
        add_b(f"{side}_Thigh", (s * 0.095, 0.0, 0.88), (s * 0.125, -0.01, 0.48), "Hip")
        add_b(f"{side}_Calf", (s * 0.125, -0.01, 0.48), (s * 0.135, 0.02, 0.10), f"{side}_Thigh", True)
        add_b(f"{side}_Foot", (s * 0.135, 0.02, 0.10), (s * 0.135, -0.11, 0.02), f"{side}_Calf", True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def paint_breast_weights_and_com_colors(mesh_obj, peak_l, peak_r):
    mesh = mesh_obj.data
    vg_l = mesh_obj.vertex_groups.get("Breast.L") or mesh_obj.vertex_groups.new(name="Breast.L")
    vg_r = mesh_obj.vertex_groups.get("Breast.R") or mesh_obj.vertex_groups.new(name="Breast.R")

    col_attr = mesh.color_attributes.get("Color")
    if col_attr is None:
        col_attr = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")

    # Lower-nipple anatomical center of mass (slightly below geometric peak)
    com_l = Vector((peak_l.x, peak_l.y, peak_l.z - 0.014))
    com_r = Vector((peak_r.x, peak_r.y, peak_r.z - 0.014))

    rx_width = 0.092
    rz_height = 0.096
    ry_depth = 0.115
    max_y = peak_l.y + 0.125  # Chest wall back limit (-Y is front!)

    vert_rgba = [(0.0, 0.0, 0.0, 0.0)] * len(mesh.vertices)
    painted_l = 0
    painted_r = 0

    for v in mesh.vertices:
        co = v.co
        if co.y > max_y or co.z < peak_l.z - 0.135 or co.z > peak_l.z + 0.135 or abs(co.x) > 0.21:
            continue

        is_left = co.x >= 0.0
        com = com_l if is_left else com_r
        dx = (co.x - com.x) / rx_width
        dz = (co.z - com.z) / rz_height
        # Depth from chest wall toward front peak (-Y)
        depth_t = max(0.0, min(1.0, (max_y - co.y) / ry_depth))
        r2 = dx * dx + dz * dz

        if r2 < 1.38 and depth_t > 0.04:
            w_breast = math.exp(-r2 * 1.40) * (depth_t ** 1.20)
            cleave = 1.0 - 0.65 * math.exp(-((co.x / 0.022) ** 2.0))
            w_breast = min(0.98, w_breast * cleave * 1.18)

            radial_norm = min(1.0, math.sqrt(r2) / 1.15)
            lower_bias = max(0.0, min(1.0, 0.5 - dz * 0.55))
            vert_rgba[v.index] = (w_breast, 1.0 if is_left else 0.0, radial_norm, lower_bias)

            if w_breast > 0.02:
                scale_old = 1.0 - w_breast
                existing = [(g.group, g.weight) for g in v.groups]
                for g_idx, g_w in existing:
                    mesh_obj.vertex_groups[g_idx].add([v.index], g_w * scale_old, "REPLACE")
                if is_left:
                    vg_l.add([v.index], w_breast, "REPLACE")
                    painted_l += 1
                else:
                    vg_r.add([v.index], w_breast, "REPLACE")
                    painted_r += 1

    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            v_idx = mesh.loops[loop_idx].vertex_index
            col_attr.data[loop_idx].color = vert_rgba[v_idx]

    print(f"[HunyuanPrep] Painted Breast weights & CoM Vertex Color Map: L={painted_l}, R={painted_r}")


def bake_kof_animations(arm_obj):
    """
    Bake 9 smooth KOF animations onto Hunyuan Mai (already facing -Y, Left=+X, Up=+Z, 1.68m!).
    """
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    key_bones = [
        "Hip", "Spine01", "Spine02", "NeckTwist01", "Head",
        "L_Clavicle", "L_Upperarm", "L_Forearm", "L_Hand",
        "R_Clavicle", "R_Upperarm", "R_Forearm", "R_Hand",
        "L_Thigh", "L_Calf", "L_Foot",
        "R_Thigh", "R_Calf", "R_Foot",
    ]
    key_bones = [n for n in key_bones if n in pb]
    rest_mat3 = {n: arm_obj.data.bones[n].matrix_local.to_3x3() for n in key_bones}

    def reset_pose():
        for n in key_bones:
            b = pb[n]
            b.rotation_mode = "QUATERNION"
            b.location = (0.0, 0.0, 0.0)
            b.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))

    def rot_world(name, pitch_deg=0.0, yaw_deg=0.0, roll_deg=0.0):
        """
        Model faces -Y, Left=+X, Up=+Z:
          pitch_deg around +X: +pitch bows forward (+Z -> -Y)!
          yaw_deg around +Z: +yaw turns left (-Y -> +X)!
          roll_deg around -Y (front): +roll tilts left/right!
        """
        if name not in pb:
            return
        q_w = (
            Quaternion(Vector((0, 0, 1)), math.radians(yaw_deg))
            @ Quaternion(Vector((1, 0, 0)), math.radians(pitch_deg))
            @ Quaternion(Vector((0, -1, 0)), math.radians(roll_deg))
        )
        m_rest = rest_mat3[name]
        pb[name].rotation_quaternion = (m_rest.transposed() @ q_w.to_matrix() @ m_rest).to_quaternion()

    def move_world(name, dx=0.0, dy=0.0, dz=0.0):
        if name not in pb:
            return
        pb[name].location = rest_mat3[name].transposed() @ Vector((dx, dy, dz))

    def key_all(frame):
        for n in key_bones:
            pb[n].keyframe_insert(data_path="location", frame=frame)
            pb[n].keyframe_insert(data_path="rotation_quaternion", frame=frame)

    def make_clip(name, end_f, fn):
        act = bpy.data.actions.new(name=name)
        arm_obj.animation_data_create()
        arm_obj.animation_data.action = act
        reset_pose()
        fn(end_f)
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, act)
        strip.action_frame_start = 1
        strip.action_frame_end = end_f
        arm_obj.animation_data.action = None

    # Note: Arms are ALREADY lowered in A-pose! So small delta rotations look super natural!
    # Legs point -Z: -pitch moves foot forward (-Y), +pitch bends knee back (+Y)!

    # 1. Idle_KOF
    def clip_idle(end_f):
        for f in range(1, end_f + 1, 3):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            bnc = math.sin(t * 2.0)
            swy = math.sin(t)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.048 + bnc * 0.040)
            rot_world("Hip", pitch_deg=3 + bnc * 3, yaw_deg=12 + swy * 4, roll_deg=swy * 3)
            rot_world("Spine01", pitch_deg=3 - bnc * 3, yaw_deg=-5, roll_deg=-swy * 3)
            rot_world("Spine02", pitch_deg=-5 + bnc * 5, yaw_deg=-7 - swy * 3)
            rot_world("Head", pitch_deg=2 - bnc * 2, yaw_deg=-4)
            rot_world("L_Thigh", pitch_deg=-18 + bnc * 9, roll_deg=3)
            rot_world("L_Calf", pitch_deg=32 - bnc * 15)
            rot_world("R_Thigh", pitch_deg=6 + bnc * 7, roll_deg=-4)
            rot_world("R_Calf", pitch_deg=18 - bnc * 11)
            rot_world("L_Upperarm", pitch_deg=-12, roll_deg=6 + bnc * 5)
            rot_world("L_Forearm", pitch_deg=-28)
            rot_world("R_Upperarm", pitch_deg=-16, roll_deg=-6 - bnc * 5)
            rot_world("R_Forearm", pitch_deg=-32)
            key_all(f)

    # 2. Jump_Start
    def clip_jump_start(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.17)
        rot_world("Spine01", pitch_deg=16)
        rot_world("Spine02", pitch_deg=10)
        rot_world("L_Thigh", pitch_deg=-42)
        rot_world("L_Calf", pitch_deg=72)
        rot_world("R_Thigh", pitch_deg=-38)
        rot_world("R_Calf", pitch_deg=68)
        rot_world("L_Upperarm", pitch_deg=18)
        rot_world("R_Upperarm", pitch_deg=18)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.06)
        rot_world("Spine01", pitch_deg=-8)
        rot_world("Spine02", pitch_deg=-8)
        rot_world("L_Thigh", pitch_deg=10)
        rot_world("R_Thigh", pitch_deg=10)
        rot_world("L_Upperarm", pitch_deg=-22, roll_deg=48)
        rot_world("R_Upperarm", pitch_deg=-22, roll_deg=-48)
        key_all(end_f)

    # 3. Jump_Air
    def clip_jump_air(end_f):
        for f in (1, end_f // 2, end_f):
            p = math.sin(((f - 1) / (end_f - 1)) * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, 0.03)
            rot_world("Spine01", pitch_deg=-5 + p * 4, yaw_deg=5)
            rot_world("Spine02", pitch_deg=-6, yaw_deg=-5)
            rot_world("L_Thigh", pitch_deg=-48 - p * 8)
            rot_world("L_Calf", pitch_deg=82)
            rot_world("R_Thigh", pitch_deg=14)
            rot_world("R_Calf", pitch_deg=26)
            rot_world("L_Upperarm", roll_deg=34)
            rot_world("R_Upperarm", roll_deg=-34)
            key_all(f)

    # 4. Jump_Land
    def clip_jump_land(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.20)
        rot_world("Spine01", pitch_deg=20)
        rot_world("Spine02", pitch_deg=14)
        rot_world("L_Thigh", pitch_deg=-50)
        rot_world("L_Calf", pitch_deg=86)
        rot_world("R_Thigh", pitch_deg=-46)
        rot_world("R_Calf", pitch_deg=82)
        rot_world("L_Upperarm", roll_deg=22)
        rot_world("R_Upperarm", roll_deg=-22)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.03)
        rot_world("Spine01", pitch_deg=-7)
        rot_world("Spine02", pitch_deg=-6)
        rot_world("L_Thigh", pitch_deg=-10)
        rot_world("L_Calf", pitch_deg=18)
        rot_world("R_Thigh", pitch_deg=-10)
        rot_world("R_Calf", pitch_deg=18)
        key_all(end_f // 2 + 1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.04)
        rot_world("L_Thigh", pitch_deg=-16)
        rot_world("L_Calf", pitch_deg=28)
        rot_world("R_Thigh", pitch_deg=6)
        rot_world("R_Calf", pitch_deg=16)
        key_all(end_f)

    # 5. Run_Jog
    def clip_jog(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            bnc = abs(math.sin(t))
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.07 + bnc * 0.095)
            rot_world("Hip", pitch_deg=8, yaw_deg=s * 10, roll_deg=s * 4)
            rot_world("Spine01", pitch_deg=6, yaw_deg=-s * 12, roll_deg=-s * 3)
            rot_world("Spine02", pitch_deg=4, yaw_deg=-s * 12)
            rot_world("L_Thigh", pitch_deg=-s * 38 - 6)
            rot_world("L_Calf", pitch_deg=max(0, -c) * 62 + 14)
            rot_world("R_Thigh", pitch_deg=s * 38 - 6)
            rot_world("R_Calf", pitch_deg=max(0, c) * 62 + 14)
            rot_world("L_Upperarm", pitch_deg=s * 36)
            rot_world("L_Forearm", pitch_deg=-46)
            rot_world("R_Upperarm", pitch_deg=-s * 36)
            rot_world("R_Forearm", pitch_deg=-46)
            key_all(f)

    # 6. Fan_Spin
    def clip_fan_spin(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = u * 360.0
            lift = math.sin(u * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.04 + lift * 0.14)
            rot_world("Hip", pitch_deg=4 - lift * 8, yaw_deg=spin)
            rot_world("Spine01", pitch_deg=-5 + lift * 5, yaw_deg=math.sin(u * math.pi * 2) * 16)
            rot_world("Spine02", pitch_deg=-6, yaw_deg=math.sin(u * math.pi * 2) * 18)
            rot_world("L_Thigh", pitch_deg=-14 - lift * 22)
            rot_world("L_Calf", pitch_deg=28 + lift * 34)
            rot_world("R_Thigh", pitch_deg=8)
            rot_world("R_Calf", pitch_deg=14)
            rot_world("L_Upperarm", roll_deg=38)
            rot_world("R_Upperarm", roll_deg=-42 - lift * 22)
            key_all(f)

    # 7. Ryuuenbu
    def clip_ryuuenbu(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = (u ** 1.2) * 720.0
            dip = math.sin(u * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.17 * dip + 0.05 * math.sin(u * math.pi * 2))
            rot_world("Hip", pitch_deg=16 * dip, yaw_deg=spin)
            rot_world("Spine01", pitch_deg=14 * dip, yaw_deg=16 * math.sin(u * math.pi * 2))
            rot_world("Spine02", pitch_deg=-6 + 10 * dip, yaw_deg=18 * math.sin(u * math.pi * 2))
            rot_world("L_Thigh", pitch_deg=-38 * dip - 10)
            rot_world("L_Calf", pitch_deg=62 * dip + 16)
            rot_world("R_Thigh", pitch_deg=-28 * dip)
            rot_world("R_Calf", pitch_deg=50 * dip + 14)
            rot_world("L_Upperarm", roll_deg=42)
            rot_world("R_Upperarm", roll_deg=-42)
            key_all(f)

    # 8. Victory_Cheer
    def clip_cheer(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            hop = abs(math.sin(u * math.pi * 2.0))
            swy = math.sin(u * math.pi * 2.0)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.11 + hop * 0.24)
            rot_world("Hip", pitch_deg=-5 * hop + 8 * (1 - hop), yaw_deg=swy * 8, roll_deg=swy * 5)
            rot_world("Spine01", pitch_deg=-8 * hop + 5 * (1 - hop), yaw_deg=-swy * 6, roll_deg=-swy * 4)
            rot_world("Spine02", pitch_deg=-7 * hop, roll_deg=-swy * 4)
            rot_world("L_Thigh", pitch_deg=-26 * (1 - hop) + 8 * hop)
            rot_world("L_Calf", pitch_deg=48 * (1 - hop) + 20 * hop)
            rot_world("R_Thigh", pitch_deg=-26 * (1 - hop) + 8 * hop)
            rot_world("R_Calf", pitch_deg=48 * (1 - hop) + 20 * hop)
            rot_world("L_Upperarm", roll_deg=92 + hop * 18)
            rot_world("R_Upperarm", roll_deg=-92 - hop * 18)
            key_all(f)

    # 9. Hip_Sway
    def clip_sway(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            reset_pose()
            move_world("Hip", s * 0.088, 0.0, -0.05 + abs(c) * 0.032)
            rot_world("Hip", pitch_deg=4, yaw_deg=s * 12, roll_deg=s * 10)
            rot_world("Spine01", pitch_deg=-3, yaw_deg=-s * 14, roll_deg=-s * 12)
            rot_world("Spine02", pitch_deg=-6 + c * 4, yaw_deg=-s * 16, roll_deg=-s * 8)
            rot_world("Head", pitch_deg=3, yaw_deg=s * 10, roll_deg=s * 6)
            rot_world("L_Thigh", pitch_deg=-10 + s * 6)
            rot_world("L_Calf", pitch_deg=18)
            rot_world("R_Thigh", pitch_deg=-10 - s * 6)
            rot_world("R_Calf", pitch_deg=18)
            rot_world("L_Upperarm", roll_deg=10 + s * 10)
            rot_world("R_Upperarm", roll_deg=-10 + s * 10)
            key_all(f)

    make_clip("Idle_KOF", 49, clip_idle)
    make_clip("Jump_Start", 13, clip_jump_start)
    make_clip("Jump_Air", 25, clip_jump_air)
    make_clip("Jump_Land", 19, clip_jump_land)
    make_clip("Run_Jog", 25, clip_jog)
    make_clip("Fan_Spin", 37, clip_fan_spin)
    make_clip("Ryuuenbu", 45, clip_ryuuenbu)
    make_clip("Victory_Cheer", 41, clip_cheer)
    make_clip("Hip_Sway", 49, clip_sway)

    reset_pose()
    bpy.ops.object.mode_set(mode="OBJECT")


def main():
    in_path = sys.argv[-2]
    out_path = sys.argv[-1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=in_path)

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh found in Hunyuan GLB!")
    mesh_obj = meshes[0]

    # Clear parent transform and apply scale/rotation so mesh is baked in clean 1.68m standing on Z=0
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Normalize to 1.68m standing on Z=0, centered on TORSO median (ignoring flowing ribbons/ponytail!)
    verts = mesh_obj.data.vertices
    zs = [v.co.z for v in verts]
    min_z, max_z = min(zs), max(zs)
    h = max(0.01, max_z - min_z)
    scale = 1.68 / h
    torso_x = sorted(v.co.x for v in verts if 0.48 <= (v.co.z - min_z) / h <= 0.72)
    torso_y = sorted(v.co.y for v in verts if 0.48 <= (v.co.z - min_z) / h <= 0.72)
    cx = torso_x[len(torso_x) // 2] if torso_x else 0.0
    cy = torso_y[len(torso_y) // 2] if torso_y else 0.0
    for v in verts:
        v.co.x = (v.co.x - cx) * scale
        v.co.y = (v.co.y - cy) * scale
        v.co.z = (v.co.z - min_z) * scale
    mesh_obj.data.update()

    # Decimate 494k -> ~65k game-ready tris, then weld duplicate UV-seam vertices so Bone Heat Weighting succeeds!
    orig_polys = len(mesh_obj.data.polygons)
    if orig_polys > 75000:
        dec = mesh_obj.modifiers.new("GameDecimate", "DECIMATE")
        dec.ratio = 65000.0 / float(orig_polys)
        bpy.ops.object.modifier_apply(modifier=dec.name)
        print(f"[HunyuanPrep] Decimated: {orig_polys} -> {len(mesh_obj.data.polygons)} polys")

    # Weld duplicate vertices & fix normals so Blender Bone Heat Weighting works cleanly
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Auto-detect breast peaks & build armature
    peak_l, peak_r = detect_breast_peaks(mesh_obj)
    arm_obj = build_hunyuan_armature(peak_l, peak_r)

    # Clean Anatomical Region-Partitioned Skinning (100% immune to ribbon/arm/thigh cross-pulling!)
    # Clear any old groups and assign smooth, anatomically isolated weights per body region.
    mesh_obj.vertex_groups.clear()
    vgs = {b.name: mesh_obj.vertex_groups.new(name=b.name) for b in arm_obj.data.bones}

    def smoothstep(edge0, edge1, x):
        t = max(0.0, min(1.0, (x - edge0) / max(1e-6, edge1 - edge0)))
        return t * t * (3.0 - 2.0 * t)

    def set_weights(vi, pairs):
        tot = sum(w for _, w in pairs if w > 1e-4)
        if tot <= 1e-4:
            vgs["Hip"].add([vi], 1.0, "REPLACE")
            return
        for bname, w in pairs:
            if w > 1e-4 and bname in vgs:
                vgs[bname].add([vi], w / tot, "REPLACE")

    for v in mesh_obj.data.vertices:
        x, y, z = v.co.x, v.co.y, v.co.z
        ax = abs(x)
        side = "L" if x >= 0.0 else "R"

        # 1. Head, Face, Hair Crown & High Ponytail (z > 1.36, or ponytail trailing behind head)
        if z > 1.36 or (y > 0.12 and z > 1.12 and x < 0.08):
            t_head = smoothstep(1.34, 1.43, z)
            set_weights(v.index, [("Head", t_head), ("NeckTwist01", 1.0 - t_head)])
            continue

        # 2. Flowing Back Obi Bow & Red Ribbon Tails ONLY (strictly behind legs y > 0.19 or far outside legs!)
        if y > 0.19 or (z < 0.82 and ax > 0.26):
            t_sp = smoothstep(0.92, 1.08, z)
            set_weights(v.index, [("Spine01", t_sp), ("Hip", 1.0 - t_sp)])
            continue

        # 3. Left & Right Arms (outside torso |x| > 0.165, front/mid y <= 0.14, z in [0.74, 1.35])
        if z > 0.74 and ax > 0.165 and y <= 0.14:
            t_arm = smoothstep(0.155, 0.205, ax)
            t_elbow = smoothstep(1.13, 1.01, z)
            t_wrist = smoothstep(0.92, 0.84, z)
            w_torso = 1.0 - t_arm
            w_upper = t_arm * (1.0 - t_elbow)
            w_fore = t_arm * t_elbow * (1.0 - t_wrist)
            w_hand = t_arm * t_elbow * t_wrist
            set_weights(v.index, [
                ("Spine02", w_torso),
                (f"{side}_Upperarm", w_upper),
                (f"{side}_Forearm", w_fore),
                (f"{side}_Hand", w_hand),
            ])
            continue

        # 4. Torso (Waist -> Spine01 -> Spine02 -> Neck)
        if z >= 0.86:
            if z < 1.02:
                t = smoothstep(0.86, 1.02, z)
                set_weights(v.index, [("Hip", 1.0 - t), ("Spine01", t)])
            elif z < 1.17:
                t = smoothstep(1.02, 1.17, z)
                set_weights(v.index, [("Spine01", 1.0 - t), ("Spine02", t)])
            else:
                t = smoothstep(1.30, 1.38, z)
                set_weights(v.index, [("Spine02", 1.0 - t), ("NeckTwist01", t)])
            continue

        # 5. Legs & Front Apron (z < 0.86) — 100% smooth continuous L/R blend with ZERO hard seam cuts!
        t_hip_blend = smoothstep(0.75, 0.87, z)
        t_knee = smoothstep(0.54, 0.41, z)
        t_ankle = smoothstep(0.14, 0.06, z)
        # Smooth L/R blend across centerline x in [-0.045, +0.045] so front apron drapes cleanly between thighs
        w_left_side = smoothstep(-0.045, 0.045, x)
        w_right_side = 1.0 - w_left_side

        w_hip = t_hip_blend
        w_leg = 1.0 - t_hip_blend
        w_thigh = w_leg * (1.0 - t_knee)
        w_calf = w_leg * t_knee * (1.0 - t_ankle)
        w_foot = w_leg * t_knee * t_ankle

        set_weights(v.index, [
            ("Hip", w_hip),
            ("L_Thigh", w_thigh * w_left_side),
            ("R_Thigh", w_thigh * w_right_side),
            ("L_Calf", w_calf * w_left_side),
            ("R_Calf", w_calf * w_right_side),
            ("L_Foot", w_foot * w_left_side),
            ("R_Foot", w_foot * w_right_side),
        ])

    # Parent mesh to Armature with Armature modifier
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj
    print(f"[HunyuanPrep] Applied clean anatomical region weights to all {len(mesh_obj.data.vertices)} vertices.")

    # Override bust region with smooth Gaussian Breast.L/R weights + 4-channel CoM Vertex Color Map!
    paint_breast_weights_and_com_colors(mesh_obj, peak_l, peak_r)

    # Bake all 9 KOF animations
    bake_kof_animations(arm_obj)

    bpy.context.scene.render.fps = 30
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=True,
    )
    print(f"[HunyuanPrep] Exported game-ready Hunyuan3D Mai Shiranui -> {out_path}")


if __name__ == "__main__":
    main()
