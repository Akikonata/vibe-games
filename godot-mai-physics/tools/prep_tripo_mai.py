"""
Post-process Tripo3D auto-rigged Mai Shiranui (mai_tripo_rigged.glb) in Blender:
1. Remove unused Icosphere helper
2. Decimate 1.45M-tri mesh to razor-sharp game-ready ~80k tris (preserving UVs, PBR textures & skin weights!)
3. Auto-detect exact Left & Right breast peaks on Tripo's sculpted Mai Shiranui mesh,
   add Breast.L & Breast.R bones parented to Spine02, and paint smooth Gaussian soft-body weights
4. Bake 9 smooth KOF animations using world-space quaternion helpers so every joint bends
   anatomically regardless of bone roll
5. Normalize scale to 1.68m & rotate to face forward (+Z in Godot / -Y in Blender)
6. Export game-ready rigged & animated GLB to assets/mai_shiranui.glb
"""

import bpy
import math
import sys
from mathutils import Vector, Quaternion, Matrix


def find_breast_peaks(mesh_obj):
    """
    On Tripo's 1.0m model (facing +X, Left=+Y, Right=-Y, Up=+Z):
    Find the exact front protrusion peaks of Left & Right breasts in Z in [0.68, 0.80].
    """
    verts = mesh_obj.data.vertices
    best_l = None
    best_r = None

    for v in verts:
        co = v.co
        if 0.67 <= co.z <= 0.795 and co.x > 0.05:
            if 0.015 <= co.y <= 0.115:
                if best_l is None or co.x > best_l.x:
                    best_l = co.copy()
            elif -0.115 <= co.y <= -0.015:
                if best_r is None or co.x > best_r.x:
                    best_r = co.copy()

    if best_l is None:
        best_l = Vector((0.125, 0.055, 0.740))
    if best_r is None:
        best_r = Vector((0.125, -0.055, 0.740))

    # Symmetrize slightly for clean physics anchor
    avg_x = 0.5 * (best_l.x + best_r.x)
    avg_y = 0.5 * (abs(best_l.y) + abs(best_r.y))
    avg_z = 0.5 * (best_l.z + best_r.z)
    peak_l = Vector((avg_x, avg_y, avg_z))
    peak_r = Vector((avg_x, -avg_y, avg_z))
    print(f"[TripoPrep] Detected breast peaks: L={tuple(round(x,3) for x in peak_l)} R={tuple(round(x,3) for x in peak_r)}")
    return peak_l, peak_r


def add_breast_bones_and_weights(arm_obj, mesh_obj, peak_l, peak_r):
    """
    Add Breast.L and Breast.R under Spine02 at the detected breast centers,
    and smoothly transfer torso weights in the breast region onto Breast.L / Breast.R.
    """
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_obj.data.edit_bones
    spine02 = eb.get("Spine02") or eb.get("Spine01")
    if spine02 is None:
        raise RuntimeError("Could not find Spine02 bone in Tripo armature!")

    # Root sits slightly inside chest wall behind the peak; tail extends forward (+X) to peak
    for bname, peak in (("Breast.L", peak_l), ("Breast.R", peak_r)):
        if bname in eb:
            eb.remove(eb[bname])
        b = eb.new(bname)
        b.head = Vector((peak.x - 0.055, peak.y, peak.z + 0.005))
        b.tail = Vector((peak.x + 0.015, peak.y, peak.z - 0.004))
        b.parent = spine02
        b.use_connect = False

    bpy.ops.object.mode_set(mode="OBJECT")

    # Paint smooth Gaussian soft-body weights onto Breast.L and Breast.R
    vg_l = mesh_obj.vertex_groups.get("Breast.L") or mesh_obj.vertex_groups.new(name="Breast.L")
    vg_r = mesh_obj.vertex_groups.get("Breast.R") or mesh_obj.vertex_groups.new(name="Breast.R")

    # Radius of each breast dome on the 1.0m model
    rx_depth = 0.072
    ry_width = 0.058
    rz_height = 0.062
    min_x = peak_l.x - 0.078

    painted_l = 0
    painted_r = 0

    # Also bake 4-channel anatomical Center-of-Mass Vertex Color Map (COLOR) for GPU Soft-Body Shader!
    #   R = Soft-tissue CoM weight (peaks at 1.0 at nipple / lower-nipple center of mass!)
    #   G = Side ID (1.0 = Left, 0.0 = Right)
    #   B = Normalized radial distance from CoM (for phase-lagged surface ripple!)
    #   A = Lower-lobe gravity bias (higher below nipple CoM for natural teardrop sag)
    mesh = mesh_obj.data
    col_attr = mesh.color_attributes.get("Color")
    if col_attr is None:
        col_attr = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")

    # Lower-nipple anatomical center of mass (slightly below geometric peak)
    com_l = Vector((peak_l.x, peak_l.y, peak_l.z - 0.008))
    com_r = Vector((peak_r.x, peak_r.y, peak_r.z - 0.008))

    vert_rgba = [(0.0, 0.0, 0.0, 0.0)] * len(mesh.vertices)

    for v in mesh.vertices:
        co = v.co
        if co.x < min_x or co.z < peak_l.z - 0.088 or co.z > peak_l.z + 0.085 or abs(co.y) > 0.135:
            continue

        is_left = co.y >= 0.0
        com = com_l if is_left else com_r
        dy = (co.y - com.y) / ry_width
        dz = (co.z - com.z) / rz_height
        depth_t = max(0.0, min(1.0, (co.x - min_x) / rx_depth))
        r2 = dy * dy + dz * dz

        if r2 < 1.38 and depth_t > 0.04:
            w_breast = math.exp(-r2 * 1.40) * (depth_t ** 1.20)
            cleave = 1.0 - 0.65 * math.exp(-((co.y / 0.014) ** 2.0))
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

    # Write per-corner vertex colors cleanly
    for poly in mesh.polygons:
        for loop_idx in poly.loop_indices:
            v_idx = mesh.loops[loop_idx].vertex_index
            col_attr.data[loop_idx].color = vert_rgba[v_idx]

    print(f"[TripoPrep] Painted smooth breast physics weights & CoM Vertex Color Map: L={painted_l} verts, R={painted_r} verts")


def bake_world_space_kof_animations(arm_obj):
    """
    Bake 9 smooth KOF animations onto Tripo's armature using world-space axis rotations
    (converted to each bone's local rest basis!), so every joint bends cleanly regardless
    of bone roll.
    Model coordinate system in Blender (before final root orientation):
      Front = +X, Left = +Y, Up = +Z
    """
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    key_bones = [
        "Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "Head",
        "L_Clavicle", "L_Upperarm", "L_Forearm", "L_Hand",
        "R_Clavicle", "R_Upperarm", "R_Forearm", "R_Hand",
        "L_Thigh", "L_Calf", "L_Foot",
        "R_Thigh", "R_Calf", "R_Foot",
    ]
    key_bones = [n for n in key_bones if n in pb]

    # Precompute each bone's rest 3x3 matrix in armature space
    rest_mat3 = {}
    for n in key_bones:
        rest_mat3[n] = arm_obj.data.bones[n].matrix_local.to_3x3()

    def reset_pose():
        for n in key_bones:
            b = pb[n]
            b.rotation_mode = "QUATERNION"
            b.location = (0.0, 0.0, 0.0)
            b.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))

    def rot_world(name, pitch_deg=0.0, yaw_deg=0.0, roll_deg=0.0):
        """
        Apply intuitive world-space rotation to pose bone:
          pitch_deg: + pitches forward (around +Y axis, bowing forward!)
          yaw_deg:   + turns left (around +Z axis)
          roll_deg:  + tilts right/left (around +X front axis)
        """
        if name not in pb:
            return
        q_w = (
            Quaternion(Vector((0, 0, 1)), math.radians(yaw_deg))
            @ Quaternion(Vector((0, 1, 0)), math.radians(pitch_deg))
            @ Quaternion(Vector((1, 0, 0)), math.radians(roll_deg))
        )
        m_rest = rest_mat3[name]
        # Convert world delta rotation into bone-local rotation: R_local = M_rest^T * R_world * M_rest
        m_local = m_rest.transposed() @ q_w.to_matrix() @ m_rest
        pb[name].rotation_quaternion = m_local.to_quaternion()

    def move_world(name, dx=0.0, dy=0.0, dz=0.0):
        """Move pose bone by world delta (dx=front, dy=left, dz=up) on 1.0m scale."""
        if name not in pb:
            return
        m_rest = rest_mat3[name]
        pb[name].location = m_rest.transposed() @ Vector((dx, dy, dz))

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

    # Arm note (model is in T-pose, L_Upperarm points +Y, R_Upperarm points -Y):
    #   roll_deg around +X: +roll moves +Y (L arm) UP (+Z), -roll moves +Y (L arm) DOWN (-Z)!
    #   So: lower L arm = roll -58, lower R arm = roll +58!
    #   yaw_deg around +Z: -yaw moves +Y (L arm) FORWARD (+X), +yaw moves -Y (R arm) FORWARD (+X)!
    # Leg note (legs point DOWN -Z):
    #   pitch_deg around +Y: -pitch moves -Z (foot) FORWARD (+X = lift knee forward)!
    #   +pitch moves -Z (foot) BACKWARD (-X = bend knee backward)!

    # 1. Idle_KOF (Classic Mai rhythmic fighting-stance bounce!)
    def clip_idle(end_f):
        for f in range(1, end_f + 1, 3):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            bnc = math.sin(t * 2.0)
            swy = math.sin(t)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.032 + bnc * 0.024)
            rot_world("Hip", pitch_deg=3 + bnc * 2, yaw_deg=14 + swy * 4, roll_deg=swy * 3)
            rot_world("Spine01", pitch_deg=3 - bnc * 3, yaw_deg=-6, roll_deg=-swy * 3)
            rot_world("Spine02", pitch_deg=-5 + bnc * 4, yaw_deg=-8 - swy * 3)
            rot_world("Head", pitch_deg=2 - bnc * 2, yaw_deg=-4)
            rot_world("L_Thigh", pitch_deg=-18 + bnc * 8, roll_deg=4)
            rot_world("L_Calf", pitch_deg=32 - bnc * 14)
            rot_world("L_Foot", pitch_deg=-14 + bnc * 6)
            rot_world("R_Thigh", pitch_deg=6 + bnc * 6, roll_deg=-5)
            rot_world("R_Calf", pitch_deg=20 - bnc * 10)
            rot_world("R_Foot", pitch_deg=-22 + bnc * 4)
            # Graceful open fighting stance arms (never blocking bust!)
            rot_world("L_Upperarm", yaw_deg=-18, roll_deg=-52 + bnc * 5)
            rot_world("L_Forearm", yaw_deg=-45, roll_deg=12)
            rot_world("R_Upperarm", yaw_deg=18, roll_deg=48 - bnc * 5)
            rot_world("R_Forearm", yaw_deg=42, roll_deg=-12)
            key_all(f)

    # 2. Jump_Start
    def clip_jump_start(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.105)
        rot_world("Spine01", pitch_deg=16)
        rot_world("Spine02", pitch_deg=10)
        rot_world("L_Thigh", pitch_deg=-42, roll_deg=5)
        rot_world("L_Calf", pitch_deg=72)
        rot_world("R_Thigh", pitch_deg=-38, roll_deg=-5)
        rot_world("R_Calf", pitch_deg=68)
        rot_world("L_Upperarm", yaw_deg=18, roll_deg=-58)
        rot_world("R_Upperarm", yaw_deg=-18, roll_deg=58)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.04)
        rot_world("Spine01", pitch_deg=-8)
        rot_world("Spine02", pitch_deg=-8)
        rot_world("L_Thigh", pitch_deg=10, roll_deg=3)
        rot_world("L_Calf", pitch_deg=8)
        rot_world("R_Thigh", pitch_deg=10, roll_deg=-3)
        rot_world("R_Calf", pitch_deg=8)
        rot_world("L_Upperarm", yaw_deg=-16, roll_deg=18)
        rot_world("R_Upperarm", yaw_deg=16, roll_deg=-22)
        key_all(end_f)

    # 3. Jump_Air
    def clip_jump_air(end_f):
        for f in (1, end_f // 2, end_f):
            p = math.sin(((f - 1) / (end_f - 1)) * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, 0.02)
            rot_world("Spine01", pitch_deg=-5 + p * 4, yaw_deg=5)
            rot_world("Spine02", pitch_deg=-6, yaw_deg=-5)
            rot_world("L_Thigh", pitch_deg=-48 - p * 8, roll_deg=6)
            rot_world("L_Calf", pitch_deg=82)
            rot_world("R_Thigh", pitch_deg=14, roll_deg=-6)
            rot_world("R_Calf", pitch_deg=26)
            rot_world("L_Upperarm", yaw_deg=-14, roll_deg=-18)
            rot_world("L_Forearm", yaw_deg=-26)
            rot_world("R_Upperarm", yaw_deg=14, roll_deg=16)
            rot_world("R_Forearm", yaw_deg=26)
            key_all(f)

    # 4. Jump_Land (Heavy cushioned landing impact -> huge realistic jiggle!)
    def clip_jump_land(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.125)
        rot_world("Spine01", pitch_deg=20)
        rot_world("Spine02", pitch_deg=14)
        rot_world("L_Thigh", pitch_deg=-50, roll_deg=8)
        rot_world("L_Calf", pitch_deg=86)
        rot_world("L_Foot", pitch_deg=-30)
        rot_world("R_Thigh", pitch_deg=-46, roll_deg=-8)
        rot_world("R_Calf", pitch_deg=82)
        rot_world("R_Foot", pitch_deg=-30)
        rot_world("L_Upperarm", yaw_deg=-14, roll_deg=-34)
        rot_world("R_Upperarm", yaw_deg=14, roll_deg=34)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.02)
        rot_world("Spine01", pitch_deg=-7)
        rot_world("Spine02", pitch_deg=-6)
        rot_world("L_Thigh", pitch_deg=-10, roll_deg=4)
        rot_world("L_Calf", pitch_deg=18)
        rot_world("R_Thigh", pitch_deg=-10, roll_deg=-4)
        rot_world("R_Calf", pitch_deg=18)
        rot_world("L_Upperarm", yaw_deg=-16, roll_deg=-46)
        rot_world("R_Upperarm", yaw_deg=16, roll_deg=46)
        key_all(end_f // 2 + 1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.028)
        rot_world("L_Thigh", pitch_deg=-16, roll_deg=4)
        rot_world("L_Calf", pitch_deg=28)
        rot_world("R_Thigh", pitch_deg=6, roll_deg=-4)
        rot_world("R_Calf", pitch_deg=16)
        rot_world("L_Upperarm", yaw_deg=-18, roll_deg=-52)
        rot_world("L_Forearm", yaw_deg=-42)
        rot_world("R_Upperarm", yaw_deg=18, roll_deg=48)
        rot_world("R_Forearm", yaw_deg=40)
        key_all(end_f)

    # 5. Run_Jog
    def clip_jog(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            bnc = abs(math.sin(t))
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.045 + bnc * 0.060)
            rot_world("Hip", pitch_deg=8, yaw_deg=s * 10, roll_deg=s * 4)
            rot_world("Spine01", pitch_deg=6, yaw_deg=-s * 12, roll_deg=-s * 3)
            rot_world("Spine02", pitch_deg=4, yaw_deg=-s * 12)
            rot_world("L_Thigh", pitch_deg=-s * 38 - 6)
            rot_world("L_Calf", pitch_deg=max(0, -c) * 62 + 14)
            rot_world("R_Thigh", pitch_deg=s * 38 - 6)
            rot_world("R_Calf", pitch_deg=max(0, c) * 62 + 14)
            rot_world("L_Upperarm", yaw_deg=s * 36 - 10, roll_deg=-56)
            rot_world("L_Forearm", yaw_deg=-56)
            rot_world("R_Upperarm", yaw_deg=s * 36 + 10, roll_deg=56)
            rot_world("R_Forearm", yaw_deg=56)
            key_all(f)

    # 6. Fan_Spin (360 deg high-speed twirl!)
    def clip_fan_spin(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = u * 360.0
            lift = math.sin(u * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.025 + lift * 0.085)
            rot_world("Hip", pitch_deg=4 - lift * 8, yaw_deg=spin)
            rot_world("Spine01", pitch_deg=-5 + lift * 5, yaw_deg=math.sin(u * math.pi * 2) * 16)
            rot_world("Spine02", pitch_deg=-6, yaw_deg=math.sin(u * math.pi * 2) * 18)
            rot_world("L_Thigh", pitch_deg=-14 - lift * 22, roll_deg=6)
            rot_world("L_Calf", pitch_deg=28 + lift * 34)
            rot_world("R_Thigh", pitch_deg=8, roll_deg=-6)
            rot_world("R_Calf", pitch_deg=14)
            rot_world("L_Upperarm", yaw_deg=-16, roll_deg=-16)
            rot_world("R_Upperarm", yaw_deg=16, roll_deg=16 + lift * 18)
            key_all(f)

    # 7. Ryuuenbu (龙炎舞 720 deg crouched whip-spin!)
    def clip_ryuuenbu(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = (u ** 1.2) * 720.0
            dip = math.sin(u * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.105 * dip + 0.03 * math.sin(u * math.pi * 2))
            rot_world("Hip", pitch_deg=16 * dip, yaw_deg=spin)
            rot_world("Spine01", pitch_deg=14 * dip, yaw_deg=16 * math.sin(u * math.pi * 2))
            rot_world("Spine02", pitch_deg=-6 + 10 * dip, yaw_deg=18 * math.sin(u * math.pi * 2))
            rot_world("L_Thigh", pitch_deg=-38 * dip - 10, roll_deg=8)
            rot_world("L_Calf", pitch_deg=62 * dip + 16)
            rot_world("R_Thigh", pitch_deg=-28 * dip, roll_deg=-8)
            rot_world("R_Calf", pitch_deg=50 * dip + 14)
            rot_world("L_Upperarm", yaw_deg=-10, roll_deg=-10)
            rot_world("R_Upperarm", yaw_deg=10, roll_deg=10)
            key_all(f)

    # 8. Victory_Cheer (胜利连跳 · Joyful double-hop!)
    def clip_cheer(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            hop = abs(math.sin(u * math.pi * 2.0))
            swy = math.sin(u * math.pi * 2.0)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.070 + hop * 0.145)
            rot_world("Hip", pitch_deg=-5 * hop + 8 * (1 - hop), yaw_deg=swy * 8, roll_deg=swy * 5)
            rot_world("Spine01", pitch_deg=-8 * hop + 5 * (1 - hop), yaw_deg=-swy * 6, roll_deg=-swy * 4)
            rot_world("Spine02", pitch_deg=-7 * hop, roll_deg=-swy * 4)
            rot_world("L_Thigh", pitch_deg=-26 * (1 - hop) + 8 * hop, roll_deg=8)
            rot_world("L_Calf", pitch_deg=48 * (1 - hop) + 20 * hop)
            rot_world("R_Thigh", pitch_deg=-26 * (1 - hop) + 8 * hop, roll_deg=-8)
            rot_world("R_Calf", pitch_deg=48 * (1 - hop) + 20 * hop)
            rot_world("L_Upperarm", yaw_deg=-12, roll_deg=46 + hop * 16)
            rot_world("L_Forearm", yaw_deg=-18)
            rot_world("R_Upperarm", yaw_deg=12, roll_deg=-46 - hop * 16)
            rot_world("R_Forearm", yaw_deg=18)
            key_all(f)

    # 9. Hip_Sway (魅惑摇摆 · Expressive left-right hip & chest sway)
    def clip_sway(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            reset_pose()
            move_world("Hip", 0.0, s * 0.055, -0.032 + abs(c) * 0.020)
            rot_world("Hip", pitch_deg=4, yaw_deg=s * 12, roll_deg=s * 10)
            rot_world("Spine01", pitch_deg=-3, yaw_deg=-s * 14, roll_deg=-s * 12)
            rot_world("Spine02", pitch_deg=-6 + c * 4, yaw_deg=-s * 16, roll_deg=-s * 8)
            rot_world("Head", pitch_deg=3, yaw_deg=s * 10, roll_deg=s * 6)
            rot_world("L_Thigh", pitch_deg=-10 + s * 6, roll_deg=6 - s * 8)
            rot_world("L_Calf", pitch_deg=18)
            rot_world("R_Thigh", pitch_deg=-10 - s * 6, roll_deg=-6 - s * 8)
            rot_world("R_Calf", pitch_deg=18)
            rot_world("L_Upperarm", yaw_deg=-14, roll_deg=-52 + s * 10)
            rot_world("L_Forearm", yaw_deg=-38)
            rot_world("R_Upperarm", yaw_deg=14, roll_deg=50 + s * 10)
            rot_world("R_Forearm", yaw_deg=38)
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

    # 1. Remove unused Icosphere
    ico = bpy.data.objects.get("Icosphere")
    if ico:
        bpy.data.objects.remove(ico, do_unlink=True)

    arm_obj = None
    mesh_obj = None
    for o in bpy.data.objects:
        if o.type == "ARMATURE":
            arm_obj = o
        elif o.type == "MESH":
            mesh_obj = o
    if arm_obj is None or mesh_obj is None:
        raise RuntimeError("Missing Armature or Mesh in Tripo rigged GLB!")

    # 2. Decimate 1.45M tris -> ~75k game-ready tris (keeps crisp textures, UVs & skin weights!)
    orig_polys = len(mesh_obj.data.polygons)
    if orig_polys > 95000:
        ratio = 80000.0 / float(orig_polys)
        bpy.context.view_layer.objects.active = mesh_obj
        dec = mesh_obj.modifiers.new(name="GameReadyDecimate", type="DECIMATE")
        dec.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=dec.name)
        print(f"[TripoPrep] Decimated mesh: {orig_polys} -> {len(mesh_obj.data.polygons)} polys")

    # 3. Auto-detect breast peaks, add Breast.L / Breast.R bones, paint smooth soft-body weights!
    peak_l, peak_r = find_breast_peaks(mesh_obj)
    add_breast_bones_and_weights(arm_obj, mesh_obj, peak_l, peak_r)

    # 4. Bake 9 smooth KOF animations
    bake_world_space_kof_animations(arm_obj)

    # 5. Normalize to 1.68m real-world height & rotate -90 deg Z so Mai faces -Y (Blender) -> +Z (Godot)!
    arm_obj.scale = (1.68, 1.68, 1.68)
    arm_obj.rotation_mode = "XYZ"
    arm_obj.rotation_euler = (0.0, 0.0, -math.pi * 0.5)

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
    print(f"[TripoPrep] Successfully exported game-ready Tripo3D Mai Shiranui -> {out_path}")


if __name__ == "__main__":
    main()
