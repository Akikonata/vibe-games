"""
Finalize Tripo3D-neural-rigged Tencent Hunyuan 3D Mai Shiranui (mai_hunyuan_rigged.glb):
- Preserves 100% of Tripo3D's 78-bone neural skinning weights (ZERO tearing on arms/legs/ribbons!)
- Auto-detects Left/Right breast peaks, adds Breast.L & Breast.R under Spine02
- Paints smooth Gaussian breast weights & 4-channel anatomical CoM Vertex Color Map (COLOR_0)
- Bakes all 9 smooth KOF animations onto the 78-bone neural rig (already facing -Y / Godot +Z!)
- Scales to 1.68m and exports to assets/mai_hunyuan_ready.glb
"""

import bpy
import math
import sys
from mathutils import Vector, Quaternion


def detect_breast_peaks(mesh_obj, spine02_head):
    """On 1.0m neural-rigged Hunyuan Mai (facing -Y, Left=+X, Right=-X, Up=+Z):"""
    cx = spine02_head.x
    best_l = None
    best_r = None
    for v in mesh_obj.data.vertices:
        co = v.co
        if 0.66 <= co.z <= 0.78 and co.y < spine02_head.y - 0.02:
            if cx + 0.015 <= co.x <= cx + 0.10:
                if best_l is None or co.y < best_l.y:
                    best_l = co.copy()
            elif cx - 0.10 <= co.x <= cx - 0.015:
                if best_r is None or co.y < best_r.y:
                    best_r = co.copy()

    if best_l is None:
        best_l = Vector((cx + 0.042, spine02_head.y - 0.09, 0.72))
    if best_r is None:
        best_r = Vector((cx - 0.042, spine02_head.y - 0.09, 0.72))

    dx = 0.5 * (abs(best_l.x - cx) + abs(best_r.x - cx))
    avg_y = 0.5 * (best_l.y + best_r.y)
    avg_z = 0.5 * (best_l.z + best_r.z)
    peak_l = Vector((cx + dx, avg_y, avg_z))
    peak_r = Vector((cx - dx, avg_y, avg_z))
    print(f"[HunyuanFinal] Detected breast peaks: L={tuple(round(x,3) for x in peak_l)} R={tuple(round(x,3) for x in peak_r)}")
    return peak_l, peak_r, cx


def add_breast_bones_and_weights(arm_obj, mesh_obj, peak_l, peak_r, cx):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_obj.data.edit_bones
    spine02 = eb.get("Spine02") or eb.get("Spine01")
    for bname, pk in (("Breast.L", peak_l), ("Breast.R", peak_r)):
        if bname in eb:
            eb.remove(eb[bname])
        b = eb.new(bname)
        b.head = Vector((pk.x, pk.y + 0.055, pk.z + 0.005))
        b.tail = Vector((pk.x, pk.y - 0.015, pk.z - 0.004))
        b.parent = spine02
        b.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")

    mesh = mesh_obj.data
    vg_l = mesh_obj.vertex_groups.get("Breast.L") or mesh_obj.vertex_groups.new(name="Breast.L")
    vg_r = mesh_obj.vertex_groups.get("Breast.R") or mesh_obj.vertex_groups.new(name="Breast.R")
    col_attr = mesh.color_attributes.get("Color")
    if col_attr is None:
        col_attr = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")

    com_l = Vector((peak_l.x, peak_l.y, peak_l.z - 0.008))
    com_r = Vector((peak_r.x, peak_r.y, peak_r.z - 0.008))

    rx_width = 0.056
    rz_height = 0.060
    ry_depth = 0.072
    max_y = peak_l.y + 0.078

    vert_rgba = [(0.0, 0.0, 0.0, 0.0)] * len(mesh.vertices)
    pl = pr = 0

    for v in mesh.vertices:
        co = v.co
        if co.y > max_y or co.z < peak_l.z - 0.085 or co.z > peak_l.z + 0.085 or abs(co.x - cx) > 0.13:
            continue
        is_left = co.x >= cx
        com = com_l if is_left else com_r
        dx = (co.x - com.x) / rx_width
        dz = (co.z - com.z) / rz_height
        depth_t = max(0.0, min(1.0, (max_y - co.y) / ry_depth))
        r2 = dx * dx + dz * dz
        if r2 < 1.38 and depth_t > 0.04:
            w = math.exp(-r2 * 1.40) * (depth_t ** 1.20)
            cleave = 1.0 - 0.65 * math.exp(-(((co.x - cx) / 0.014) ** 2.0))
            w = min(0.98, w * cleave * 1.18)
            radial_norm = min(1.0, math.sqrt(r2) / 1.15)
            lower_bias = max(0.0, min(1.0, 0.5 - dz * 0.55))
            vert_rgba[v.index] = (w, 1.0 if is_left else 0.0, radial_norm, lower_bias)
            if w > 0.02:
                scale_old = 1.0 - w
                existing = [(g.group, g.weight) for g in v.groups]
                for gi, gw in existing:
                    mesh_obj.vertex_groups[gi].add([v.index], gw * scale_old, "REPLACE")
                if is_left:
                    vg_l.add([v.index], w, "REPLACE")
                    pl += 1
                else:
                    vg_r.add([v.index], w, "REPLACE")
                    pr += 1

    for poly in mesh.polygons:
        for li in poly.loop_indices:
            col_attr.data[li].color = vert_rgba[mesh.loops[li].vertex_index]

    print(f"[HunyuanFinal] Painted Breast weights & CoM Vertex Color Map: L={pl}, R={pr}")


def bake_kof_animations(arm_obj):
    """Bake 9 smooth KOF animations onto 78-bone neural-rigged Hunyuan Mai (facing -Y, Left=+X, Up=+Z, 1.0m)."""
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
    rest_mat3 = {n: arm_obj.data.bones[n].matrix_local.to_3x3() for n in key_bones}

    def reset_pose():
        for n in key_bones:
            b = pb[n]
            b.rotation_mode = "QUATERNION"
            b.location = (0.0, 0.0, 0.0)
            b.rotation_quaternion = Quaternion((1.0, 0.0, 0.0, 0.0))

    def rot_world(name, pitch_deg=0.0, yaw_deg=0.0, roll_deg=0.0):
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

    def clip_idle(end_f):
        for f in range(1, end_f + 1, 3):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            bnc = math.sin(t * 2.0)
            swy = math.sin(t)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.028 + bnc * 0.024)
            rot_world("Hip", pitch_deg=3 + bnc * 2, yaw_deg=12 + swy * 4, roll_deg=swy * 3)
            rot_world("Spine01", pitch_deg=3 - bnc * 3, yaw_deg=-5, roll_deg=-swy * 3)
            rot_world("Spine02", pitch_deg=-5 + bnc * 4, yaw_deg=-7 - swy * 3)
            rot_world("Head", pitch_deg=2 - bnc * 2, yaw_deg=-4)
            rot_world("L_Thigh", pitch_deg=-16 + bnc * 8)
            rot_world("L_Calf", pitch_deg=28 - bnc * 14)
            rot_world("R_Thigh", pitch_deg=6 + bnc * 6)
            rot_world("R_Calf", pitch_deg=16 - bnc * 10)
            rot_world("L_Upperarm", pitch_deg=-10, roll_deg=6 + bnc * 4)
            rot_world("L_Forearm", pitch_deg=-24)
            rot_world("R_Upperarm", pitch_deg=-14, roll_deg=-6 - bnc * 4)
            rot_world("R_Forearm", pitch_deg=-26)
            key_all(f)

    def clip_jump_start(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.10)
        rot_world("Spine01", pitch_deg=15)
        rot_world("Spine02", pitch_deg=10)
        rot_world("L_Thigh", pitch_deg=-40)
        rot_world("L_Calf", pitch_deg=68)
        rot_world("R_Thigh", pitch_deg=-36)
        rot_world("R_Calf", pitch_deg=64)
        rot_world("L_Upperarm", pitch_deg=16)
        rot_world("R_Upperarm", pitch_deg=16)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.035)
        rot_world("Spine01", pitch_deg=-8)
        rot_world("Spine02", pitch_deg=-8)
        rot_world("L_Thigh", pitch_deg=10)
        rot_world("R_Thigh", pitch_deg=10)
        rot_world("L_Upperarm", pitch_deg=-20, roll_deg=44)
        rot_world("R_Upperarm", pitch_deg=-20, roll_deg=-44)
        key_all(end_f)

    def clip_jump_air(end_f):
        for f in (1, end_f // 2, end_f):
            p = math.sin(((f - 1) / (end_f - 1)) * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, 0.02)
            rot_world("Spine01", pitch_deg=-5 + p * 4, yaw_deg=5)
            rot_world("Spine02", pitch_deg=-6, yaw_deg=-5)
            rot_world("L_Thigh", pitch_deg=-44 - p * 8)
            rot_world("L_Calf", pitch_deg=76)
            rot_world("R_Thigh", pitch_deg=14)
            rot_world("R_Calf", pitch_deg=24)
            rot_world("L_Upperarm", roll_deg=32)
            rot_world("R_Upperarm", roll_deg=-32)
            key_all(f)

    def clip_jump_land(end_f):
        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.12)
        rot_world("Spine01", pitch_deg=18)
        rot_world("Spine02", pitch_deg=12)
        rot_world("L_Thigh", pitch_deg=-46)
        rot_world("L_Calf", pitch_deg=80)
        rot_world("R_Thigh", pitch_deg=-42)
        rot_world("R_Calf", pitch_deg=76)
        rot_world("L_Upperarm", roll_deg=20)
        rot_world("R_Upperarm", roll_deg=-20)
        key_all(1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, 0.02)
        rot_world("Spine01", pitch_deg=-7)
        rot_world("Spine02", pitch_deg=-6)
        rot_world("L_Thigh", pitch_deg=-10)
        rot_world("L_Calf", pitch_deg=18)
        rot_world("R_Thigh", pitch_deg=-10)
        rot_world("R_Calf", pitch_deg=18)
        key_all(end_f // 2 + 1)

        reset_pose()
        move_world("Hip", 0.0, 0.0, -0.025)
        rot_world("L_Thigh", pitch_deg=-14)
        rot_world("L_Calf", pitch_deg=24)
        rot_world("R_Thigh", pitch_deg=6)
        rot_world("R_Calf", pitch_deg=14)
        key_all(end_f)

    def clip_jog(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            bnc = abs(math.sin(t))
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.042 + bnc * 0.056)
            rot_world("Hip", pitch_deg=8, yaw_deg=s * 10, roll_deg=s * 4)
            rot_world("Spine01", pitch_deg=6, yaw_deg=-s * 12, roll_deg=-s * 3)
            rot_world("Spine02", pitch_deg=4, yaw_deg=-s * 12)
            rot_world("L_Thigh", pitch_deg=-s * 36 - 6)
            rot_world("L_Calf", pitch_deg=max(0, -c) * 58 + 14)
            rot_world("R_Thigh", pitch_deg=s * 36 - 6)
            rot_world("R_Calf", pitch_deg=max(0, c) * 58 + 14)
            rot_world("L_Upperarm", pitch_deg=s * 34)
            rot_world("L_Forearm", pitch_deg=-42)
            rot_world("R_Upperarm", pitch_deg=-s * 34)
            rot_world("R_Forearm", pitch_deg=-42)
            key_all(f)

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
            rot_world("L_Thigh", pitch_deg=-14 - lift * 20)
            rot_world("L_Calf", pitch_deg=26 + lift * 32)
            rot_world("R_Thigh", pitch_deg=8)
            rot_world("R_Calf", pitch_deg=14)
            rot_world("L_Upperarm", roll_deg=36)
            rot_world("R_Upperarm", roll_deg=-38 - lift * 20)
            key_all(f)

    def clip_ryuuenbu(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = (u ** 1.2) * 720.0
            dip = math.sin(u * math.pi)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.10 * dip + 0.03 * math.sin(u * math.pi * 2))
            rot_world("Hip", pitch_deg=16 * dip, yaw_deg=spin)
            rot_world("Spine01", pitch_deg=14 * dip, yaw_deg=16 * math.sin(u * math.pi * 2))
            rot_world("Spine02", pitch_deg=-6 + 10 * dip, yaw_deg=18 * math.sin(u * math.pi * 2))
            rot_world("L_Thigh", pitch_deg=-36 * dip - 10)
            rot_world("L_Calf", pitch_deg=58 * dip + 16)
            rot_world("R_Thigh", pitch_deg=-26 * dip)
            rot_world("R_Calf", pitch_deg=46 * dip + 14)
            rot_world("L_Upperarm", roll_deg=40)
            rot_world("R_Upperarm", roll_deg=-40)
            key_all(f)

    def clip_cheer(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            hop = abs(math.sin(u * math.pi * 2.0))
            swy = math.sin(u * math.pi * 2.0)
            reset_pose()
            move_world("Hip", 0.0, 0.0, -0.068 + hop * 0.145)
            rot_world("Hip", pitch_deg=-5 * hop + 8 * (1 - hop), yaw_deg=swy * 8, roll_deg=swy * 5)
            rot_world("Spine01", pitch_deg=-8 * hop + 5 * (1 - hop), yaw_deg=-swy * 6, roll_deg=-swy * 4)
            rot_world("Spine02", pitch_deg=-7 * hop, roll_deg=-swy * 4)
            rot_world("L_Thigh", pitch_deg=-24 * (1 - hop) + 8 * hop)
            rot_world("L_Calf", pitch_deg=44 * (1 - hop) + 18 * hop)
            rot_world("R_Thigh", pitch_deg=-24 * (1 - hop) + 8 * hop)
            rot_world("R_Calf", pitch_deg=44 * (1 - hop) + 18 * hop)
            rot_world("L_Upperarm", roll_deg=88 + hop * 16)
            rot_world("R_Upperarm", roll_deg=-88 - hop * 16)
            key_all(f)

    def clip_sway(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            reset_pose()
            move_world("Hip", s * 0.052, 0.0, -0.030 + abs(c) * 0.020)
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

    ico = bpy.data.objects.get("Icosphere")
    if ico:
        bpy.data.objects.remove(ico, do_unlink=True)

    arm_obj = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    mesh_obj = next((o for o in bpy.data.objects if o.type == "MESH"), None)
    if arm_obj is None or mesh_obj is None:
        raise RuntimeError("Missing Armature or Mesh in mai_hunyuan_rigged.glb!")

    spine02_head = arm_obj.data.bones["Spine02"].head_local.copy()
    peak_l, peak_r, cx = detect_breast_peaks(mesh_obj, spine02_head)
    add_breast_bones_and_weights(arm_obj, mesh_obj, peak_l, peak_r, cx)
    bake_kof_animations(arm_obj)

    # Scale to 1.68m & center X/Y cleanly over origin
    arm_obj.scale = (1.68, 1.68, 1.68)
    arm_obj.location = (-cx * 1.68, -spine02_head.y * 1.68, 0.0)

    # Re-pack all images as standard PNG so Godot's glTF loader reads every texture cleanly
    for img in bpy.data.images:
        if img.has_data:
            img.file_format = "PNG"
            img.pack()

    bpy.context.scene.render.fps = 30
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=True,
    )
    print(f"[HunyuanFinal] Exported neural-rigged Hunyuan3D Mai -> {out_path}")


if __name__ == "__main__":
    main()
