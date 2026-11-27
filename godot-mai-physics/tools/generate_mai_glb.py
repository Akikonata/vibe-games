"""
Blender 5.x Python script: Procedurally sculpt, rig, skin, texture, animate, and export
a stylized 3D Mai Shiranui (不知火舞) .glb character for Godot 4 with dedicated
Breast.L / Breast.R soft-skinning weights, Ponytail, Obi ribbons, and Apron chains.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python generate_mai_glb.py -- output.glb
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix, Euler


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_material(name, base_color, roughness=0.45, metallic=0.0, sheen=0.0, coat=0.0, emission=None, texture_img=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 0.65

    if texture_img is not None:
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = texture_img
        tex_node.location = (-340, 260)
        links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])

    return mat


def generate_face_image(name="MaiFaceTex", size=512):
    img = bpy.data.images.new(name, width=size, height=size, alpha=True)
    # Build pixel buffer (RGBA float 0..1)
    pixels = [0.0] * (size * size * 4)

    def set_px(x, y, r, g, b, a=1.0):
        if 0 <= x < size and 0 <= y < size:
            idx = (y * size + x) * 4
            if a >= 0.999:
                pixels[idx] = r
                pixels[idx + 1] = g
                pixels[idx + 2] = b
                pixels[idx + 3] = 1.0
            else:
                inv = 1.0 - a
                pixels[idx] = pixels[idx] * inv + r * a
                pixels[idx + 1] = pixels[idx + 1] * inv + g * a
                pixels[idx + 2] = pixels[idx + 2] * inv + b * a
                pixels[idx + 3] = 1.0

    def fill_ellipse(cx, cy, rx, ry, col, soft=0.0):
        r, g, b, a = col
        x0 = max(0, int(cx - rx - 2))
        x1 = min(size - 1, int(cx + rx + 2))
        y0 = max(0, int(cy - ry - 2))
        y1 = min(size - 1, int(cy + ry + 2))
        for y in range(y0, y1 + 1):
            dy = (y - cy) / max(1e-4, ry)
            for x in range(x0, x1 + 1):
                dx = (x - cx) / max(1e-4, rx)
                d = math.sqrt(dx * dx + dy * dy)
                if d <= 1.0:
                    alpha = a if soft <= 0.0 else a * max(0.0, min(1.0, (1.0 - d) / soft))
                    set_px(x, y, r, g, b, alpha)

    # Base warm anime skin
    for y in range(size):
        for x in range(size):
            dx = (x - size * 0.5) / (size * 0.5)
            dy = (y - size * 0.5) / (size * 0.5)
            d = min(1.0, math.sqrt(dx * dx + dy * dy))
            r = 0.99 - 0.04 * d
            g = 0.84 - 0.07 * d
            b = 0.74 - 0.08 * d
            idx = (y * size + x) * 4
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            pixels[idx + 3] = 1.0

    # Soft rosy blush
    fill_ellipse(size * 0.34, size * 0.42, size * 0.085, size * 0.045, (0.98, 0.46, 0.52, 0.38), soft=0.85)
    fill_ellipse(size * 0.66, size * 0.42, size * 0.085, size * 0.045, (0.98, 0.46, 0.52, 0.38), soft=0.85)

    # Anime eyes (y is bottom-up in Blender image!)
    for side in (-1, 1):
        ex = size * (0.5 + side * 0.135)
        ey = size * 0.52
        # Sclera
        fill_ellipse(ex, ey, size * 0.064, size * 0.046, (1.0, 0.98, 0.97, 1.0), soft=0.12)
        # Amber-brown iris
        fill_ellipse(ex - side * size * 0.005, ey - size * 0.004, size * 0.038, size * 0.041, (0.58, 0.22, 0.09, 1.0), soft=0.08)
        # Warm golden lower iris highlight
        fill_ellipse(ex - side * size * 0.005, ey - size * 0.018, size * 0.025, size * 0.017, (0.92, 0.56, 0.24, 0.85), soft=0.45)
        # Pupil
        fill_ellipse(ex - side * size * 0.005, ey - size * 0.004, size * 0.017, size * 0.021, (0.12, 0.04, 0.02, 1.0), soft=0.15)
        # Crisp glossy eye sparkles
        fill_ellipse(ex - side * size * 0.018, ey + size * 0.014, size * 0.013, size * 0.011, (1.0, 1.0, 1.0, 1.0), soft=0.1)
        fill_ellipse(ex + side * size * 0.012, ey - size * 0.018, size * 0.006, size * 0.006, (1.0, 1.0, 1.0, 0.95), soft=0.1)

        # Upper dark lash arch + winged outer flick
        for t_i in range(80):
            t = t_i / 79.0
            ang = math.pi * (0.08 + 0.84 * t)
            lx = ex + side * math.cos(ang) * size * 0.068
            ly = ey + math.sin(ang) * size * 0.048 + size * 0.006
            fill_ellipse(lx, ly, size * 0.008, size * 0.009, (0.14, 0.05, 0.04, 1.0), soft=0.15)
        # Winged lash flick
        for t_i in range(18):
            t = t_i / 17.0
            lx = ex + side * (size * 0.058 + t * size * 0.024)
            ly = ey + size * 0.018 + t * size * 0.018
            fill_ellipse(lx, ly, size * 0.006 * (1 - 0.5 * t), size * 0.005, (0.14, 0.05, 0.04, 1.0), soft=0.1)

        # Eyebrow
        for t_i in range(60):
            t = t_i / 59.0
            bx = ex + side * (-size * 0.055 + t * size * 0.12)
            by = ey + size * 0.082 + math.sin(t * math.pi) * size * 0.018
            fill_ellipse(bx, by, size * 0.006, size * 0.005, (0.32, 0.12, 0.06, 0.92), soft=0.2)

    # Subtle nose shadow
    fill_ellipse(size * 0.5, size * 0.42, size * 0.007, size * 0.011, (0.82, 0.55, 0.44, 0.4), soft=0.7)

    # Confident red lips (subtle smile)
    for t_i in range(70):
        t = t_i / 69.0
        mx = size * (0.445 + 0.11 * t)
        my = size * (0.335 - math.sin(t * math.pi) * 0.018)
        fill_ellipse(mx, my, size * 0.007, size * 0.009, (0.86, 0.24, 0.30, 0.92), soft=0.25)
    fill_ellipse(size * 0.5, size * 0.324, size * 0.018, size * 0.005, (1.0, 0.85, 0.85, 0.65), soft=0.5)

    img.pixels.foreach_set(pixels)
    img.pack()
    return img


def generate_fan_image(name="MaiFanTex", size=256):
    img = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    for y in range(size):
        v = y / (size - 1)
        for x in range(size):
            u = x / (size - 1)
            # Ivory washi paper
            r, g, b = 0.99, 0.95, 0.88
            # Crimson sun disc in center
            dx = u - 0.5
            dy = v - 0.52
            if dx * dx + dy * dy < 0.055:
                r, g, b = 0.85, 0.11, 0.16
            # Top crimson & gold border
            if v > 0.88:
                r, g, b = 0.82, 0.10, 0.15
            elif v > 0.84:
                r, g, b = 0.94, 0.72, 0.24
            # Subtle folding rib lines
            if abs((u * 11.0) - round(u * 11.0)) < 0.03:
                r *= 0.92
                g *= 0.90
                b *= 0.88
            idx = (y * size + x) * 4
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            pixels[idx + 3] = 1.0
    img.pixels.foreach_set(pixels)
    img.pack()
    return img


def add_lofted_mesh(bm, sections, radial=28, cap_bottom=True, cap_top=True, mat_idx=0):
    """
    sections: list of dicts {z, rx, ry, x=0, y=0, flat_back=0, cleavage=0}
    Blender Z-up, -Y is front, +Y is back.
    """
    rings = []
    for i, s in enumerate(sections):
        cx = s.get("x", 0.0)
        cy = s.get("y", 0.0)
        cz = s["z"]
        rx = s["rx"]
        ry = s["ry"]
        flat_back = s.get("flat_back", 0.0)
        cleavage = s.get("cleavage", 0.0)
        ring = []
        for j in range(radial):
            theta = (j / radial) * math.pi * 2.0
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)
            cur_ry = ry
            # +Y is back
            if sin_t > 0 and flat_back > 0:
                cur_ry *= 1.0 - flat_back * (sin_t ** 2.0)
            # -Y is front
            if sin_t < 0 and cleavage > 0:
                front_center = ((-sin_t) ** 4.0) * math.exp(-((cos_t * 3.0) ** 2.0))
                cur_ry *= 1.0 - cleavage * front_center
            v = bm.verts.new((cx + cos_t * rx, cy + sin_t * cur_ry, cz))
            ring.append(v)
        rings.append(ring)

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for j in range(radial):
            jn = (j + 1) % radial
            f = bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            f.material_index = mat_idx
            f.smooth = True

    if cap_bottom and len(rings) > 0:
        f = bm.faces.new(list(reversed(rings[0])))
        f.material_index = mat_idx
        f.smooth = True
    if cap_top and len(rings) > 0:
        f = bm.faces.new(rings[-1])
        f.material_index = mat_idx
        f.smooth = True

    return rings


def add_teardrop_breast(bm, side_sign, center, rx=0.092, rz=0.096, depth_y=0.118, seg_u=28, seg_v=20, mat_skin=0, mat_red=1, mat_white=2, with_outfit=True):
    """
    Create anatomical teardrop breast dome pointing toward -Y (front in Blender).
    Returns list of (vert, soft_weight) for smooth vertex-weight assignment.
    """
    cx, cy, cz = center
    rings = []
    vert_weights = []

    for iv in range(seg_v + 1):
        v_t = iv / seg_v
        phi = v_t * (math.pi * 0.52)
        sin_p = math.sin(phi)
        cos_p = math.cos(phi)
        soft_w = min(1.0, (sin_p * 1.15) ** 1.32)

        ring = []
        for iu in range(seg_u):
            u_t = iu / seg_u
            theta = u_t * math.pi * 2.0
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)

            # Teardrop sculpture: fuller lower hemisphere, gentle upper slope
            lower_full = (1.0 + 0.20 * ((-sin_t) ** 1.35) * sin_p) if sin_t < 0 else (1.0 - 0.13 * (sin_t ** 1.4) * (1.0 - 0.4 * sin_p))
            is_outer = (cos_t * side_sign) > 0
            lat_scale = 1.07 if is_outer else 0.95
            root_flare = 1.0 + 0.14 * ((1.0 - v_t) ** 2.2)

            lx = cos_p * cos_t * rx * lat_scale * root_flare
            lz = cos_p * sin_t * rz * lower_full * root_flare
            ly = -sin_p * depth_y  # -Y is forward!

            # Natural gravity teardrop droop & slight outward splay
            lz -= (sin_p ** 1.65) * 0.022
            lx += side_sign * (sin_p ** 1.45) * 0.010
            # Curve root backward slightly to wrap ribcage
            ly += (lx * lx) * 1.25

            vert = bm.verts.new((cx + lx, cy + ly, cz + lz))
            ring.append((vert, cos_t, sin_t, v_t))
            vert_weights.append((vert, soft_w))
        rings.append(ring)

    # Apex cap vertex
    apex_v = bm.verts.new((cx + side_sign * 0.010, cy - depth_y * 1.01, cz - 0.022))
    vert_weights.append((apex_v, 1.0))

    for iv in range(seg_v):
        r0 = rings[iv]
        r1 = rings[iv + 1]
        for iu in range(seg_u):
            iun = (iu + 1) % seg_u
            v00, ct, st, vt = r0[iu]
            v01 = r0[iun][0]
            v11 = r1[iun][0]
            v10 = r1[iu][0]
            f = bm.faces.new((v00, v10, v11, v01))
            f.smooth = True

            if with_outfit:
                # Plunging V-neck kunoichi bodice on outer/lower bust, skin on inner/upper cleavage
                inner = -ct * side_sign * (1.0 - vt * 0.65)
                upper = st * (1.0 - vt * 0.62)
                metric = inner * 0.92 + upper * 0.72
                if metric > 0.34:
                    f.material_index = mat_skin
                elif metric > 0.22:
                    f.material_index = mat_white
                else:
                    f.material_index = mat_red
            else:
                f.material_index = mat_skin

    # Cap apex
    top_r = rings[-1]
    for iu in range(seg_u):
        iun = (iu + 1) % seg_u
        f = bm.faces.new((top_r[iu][0], apex_v, top_r[iun][0]))
        f.smooth = True
        f.material_index = mat_red if with_outfit else mat_skin

    return vert_weights


def build_armature():
    arm_data = bpy.data.armatures.new("Mai_Armature")
    arm_obj = bpy.data.objects.new("Mai_Rig", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(name, head, tail, parent_name=None, connect=False):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent_name:
            b.parent = eb[parent_name]
            b.use_connect = connect
        return b

    # Spine hierarchy (total height ~1.68m, Z-up, -Y forward)
    add_bone("Root", (0, 0, 0.0), (0, 0, 0.15))
    add_bone("Hips", (0, 0, 0.92), (0, 0, 1.04), "Root")
    add_bone("Spine", (0, 0, 1.04), (0, 0, 1.20), "Hips", True)
    add_bone("Chest", (0, 0, 1.20), (0, 0, 1.40), "Spine", True)
    add_bone("Neck", (0, 0.01, 1.40), (0, 0.01, 1.48), "Chest", True)
    add_bone("Head", (0, 0.01, 1.48), (0, 0.01, 1.68), "Neck", True)

    # Dedicated Soft-Body Breast Bones (anchored to Chest, pointing forward -Y)
    add_bone("Breast.L", (0.082, -0.075, 1.295), (0.090, -0.205, 1.275), "Chest")
    add_bone("Breast.R", (-0.082, -0.075, 1.295), (-0.090, -0.205, 1.275), "Chest")

    # High Ponytail Chain (4 segments)
    add_bone("Ponytail.0", (0, 0.10, 1.62), (0, 0.22, 1.54), "Head")
    add_bone("Ponytail.1", (0, 0.22, 1.54), (0, 0.26, 1.36), "Ponytail.0", True)
    add_bone("Ponytail.2", (0, 0.26, 1.36), (0, 0.24, 1.18), "Ponytail.1", True)
    add_bone("Ponytail.3", (0, 0.24, 1.18), (0, 0.21, 1.02), "Ponytail.2", True)

    # Obi Back Ribbon Tails (Left & Right 3-bone chains)
    for side, s in (("L", 1), ("R", -1)):
        add_bone(f"ObiTail.{side}.0", (s * 0.05, 0.15, 0.96), (s * 0.09, 0.20, 0.78), "Hips")
        add_bone(f"ObiTail.{side}.1", (s * 0.09, 0.20, 0.78), (s * 0.11, 0.22, 0.58), f"ObiTail.{side}.0", True)
        add_bone(f"ObiTail.{side}.2", (s * 0.11, 0.22, 0.58), (s * 0.12, 0.23, 0.38), f"ObiTail.{side}.1", True)

    # Front & Back Kunoichi Apron Cloth Panels
    add_bone("ApronFront.0", (0, -0.115, 0.92), (0, -0.135, 0.70), "Hips")
    add_bone("ApronFront.1", (0, -0.135, 0.70), (0, -0.145, 0.48), "ApronFront.0", True)
    add_bone("ApronBack.0", (0, 0.125, 0.92), (0, 0.145, 0.70), "Hips")
    add_bone("ApronBack.1", (0, 0.145, 0.70), (0, 0.155, 0.48), "ApronBack.0", True)

    # Arms (A-pose)
    for side, s in (("L", 1), ("R", -1)):
        add_bone(f"Shoulder.{side}", (s * 0.04, 0.01, 1.37), (s * 0.16, 0.01, 1.37), "Chest")
        add_bone(f"UpperArm.{side}", (s * 0.16, 0.01, 1.37), (s * 0.34, 0.02, 1.18), f"Shoulder.{side}", True)
        add_bone(f"Forearm.{side}", (s * 0.34, 0.02, 1.18), (s * 0.48, -0.02, 1.00), f"UpperArm.{side}", True)
        add_bone(f"Hand.{side}", (s * 0.48, -0.02, 1.00), (s * 0.54, -0.04, 0.93), f"Forearm.{side}", True)

    # Legs
    for side, s in (("L", 1), ("R", -1)):
        add_bone(f"Thigh.{side}", (s * 0.095, 0.0, 0.90), (s * 0.10, -0.01, 0.48), "Hips")
        add_bone(f"Shin.{side}", (s * 0.10, -0.01, 0.48), (s * 0.095, 0.01, 0.08), f"Thigh.{side}", True)
        add_bone(f"Foot.{side}", (s * 0.095, 0.01, 0.08), (s * 0.095, -0.10, 0.02), f"Shin.{side}", True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def build_mai_mesh(arm_obj):
    # Materials
    face_img = generate_face_image()
    fan_img = generate_fan_image()

    mat_skin = create_material("Mai_Skin", (0.99, 0.80, 0.69, 1.0), roughness=0.38, sheen=0.25, coat=0.06)
    mat_red = create_material("Mai_Crimson", (0.82, 0.06, 0.11, 1.0), roughness=0.34, sheen=0.45, coat=0.12)
    mat_white = create_material("Mai_White", (0.98, 0.96, 0.94, 1.0), roughness=0.42, sheen=0.30)
    mat_gold = create_material("Mai_Gold", (0.95, 0.72, 0.22, 1.0), roughness=0.24, metallic=0.85)
    mat_hair = create_material("Mai_Hair", (0.20, 0.08, 0.04, 1.0), roughness=0.28, sheen=0.40, coat=0.25)
    mat_face = create_material("Mai_Face", (1.0, 1.0, 1.0, 1.0), roughness=0.36, texture_img=face_img)
    mat_fan = create_material("Mai_Fan", (1.0, 1.0, 1.0, 1.0), roughness=0.45, texture_img=fan_img)

    # Indices: 0 skin, 1 red, 2 white, 3 gold, 4 hair, 5 face, 6 fan
    mats = [mat_skin, mat_red, mat_white, mat_gold, mat_hair, mat_face, mat_fan]

    mesh = bpy.data.meshes.new("Mai_Body_Mesh")
    obj = bpy.data.objects.new("Mai_Character", mesh)
    bpy.context.collection.objects.link(obj)
    for m in mats:
        obj.data.materials.append(m)

    bm = bmesh.new()
    # Track explicit vertex weights: dict[bmesh_vert] -> dict[bone_name -> weight]
    explicit_weights = {}

    def assign_w(vert, mapping):
        explicit_weights[vert] = mapping

    # 1. Sculpted Curvaceous Torso (Pelvis -> Hourglass Waist -> Ribcage -> Neck)
    torso_sections = [
        {"z": 0.80, "rx": 0.148, "ry": 0.118, "y": 0.015, "flat_back": 0.08},   # Lower hips / glutes
        {"z": 0.88, "rx": 0.172, "ry": 0.136, "y": 0.012, "flat_back": 0.05},   # Fullest hips
        {"z": 0.96, "rx": 0.152, "ry": 0.118, "y": 0.005, "flat_back": 0.10},   # Upper pelvis
        {"z": 1.04, "rx": 0.110, "ry": 0.088, "y": -0.002, "flat_back": 0.15},  # Slim hourglass waist
        {"z": 1.12, "rx": 0.118, "ry": 0.094, "y": -0.004, "flat_back": 0.15},  # Lower ribcage
        {"z": 1.22, "rx": 0.136, "ry": 0.104, "y": -0.004, "flat_back": 0.14, "cleavage": 0.18},  # Mid chest
        {"z": 1.32, "rx": 0.148, "ry": 0.100, "y": 0.000, "flat_back": 0.12, "cleavage": 0.22},   # Upper chest
        {"z": 1.39, "rx": 0.132, "ry": 0.082, "y": 0.008, "flat_back": 0.10},   # Collarbone / shoulders
        {"z": 1.43, "rx": 0.054, "ry": 0.052, "y": 0.010},                      # Neck base
        {"z": 1.50, "rx": 0.048, "ry": 0.048, "y": 0.010},                      # Neck top
    ]
    torso_rings = add_lofted_mesh(bm, torso_sections, radial=32, mat_idx=0)

    # Color torso faces for Mai's plunging halter bodice & crimson leotard hips
    bm.faces.ensure_lookup_table()
    for ring_idx, ring in enumerate(torso_rings):
        z = torso_sections[ring_idx]["z"]
        for v in ring:
            if z < 0.99:
                assign_w(v, {"Hips": 1.0})
            elif z < 1.13:
                t = (z - 0.99) / 0.14
                assign_w(v, {"Hips": 1.0 - t, "Spine": t})
            elif z < 1.25:
                t = (z - 1.13) / 0.12
                assign_w(v, {"Spine": 1.0 - t, "Chest": t})
            elif z < 1.40:
                assign_w(v, {"Chest": 1.0})
            else:
                t = min(1.0, (z - 1.40) / 0.08)
                assign_w(v, {"Chest": 1.0 - t, "Neck": t})

    # Paint torso outfit (halter front, crimson pelvis, bare back/sides)
    for f in bm.faces:
        c = f.calc_center_median()
        if 0.80 <= c.z <= 0.97:
            # High-cut red kunoichi leotard bottom + white obi belt line
            if c.z > 0.93:
                f.material_index = 2  # white obi
            elif abs(c.x) < 0.115 or c.y > 0.04:
                f.material_index = 1  # red
        elif 0.97 < c.z <= 1.38:
            # Plunging front bodice + halter straps, bare back & sides
            if c.y < -0.03:
                if abs(c.x) < 0.085 and c.z < 1.22:
                    f.material_index = 1
                elif 0.035 < abs(c.x) < 0.088 and c.z >= 1.22:
                    f.material_index = 2 if abs(c.x) < 0.052 else 1
        elif 1.38 < c.z <= 1.44 and c.y < 0.04:
            # Halter neck collar
            f.material_index = 2

    # 2. Sculpted Teardrop Breasts with Smooth Soft-Body Skinning Weights!
    for side_name, side_sign in (("Breast.L", 1), ("Breast.R", -1)):
        vw = add_teardrop_breast(
            bm,
            side_sign=side_sign,
            center=(side_sign * 0.076, -0.074, 1.278),
            rx=0.090,
            rz=0.094,
            depth_y=0.118,
            seg_u=28,
            seg_v=20,
            mat_skin=0,
            mat_red=1,
            mat_white=2,
            with_outfit=True,
        )
        for v, w in vw:
            # Root stays anchored to Chest (1-w), apex & lower fullness driven by Breast.L/R (w)
            assign_w(v, {side_name: w, "Chest": max(0.0, 1.0 - w)})

    # 3. Sculpted Obi Sash + Iconic Large White/Crimson Back Bow
    obi_sections = [
        {"z": 0.925, "rx": 0.166, "ry": 0.130, "y": 0.008},
        {"z": 0.965, "rx": 0.156, "ry": 0.122, "y": 0.004},
        {"z": 1.020, "rx": 0.122, "ry": 0.098, "y": 0.000},
    ]
    obi_rings = add_lofted_mesh(bm, obi_sections, radial=32, cap_bottom=False, cap_top=False, mat_idx=2)
    for ring in obi_rings:
        for v in ring:
            assign_w(v, {"Hips": 0.7, "Spine": 0.3})

    # Obi back bow loops (left & right puffy white/red bow wings)
    for s in (-1, 1):
        bow_sec = [
            {"z": 0.96, "rx": 0.03, "ry": 0.025, "x": s * 0.03, "y": 0.135},
            {"z": 1.00, "rx": 0.085, "ry": 0.045, "x": s * 0.12, "y": 0.175},
            {"z": 0.97, "rx": 0.072, "ry": 0.038, "x": s * 0.19, "y": 0.195},
            {"z": 0.95, "rx": 0.015, "ry": 0.012, "x": s * 0.21, "y": 0.198},
        ]
        bow_rings = add_lofted_mesh(bm, bow_sec, radial=16, mat_idx=2)
        for ring in bow_rings:
            for v in ring:
                assign_w(v, {"Hips": 1.0})

    # 4. Flowing Obi Ribbon Tails (rigged to ObiTail.L/R.0..2)
    for side, s in (("L", 1), ("R", -1)):
        tail_sec = [
            {"z": 0.95, "rx": 0.038, "ry": 0.008, "x": s * 0.05, "y": 0.15},
            {"z": 0.78, "rx": 0.046, "ry": 0.008, "x": s * 0.09, "y": 0.20},
            {"z": 0.58, "rx": 0.052, "ry": 0.008, "x": s * 0.11, "y": 0.22},
            {"z": 0.38, "rx": 0.042, "ry": 0.007, "x": s * 0.12, "y": 0.23},
        ]
        tail_rings = add_lofted_mesh(bm, tail_sec, radial=12, mat_idx=2)
        bone_names = [f"ObiTail.{side}.0", f"ObiTail.{side}.1", f"ObiTail.{side}.2"]
        for idx_r, ring in enumerate(tail_rings):
            bname = bone_names[min(idx_r, 2)]
            for v in ring:
                assign_w(v, {bname: 1.0})

    # 5. Front & Back Kunoichi Crimson Apron Cloth Panels (with white/gold border!)
    for label, y_sign, b_prefix in (("Front", -1, "ApronFront"), ("Back", 1, "ApronBack")):
        apron_sec = [
            {"z": 0.92, "rx": 0.105, "ry": 0.010, "y": y_sign * 0.122},
            {"z": 0.72, "rx": 0.118, "ry": 0.010, "y": y_sign * 0.138},
            {"z": 0.50, "rx": 0.128, "ry": 0.010, "y": y_sign * 0.148},
            {"z": 0.45, "rx": 0.122, "ry": 0.009, "y": y_sign * 0.150},
        ]
        a_rings = add_lofted_mesh(bm, apron_sec, radial=16, mat_idx=1)
        for idx_r, ring in enumerate(a_rings):
            bname = f"{b_prefix}.0" if idx_r <= 1 else f"{b_prefix}.1"
            for v in ring:
                assign_w(v, {bname: 1.0})
                # Gold hem on bottom ring
                if idx_r >= 2:
                    for f in v.link_faces:
                        if f.calc_center_median().z < 0.50:
                            f.material_index = 3

    # 6. Shapely Legs (Thighs + Thigh-high White Tabi + Red Band + Sandals)
    for side, s in (("L", 1), ("R", -1)):
        leg_sec = [
            {"z": 0.90, "rx": 0.088, "ry": 0.092, "x": s * 0.094, "y": 0.004},  # Upper thigh
            {"z": 0.72, "rx": 0.082, "ry": 0.084, "x": s * 0.098, "y": 0.000},  # Mid thigh
            {"z": 0.54, "rx": 0.060, "ry": 0.062, "x": s * 0.100, "y": -0.006}, # Above knee
            {"z": 0.47, "rx": 0.052, "ry": 0.055, "x": s * 0.100, "y": -0.008}, # Knee
            {"z": 0.34, "rx": 0.058, "ry": 0.062, "x": s * 0.098, "y": 0.008},  # Sculpted calf
            {"z": 0.18, "rx": 0.042, "ry": 0.045, "x": s * 0.096, "y": 0.008},  # Lower shin
            {"z": 0.08, "rx": 0.036, "ry": 0.040, "x": s * 0.095, "y": 0.006},  # Ankle
        ]
        leg_rings = add_lofted_mesh(bm, leg_sec, radial=24, mat_idx=0)
        for idx_r, ring in enumerate(leg_rings):
            z = leg_sec[idx_r]["z"]
            for v in ring:
                if z > 0.52:
                    assign_w(v, {f"Thigh.{side}": 1.0})
                elif z > 0.44:
                    assign_w(v, {f"Thigh.{side}": 0.5, f"Shin.{side}": 0.5})
                else:
                    assign_w(v, {f"Shin.{side}": 1.0})

        # Paint thigh-high white tabi socks + crimson garter band
        for ring in leg_rings:
            for v in ring:
                for f in v.link_faces:
                    cz = f.calc_center_median().z
                    if 0.62 <= cz <= 0.66:
                        f.material_index = 1  # Red top garter band
                    elif cz < 0.62:
                        f.material_index = 2  # Crisp white tabi stocking

        # Foot / Shinobi Sandal
        foot_sec = [
            {"z": 0.08, "rx": 0.038, "ry": 0.046, "x": s * 0.095, "y": 0.005},
            {"z": 0.03, "rx": 0.044, "ry": 0.088, "x": s * 0.095, "y": -0.038},
            {"z": 0.00, "rx": 0.046, "ry": 0.094, "x": s * 0.095, "y": -0.042},
        ]
        foot_rings = add_lofted_mesh(bm, foot_sec, radial=18, mat_idx=1)
        for ring in foot_rings:
            for v in ring:
                assign_w(v, {f"Foot.{side}": 1.0})

    # 7. Graceful Arms + Red Fingerless Forearm Guards + Hands
    for side, s in (("L", 1), ("R", -1)):
        # Build arm along bone path (Shoulder -> Elbow -> Wrist -> Hand)
        p0 = Vector((s * 0.15, 0.01, 1.36))
        p1 = Vector((s * 0.34, 0.02, 1.18))
        p2 = Vector((s * 0.48, -0.02, 1.00))
        p3 = Vector((s * 0.54, -0.04, 0.93))

        pts = [
            (p0, 0.052, f"UpperArm.{side}", 0),
            (p0.lerp(p1, 0.5), 0.045, f"UpperArm.{side}", 0),
            (p1, 0.038, f"Forearm.{side}", 0),
            (p1.lerp(p2, 0.38), 0.041, f"Forearm.{side}", 2),  # white cuff trim
            (p1.lerp(p2, 0.52), 0.040, f"Forearm.{side}", 1),  # crimson forearm guard
            (p2, 0.031, f"Forearm.{side}", 1),
            (p3, 0.026, f"Hand.{side}", 0),
        ]
        arm_rings = []
        radial = 18
        for idx_p, (pt, rad, bname, mat_i) in enumerate(pts):
            # Direction tangent
            if idx_p < len(pts) - 1:
                tang = (pts[idx_p + 1][0] - pt).normalized()
            else:
                tang = (pt - pts[idx_p - 1][0]).normalized()
            up_ref = Vector((0, 0, 1))
            if abs(tang.dot(up_ref)) > 0.95:
                up_ref = Vector((0, 1, 0))
            side_u = tang.cross(up_ref).normalized()
            side_v = tang.cross(side_u).normalized()
            ring = []
            for j in range(radial):
                ang = (j / radial) * math.pi * 2.0
                pos = pt + (side_u * math.cos(ang) + side_v * math.sin(ang)) * rad
                v = bm.verts.new(pos)
                assign_w(v, {bname: 1.0})
                ring.append(v)
            arm_rings.append((ring, mat_i))

        for i in range(len(arm_rings) - 1):
            r0, m0 = arm_rings[i]
            r1, m1 = arm_rings[i + 1]
            for j in range(radial):
                jn = (j + 1) % radial
                f = bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
                f.material_index = m1
                f.smooth = True
        f_cap = bm.faces.new(arm_rings[-1][0])
        f_cap.material_index = 0
        f_cap.smooth = True

    # 8. Kachousen (花蝶扇) Folding Fan attached to Hand.R! (thin 3D slab for double-sided rendering)
    fan_origin = Vector((-0.54, -0.05, 0.92))
    fan_segs = 10
    fan_inner_r = 0.05
    fan_outer_r = 0.28
    fan_front_in, fan_front_out = [], []
    fan_back_in, fan_back_out = [], []
    for i in range(fan_segs + 1):
        t = i / fan_segs
        ang = -0.95 + t * 1.90  # ~110 deg open fan
        dx = -math.sin(ang)
        dz = math.cos(ang)
        v_fi = bm.verts.new(fan_origin + Vector((dx * fan_inner_r, -0.022, dz * fan_inner_r)))
        v_fo = bm.verts.new(fan_origin + Vector((dx * fan_outer_r, -0.042, dz * fan_outer_r)))
        v_bi = bm.verts.new(fan_origin + Vector((dx * fan_inner_r, -0.016, dz * fan_inner_r)))
        v_bo = bm.verts.new(fan_origin + Vector((dx * fan_outer_r, -0.036, dz * fan_outer_r)))
        for fv in (v_fi, v_fo, v_bi, v_bo):
            assign_w(fv, {"Hand.R": 1.0})
        fan_front_in.append((v_fi, t))
        fan_front_out.append((v_fo, t))
        fan_back_in.append((v_bi, t))
        fan_back_out.append((v_bo, t))

    uv_layer = bm.loops.layers.uv.new("UVMap")
    for i in range(fan_segs):
        v0, u0 = fan_front_in[i]
        v1, u1 = fan_front_in[i + 1]
        v2, _ = fan_front_out[i + 1]
        v3, _ = fan_front_out[i]
        f_front = bm.faces.new((v0, v1, v2, v3))
        f_front.material_index = 6
        f_front.smooth = True
        uvs = [(u0, 0.0), (u1, 0.0), (u1, 1.0), (u0, 1.0)]
        for loop, uv in zip(f_front.loops, uvs):
            loop[uv_layer].uv = uv

        b0, _ = fan_back_in[i]
        b1, _ = fan_back_in[i + 1]
        b2, _ = fan_back_out[i + 1]
        b3, _ = fan_back_out[i]
        f_back = bm.faces.new((b3, b2, b1, b0))
        f_back.material_index = 6
        f_back.smooth = True
        for loop, uv in zip(f_back.loops, reversed(uvs)):
            loop[uv_layer].uv = uv

    # 9. Sculpted Anime Head with Procedural Face Texture UV!
    head_center = Vector((0.0, 0.005, 1.575))
    h_u = 28
    h_v = 20
    head_rings = []
    for iv in range(h_v + 1):
        vt = iv / h_v
        phi = vt * math.pi  # 0 top -> pi bottom chin
        sin_p = math.sin(phi)
        cos_p = math.cos(phi)
        ring = []
        for iu in range(h_u):
            ut = iu / h_u
            theta = ut * math.pi * 2.0
            rx = 0.088
            ry = 0.095
            rz = 0.104
            # Taper delicate anime chin at bottom
            if cos_p < 0:
                chin_taper = 1.0 - 0.30 * ((-cos_p) ** 1.4)
                rx *= chin_taper
                ry *= (1.0 - 0.16 * ((-cos_p) ** 1.3))
            x = math.sin(theta) * sin_p * rx
            y = -math.cos(theta) * sin_p * ry  # theta=0 is -Y (face front!)
            z = cos_p * rz
            v = bm.verts.new(head_center + Vector((x, y, z)))
            assign_w(v, {"Head": 1.0})
            ring.append((v, theta, phi))
        head_rings.append(ring)

    for iv in range(h_v):
        r0 = head_rings[iv]
        r1 = head_rings[iv + 1]
        for iu in range(h_u):
            iun = (iu + 1) % h_u
            v00, t0, p0 = r0[iu]
            v01, t1, _ = r0[iun]
            v11, _, p1 = r1[iun]
            v10, _, _ = r1[iu]
            f = bm.faces.new((v00, v10, v11, v01))
            f.smooth = True
            # Front face hemisphere uses MaiFaceTex, back uses skin/hair
            c = f.calc_center_median()
            if c.y < head_center.y - 0.01:
                f.material_index = 5
                for loop in f.loops:
                    co = loop.vert.co - head_center
                    u_face = 0.5 + (co.x / 0.175)
                    v_face = 0.5 + (co.z / 0.205)
                    loop[uv_layer].uv = (max(0.01, min(0.99, u_face)), max(0.01, min(0.99, v_face)))
            else:
                f.material_index = 4

    # 10. Sculpted Hair Crown, Side Bangs, White Hair Ribbon & Iconic High Ponytail!
    # Hair cap & bangs
    hair_cap_sec = [
        {"z": 1.50, "rx": 0.095, "ry": 0.098, "y": 0.018},
        {"z": 1.58, "rx": 0.102, "ry": 0.106, "y": 0.016},
        {"z": 1.66, "rx": 0.096, "ry": 0.102, "y": 0.012},
        {"z": 1.70, "rx": 0.055, "ry": 0.060, "y": 0.010},
    ]
    hcap_rings = add_lofted_mesh(bm, hair_cap_sec, radial=24, mat_idx=4)
    for ring in hcap_rings:
        for v in ring:
            # Push front vertices slightly up/back to reveal anime face
            if v.co.y < -0.055 and v.co.z < 1.62:
                v.co.y = -0.045
                v.co.z += 0.045
            assign_w(v, {"Head": 1.0})

    # Side framing locks
    for s in (-1, 1):
        lock_sec = [
            {"z": 1.63, "rx": 0.028, "ry": 0.022, "x": s * 0.088, "y": -0.032},
            {"z": 1.52, "rx": 0.024, "ry": 0.018, "x": s * 0.092, "y": -0.048},
            {"z": 1.40, "rx": 0.014, "ry": 0.012, "x": s * 0.085, "y": -0.052},
            {"z": 1.34, "rx": 0.004, "ry": 0.004, "x": s * 0.078, "y": -0.048},
        ]
        l_rings = add_lofted_mesh(bm, lock_sec, radial=10, mat_idx=4)
        for ring in l_rings:
            for v in ring:
                assign_w(v, {"Head": 1.0})

    # White Hair Ribbon / Ornament at ponytail root
    rib_sec = [
        {"z": 1.60, "rx": 0.046, "ry": 0.022, "y": 0.105},
        {"z": 1.65, "rx": 0.056, "ry": 0.026, "y": 0.112},
        {"z": 1.69, "rx": 0.038, "ry": 0.020, "y": 0.106},
    ]
    rib_rings = add_lofted_mesh(bm, rib_sec, radial=14, mat_idx=2)
    for ring in rib_rings:
        for v in ring:
            assign_w(v, {"Head": 1.0})

    # Iconic Massive High Ponytail (rigged to Ponytail.0..3)
    pony_sec = [
        {"z": 1.62, "rx": 0.036, "ry": 0.036, "y": 0.11},
        {"z": 1.54, "rx": 0.064, "ry": 0.058, "y": 0.21},
        {"z": 1.36, "rx": 0.074, "ry": 0.064, "y": 0.26},
        {"z": 1.18, "rx": 0.056, "ry": 0.048, "y": 0.24},
        {"z": 1.00, "rx": 0.022, "ry": 0.020, "y": 0.21},
    ]
    pony_rings = add_lofted_mesh(bm, pony_sec, radial=18, mat_idx=4)
    pony_bones = ["Head", "Ponytail.0", "Ponytail.1", "Ponytail.2", "Ponytail.3"]
    for idx_r, ring in enumerate(pony_rings):
        bname = pony_bones[idx_r]
        for v in ring:
            assign_w(v, {bname: 1.0})

    # Finalize bmesh -> Mesh & preserve vertex index order for weights
    bm.verts.ensure_lookup_table()
    vert_weight_list = [explicit_weights.get(v, {"Chest": 1.0}) for v in bm.verts]
    bm.to_mesh(mesh)
    bm.free()

    # Create vertex groups matching armature bones
    vgroups = {}
    for b in arm_obj.data.bones:
        vgroups[b.name] = obj.vertex_groups.new(name=b.name)

    for v_idx, wmap in enumerate(vert_weight_list):
        total = sum(wmap.values())
        if total <= 0:
            continue
        for bname, w in wmap.items():
            if bname in vgroups and w > 0.0001:
                vgroups[bname].add([v_idx], w / total, "REPLACE")

    # Parent mesh to armature with Armature modifier
    obj.parent = arm_obj
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj

    return obj


def build_animations(arm_obj):
    """
    Create baked skeletal Action clips for Godot AnimationPlayer:
    Idle_KOF, Jump_Start, Jump_Air, Jump_Land, Run_Jog, Fan_Spin, Ryuuenbu, Victory_Cheer, Hip_Sway
    """
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    def reset_pose():
        for b in pb:
            b.rotation_mode = "XYZ"
            b.location = (0.0, 0.0, 0.0)
            b.rotation_euler = (0.0, 0.0, 0.0)
            b.scale = (1.0, 1.0, 1.0)

    def key_all(frame, bone_names=None):
        targets = [pb[n] for n in bone_names] if bone_names else list(pb)
        for b in targets:
            b.keyframe_insert(data_path="location", frame=frame)
            b.keyframe_insert(data_path="rotation_euler", frame=frame)

    def set_rot(name, rx_deg, ry_deg, rz_deg):
        if name in pb:
            pb[name].rotation_euler = (math.radians(rx_deg), math.radians(ry_deg), math.radians(rz_deg))

    def set_loc(name, x, y, z):
        if name in pb:
            pb[name].location = (x, y, z)

    def make_action(name, frame_end, key_fn):
        act = bpy.data.actions.new(name=name)
        arm_obj.animation_data_create()
        arm_obj.animation_data.action = act
        reset_pose()
        key_fn(frame_end)
        # Push to NLA track so glTF exporter exports ALL animations!
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, act)
        strip.action_frame_start = 1
        strip.action_frame_end = frame_end
        arm_obj.animation_data.action = None

    # 1. Idle_KOF (Iconic KOF Mai rhythmic fighting-stance bounce!)
    def anim_idle(end_f):
        for f in range(1, end_f + 1, 3):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            bounce = math.sin(t * 2.0)
            sway = math.sin(t)
            reset_pose()
            set_loc("Hips", 0.0, 0.0, -0.045 + bounce * 0.036)
            set_rot("Hips", 4 + bounce * 3, sway * 5, 14 + sway * 4)
            set_rot("Spine", 4 - bounce * 4, -sway * 4, -8)
            set_rot("Chest", -6 + bounce * 5, -sway * 3, -6)
            set_rot("Head", 4 - bounce * 3, 0, -4)
            # Fighting stance legs
            set_rot("Thigh.L", 22 - bounce * 10, 0, -10)
            set_rot("Shin.L", -38 + bounce * 18, 0, 0)
            set_rot("Thigh.R", -12 - bounce * 8, 0, 12)
            set_rot("Shin.R", -22 + bounce * 14, 0, 0)
            # Arms poised with Kachousen fan
            set_rot("UpperArm.L", 24 + bounce * 6, 15, -36)
            set_rot("Forearm.L", 58, 0, -24)
            set_rot("UpperArm.R", 42 - bounce * 8, -22, 34)
            set_rot("Forearm.R", 68 + bounce * 8, 0, 28)
            key_all(f)

    # 2. Jump_Start (Anticipation crouch -> explosive launch)
    def anim_jump_start(end_f):
        # Frame 1: crouch
        reset_pose()
        set_loc("Hips", 0, 0, -0.18)
        set_rot("Spine", 22, 0, 0)
        set_rot("Chest", 14, 0, 0)
        set_rot("Thigh.L", 48, 0, -8)
        set_rot("Shin.L", -78, 0, 0)
        set_rot("Thigh.R", 44, 0, 8)
        set_rot("Shin.R", -74, 0, 0)
        set_rot("UpperArm.L", -24, 0, -25)
        set_rot("UpperArm.R", -24, 0, 25)
        key_all(1)
        # Frame end: full launch extension
        reset_pose()
        set_loc("Hips", 0, 0, 0.08)
        set_rot("Spine", -12, 0, 0)
        set_rot("Chest", -10, 0, 0)
        set_rot("Thigh.L", -14, 0, -4)
        set_rot("Shin.L", -8, 0, 0)
        set_rot("Thigh.R", -14, 0, 4)
        set_rot("Shin.R", -8, 0, 0)
        set_rot("UpperArm.L", 65, 0, -48)
        set_rot("UpperArm.R", 85, 0, 48)
        key_all(end_f)

    # 3. Jump_Air (Graceful kunoichi mid-air pose)
    def anim_jump_air(end_f):
        for f in (1, end_f // 2, end_f):
            p = math.sin(((f - 1) / (end_f - 1)) * math.pi)
            reset_pose()
            set_loc("Hips", 0, 0, 0.04)
            set_rot("Spine", -6 + p * 6, 0, 6)
            set_rot("Chest", -8, 0, -6)
            set_rot("Thigh.L", 55 + p * 10, 0, -12)
            set_rot("Shin.L", -88, 0, 0)
            set_rot("Thigh.R", -18, 0, 12)
            set_rot("Shin.R", -32, 0, 0)
            set_rot("UpperArm.L", 52, 0, -58)
            set_rot("Forearm.L", 30, 0, -15)
            set_rot("UpperArm.R", 75, 0, 52)
            set_rot("Forearm.R", 35, 0, 18)
            key_all(f)

    # 4. Jump_Land (Heavy cushioned landing impact -> huge jiggle!)
    def anim_jump_land(end_f):
        # Frame 1: impact down
        reset_pose()
        set_loc("Hips", 0, 0, -0.22)
        set_rot("Spine", 24, 0, 0)
        set_rot("Chest", 18, 0, 0)
        set_rot("Thigh.L", 58, 0, -12)
        set_rot("Shin.L", -92, 0, 0)
        set_rot("Thigh.R", 54, 0, 12)
        set_rot("Shin.R", -88, 0, 0)
        set_rot("UpperArm.L", 12, 0, -54)
        set_rot("UpperArm.R", 18, 0, 54)
        key_all(1)
        # Frame mid: spring rebound up
        reset_pose()
        set_loc("Hips", 0, 0, 0.03)
        set_rot("Spine", -8, 0, 0)
        set_rot("Chest", -8, 0, 0)
        set_rot("Thigh.L", 12, 0, -8)
        set_rot("Shin.L", -20, 0, 0)
        set_rot("Thigh.R", 12, 0, 8)
        set_rot("Shin.R", -20, 0, 0)
        set_rot("UpperArm.L", 35, 0, -35)
        set_rot("UpperArm.R", 45, 0, 35)
        key_all(end_f // 2 + 1)
        # Frame end: settle
        reset_pose()
        set_loc("Hips", 0, 0, -0.04)
        set_rot("Thigh.L", 18, 0, -8)
        set_rot("Shin.L", -30, 0, 0)
        set_rot("Thigh.R", -10, 0, 8)
        set_rot("Shin.R", -18, 0, 0)
        key_all(end_f)

    # 5. Run_Jog (Bouncy energetic jog cycle)
    def anim_jog(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            bounce = abs(math.sin(t))
            reset_pose()
            set_loc("Hips", 0, 0, -0.07 + bounce * 0.095)
            set_rot("Hips", 10, s * 6, s * 10)
            set_rot("Spine", 8, -s * 5, -s * 12)
            set_rot("Chest", 4, -s * 4, -s * 12)
            set_rot("Thigh.L", s * 42 + 8, 0, -4)
            set_rot("Shin.L", -max(0, -c) * 65 - 15, 0, 0)
            set_rot("Thigh.R", -s * 42 + 8, 0, 4)
            set_rot("Shin.R", -max(0, c) * 65 - 15, 0, 0)
            set_rot("UpperArm.L", -s * 45 + 15, 0, -20)
            set_rot("Forearm.L", 68, 0, -10)
            set_rot("UpperArm.R", s * 45 + 15, 0, 20)
            set_rot("Forearm.R", 68, 0, 10)
            key_all(f)

    # 6. Fan_Spin (花蝶扇 · 360° high-speed twirl!)
    def anim_fan_spin(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = u * 360.0
            lift = math.sin(u * math.pi)
            reset_pose()
            set_loc("Hips", 0, 0, -0.04 + lift * 0.14)
            set_rot("Hips", 6 - lift * 12, 0, spin)
            set_rot("Spine", -6 + lift * 8, 0, math.sin(u * math.pi * 2) * 18)
            set_rot("Chest", -10, 0, math.sin(u * math.pi * 2) * 22)
            set_rot("Thigh.L", 18 + lift * 22, 0, -10)
            set_rot("Shin.L", -35 - lift * 35, 0, 0)
            set_rot("Thigh.R", -10, 0, 10)
            set_rot("Shin.R", -18, 0, 0)
            set_rot("UpperArm.L", 35, 0, -68)
            set_rot("UpperArm.R", 85 + lift * 30, 0, 68)
            set_rot("Forearm.R", 25, 0, 20)
            key_all(f)

    # 7. Ryuuenbu (龙炎舞 · Dramatic crouched whip-spin strike!)
    def anim_ryuuenbu(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            # Fast double whip twist + dip + explosive rise
            spin = (u ** 1.25) * 720.0
            dip = math.sin(u * math.pi)
            reset_pose()
            set_loc("Hips", 0, 0, -0.18 * dip + 0.06 * math.sin(u * math.pi * 2))
            set_rot("Hips", 22 * dip, 0, spin)
            set_rot("Spine", 18 * dip, 0, 18 * math.sin(u * math.pi * 2))
            set_rot("Chest", -8 + 14 * dip, 0, 20 * math.sin(u * math.pi * 2))
            set_rot("Thigh.L", 45 * dip + 12, 0, -14)
            set_rot("Shin.L", -70 * dip - 18, 0, 0)
            set_rot("Thigh.R", 35 * dip, 0, 14)
            set_rot("Shin.R", -55 * dip - 15, 0, 0)
            set_rot("UpperArm.L", 15, 0, -78)
            set_rot("UpperArm.R", 65, 0, 78)
            key_all(f)

    # 8. Victory_Cheer (胜利连跳 · Joyful double-hop with arms raised!)
    def anim_cheer(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            hop = abs(math.sin(u * math.pi * 2.0))
            sway = math.sin(u * math.pi * 2.0)
            reset_pose()
            set_loc("Hips", 0, 0, -0.12 + hop * 0.24)
            set_rot("Hips", -8 * hop + 10 * (1 - hop), sway * 8, sway * 8)
            set_rot("Spine", -12 * hop + 8 * (1 - hop), -sway * 6, -sway * 6)
            set_rot("Chest", -10 * hop, -sway * 5, 0)
            set_rot("Thigh.L", 32 * (1 - hop) - 10 * hop, 0, -12)
            set_rot("Shin.L", -56 * (1 - hop) - 24 * hop, 0, 0)
            set_rot("Thigh.R", 32 * (1 - hop) - 10 * hop, 0, 12)
            set_rot("Shin.R", -56 * (1 - hop) - 24 * hop, 0, 0)
            set_rot("UpperArm.L", 125 + hop * 18, 0, -32)
            set_rot("Forearm.L", 22, 0, -12)
            set_rot("UpperArm.R", 132 + hop * 18, 0, 32)
            set_rot("Forearm.R", 22, 0, 12)
            key_all(f)

    # 9. Hip_Sway (魅惑摇摆 · Expressive left-right hip & chest sway)
    def anim_sway(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            reset_pose()
            set_loc("Hips", s * 0.085, 0, -0.05 + abs(c) * 0.03)
            set_rot("Hips", 6, s * 14, s * 12)
            set_rot("Spine", -4, -s * 16, -s * 14)
            set_rot("Chest", -8 + c * 6, -s * 10, -s * 18)
            set_rot("Head", 5, s * 8, s * 10)
            set_rot("Thigh.L", 12 - s * 10, 0, -8 - s * 10)
            set_rot("Shin.L", -20, 0, 0)
            set_rot("Thigh.R", 12 + s * 10, 0, 8 - s * 10)
            set_rot("Shin.R", -20, 0, 0)
            set_rot("UpperArm.L", 18, 0, -42 + s * 14)
            set_rot("Forearm.L", 64, 0, -28)
            set_rot("UpperArm.R", 52, 0, 42 + s * 14)
            set_rot("Forearm.R", 54, 0, 24)
            key_all(f)

    make_action("Idle_KOF", 49, anim_idle)
    make_action("Jump_Start", 13, anim_jump_start)
    make_action("Jump_Air", 25, anim_jump_air)
    make_action("Jump_Land", 19, anim_jump_land)
    make_action("Run_Jog", 25, anim_jog)
    make_action("Fan_Spin", 37, anim_fan_spin)
    make_action("Ryuuenbu", 45, anim_ryuuenbu)
    make_action("Victory_Cheer", 41, anim_cheer)
    make_action("Hip_Sway", 49, anim_sway)

    reset_pose()
    bpy.ops.object.mode_set(mode="OBJECT")


def main():
    argv = sys.argv
    out_path = "mai_shiranui.glb"
    if "--" in argv:
        idx = argv.index("--")
        if idx + 1 < len(argv):
            out_path = argv[idx + 1]

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    clear_scene()
    arm_obj = build_armature()
    build_mai_mesh(arm_obj)
    build_animations(arm_obj)

    bpy.context.scene.render.fps = 30
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
    )
    print(f"[MaiGenerator] Successfully exported rigged & animated 3D Mai Shiranui to: {out_path}")


if __name__ == "__main__":
    main()
