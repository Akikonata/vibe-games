"""
Transform the high-poly 8,864-poly VRoid anime female body (vrm_base.glb) into an
unmistakable, curvaceous, stylized 3D Mai Shiranui (不知火舞) for Godot 4:
1. Strips the baggy white T-shirt & shorts to reveal the full 8,864-poly sculpted anime body
2. Smoothly sculpts Mai's iconic voluminous teardrop bust + deep cleavage directly on Body
   and paints smooth dual-stage weights onto J_Sec_L/R_Bust1 & Bust2
3. Dresses her real body in Mai's iconic plunging crimson-and-white halter kunoichi bodice,
   bare shoulders/back/sides, red fingerless forearm guards, thigh-high white tabi stockings
   with red garters, sculpted 3D Obi sash + giant back bow + flowing ribbon tails +
   front/back gold-trimmed crimson apron panels + white hair ribbon + Kachousen fan
4. Removes VRM unlit nodes so Godot 4 renders rich 3D anime shading & highlights
5. Bakes 9 smooth KOF fighting-game skeletal animations
"""

import bpy
import bmesh
import math
import sys
from mathutils import Vector


def make_clean_pbr_material(name, rgba, roughness=0.45, metallic=0.0, coat=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.35
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def convert_textured_mat_to_lit_pbr(mat, tint_rgb=None, roughness=0.52):
    """
    Strip VRM MToon/Unlit shader graphs and rebuild a clean Principled BSDF
    keeping the original Image Texture (and optionally tinting its pixels directly
    so glTF exports 100% standard lit PBR with zero unlit washout!).
    """
    if mat is None or not mat.use_nodes:
        return
    nt = mat.node_tree

    # Find existing image texture
    tex_img = None
    for n in nt.nodes:
        if n.type == "TEX_IMAGE" and n.image is not None:
            tex_img = n.image
            break

    # If tint_rgb is provided, bake tint directly into a copy of the image pixels
    if tex_img is not None and tint_rgb is not None:
        new_img = tex_img.copy()
        new_img.name = tex_img.name + "_MaiTint"
        px = list(new_img.pixels)
        tr, tg, tb = tint_rgb
        for i in range(0, len(px), 4):
            lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
            # Keep hair highlights rich & glossy
            lum_boost = min(1.0, lum * 1.15)
            px[i] = min(1.0, lum_boost * tr)
            px[i + 1] = min(1.0, lum_boost * tg)
            px[i + 2] = min(1.0, lum_boost * tb)
        new_img.pixels.foreach_set(px)
        new_img.pack()
        tex_img = new_img

    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25

    if tex_img is not None:
        tex_node = nt.nodes.new("ShaderNodeTexImage")
        tex_node.image = tex_img
        nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        # Preserve alpha cutout on eyelashes/brows/mouth
        if any(k in mat.name for k in ("Eyeline", "Brow", "Mouth", "Highlight", "Hair")):
            nt.links.new(tex_node.outputs["Alpha"], bsdf.inputs["Alpha"])
    elif tint_rgb is not None:
        bsdf.inputs["Base Color"].default_value = (tint_rgb[0], tint_rgb[1], tint_rgb[2], 1.0)

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])


def strip_baggy_clothes_and_sculpt_mai_body(body_obj, arm_obj):
    """
    1. Delete Tops_01_CLOTH and Bottoms_01_CLOTH polygons to expose the real 8,864-poly anime body.
    2. Sculpt Mai's iconic curvaceous, prominent bust directly on the real Body mesh
       and paint smooth dual-stage weights for J_Sec_L/R_Bust1 & Bust2.
    3. Assign Mai Shiranui's iconic plunging crimson-and-white halter kunoichi bodice,
       red forearm guards, and thigh-high white tabi stockings directly onto the body mesh!
    """
    mesh = body_obj.data

    # Create Mai outfit PBR materials and append to Body
    mat_red = make_clean_pbr_material("Mai_Kunoichi_Red", (0.76, 0.04, 0.09, 1.0), roughness=0.36, coat=0.18)
    mat_white = make_clean_pbr_material("Mai_Kunoichi_White", (0.94, 0.91, 0.88, 1.0), roughness=0.46)
    mat_gold = make_clean_pbr_material("Mai_Kunoichi_Gold", (0.92, 0.68, 0.18, 1.0), roughness=0.24, metallic=0.85)

    # Identify material indices to delete (Tops_01_CLOTH, Bottoms_01_CLOTH)
    del_mat_indices = set()
    skin_idx = 0
    shoes_idx = -1
    for i, m in enumerate(mesh.materials):
        if m.name in ("Tops_01_CLOTH", "Bottoms_01_CLOTH"):
            del_mat_indices.add(i)
        elif m.name == "Body_00_SKIN":
            skin_idx = i
        elif m.name == "Shoes_01_CLOTH":
            shoes_idx = i

    # Remove baggy T-shirt & shorts faces using bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    faces_to_del = [f for f in bm.faces if f.material_index in del_mat_indices]
    bmesh.ops.delete(bm, geom=faces_to_del, context="FACES")
    bm.to_mesh(mesh)
    bm.free()

    # Append Mai materials to Body
    idx_red = len(mesh.materials)
    mesh.materials.append(mat_red)
    idx_white = len(mesh.materials)
    mesh.materials.append(mat_white)
    idx_gold = len(mesh.materials)
    mesh.materials.append(mat_gold)

    # Color shoes crimson
    if shoes_idx >= 0:
        convert_textured_mat_to_lit_pbr(mesh.materials[shoes_idx], tint_rgb=(0.74, 0.06, 0.10), roughness=0.42)

    # Sculpt Mai Shiranui's iconic voluptuous bust on the real Body_00_SKIN vertices!
    # Bust bone reference positions in Blender coords (Z-up, -Y forward):
    # J_Sec_L_Bust1 head=(0.054, -0.073, 1.174), Bust2=(0.080, -0.124, 1.180)
    left_apex = Vector((0.064, -0.098, 1.168))
    right_apex = Vector((-0.064, -0.098, 1.168))

    # Prepare vertex groups for smooth dual-stage breast skinning
    vg_l1 = body_obj.vertex_groups.get("J_Sec_L_Bust1")
    vg_l2 = body_obj.vertex_groups.get("J_Sec_L_Bust2")
    vg_r1 = body_obj.vertex_groups.get("J_Sec_R_Bust1")
    vg_r2 = body_obj.vertex_groups.get("J_Sec_R_Bust2")
    vg_chest = body_obj.vertex_groups.get("J_Bip_C_UpperChest")

    sculpted_cnt = 0
    for v in mesh.vertices:
        co = v.co
        # Only sculpt front chest region (-Y < -0.03, Z in [1.04, 1.30], |X| < 0.165)
        if co.y < -0.030 and 1.045 < co.z < 1.295 and abs(co.x) < 0.165:
            is_left = co.x >= 0.0
            apex = left_apex if is_left else right_apex
            dx = (co.x - apex.x) / 0.076
            dz = (co.z - apex.z) / 0.078
            dist2 = dx * dx + dz * dz

            if dist2 < 1.55:
                # Smooth Gaussian bell + teardrop lower fullness
                w = math.exp(-dist2 * 1.65)
                # Deepen cleavage valley right along x = 0
                cleave_mask = 1.0 - math.exp(-((co.x / 0.022) ** 2.0))
                w_eff = w * (0.18 + 0.82 * cleave_mask)

                # Forward projection (-Y), slight lateral rounding, natural teardrop droop
                lower_boost = 1.24 if co.z < apex.z else 0.92
                co.y -= 0.068 * w_eff * lower_boost
                co.x += (1.0 if is_left else -1.0) * 0.015 * w_eff
                co.z -= 0.014 * w_eff * (1.0 if co.z < apex.z else 0.35)
                sculpted_cnt += 1

                # Re-paint smooth dual-stage bust weights so the entire sculpted bust jiggles seamlessly!
                if w_eff > 0.04 and vg_l1 and vg_l2 and vg_r1 and vg_r2 and vg_chest:
                    w_total = min(0.98, w_eff * 1.18)
                    w_tip = max(0.0, (w_total - 0.35) / 0.65) * 0.65
                    w_root = max(0.0, w_total - w_tip)
                    w_chest = max(0.0, 1.0 - w_total)
                    if is_left:
                        vg_l1.add([v.index], w_root, "REPLACE")
                        vg_l2.add([v.index], w_tip, "REPLACE")
                        vg_r1.remove([v.index])
                        vg_r2.remove([v.index])
                    else:
                        vg_r1.add([v.index], w_root, "REPLACE")
                        vg_r2.add([v.index], w_tip, "REPLACE")
                        vg_l1.remove([v.index])
                        vg_l2.remove([v.index])
                    vg_chest.add([v.index], w_chest, "REPLACE")

    # Dress the real 8,864-poly body in Mai Shiranui's iconic Kunoichi Outfit!
    for p in mesh.polygons:
        if p.material_index != skin_idx:
            continue
        c = p.center
        ax = abs(c.x)

        # 1. Thigh-high White Tabi Stockings + Crimson Garter Bands on legs (z < 0.65)
        if c.z < 0.65 and c.z > 0.095:
            if 0.615 <= c.z <= 0.65:
                p.material_index = idx_red  # Crimson top band
            elif 0.605 <= c.z < 0.615:
                p.material_index = idx_gold
            else:
                p.material_index = idx_white  # Crisp white tabi stocking
            continue

        # 2. Crimson Fingerless Forearm Guards + White Cuffs on arms (T-pose arms at |x| > 0.33, z > 1.15)
        if ax > 0.33 and c.z > 1.15:
            if 0.33 < ax < 0.365:
                p.material_index = idx_white
            elif 0.365 <= ax < 0.545:
                p.material_index = idx_red
            continue

        # 3. High-Cut Crimson Kunoichi Leotard Bottom + White Obi Waist (0.76 <= z <= 0.96)
        if 0.76 <= c.z <= 0.965 and ax < 0.22:
            if c.z >= 0.915:
                p.material_index = idx_white  # Obi base wrap
            else:
                # High-cut V leg openings on sides!
                cut_x = 0.055 + (c.z - 0.76) * 0.65
                if ax < cut_x or c.y > 0.03:
                    p.material_index = idx_red
            continue

        # 4. Iconic Plunging Crimson & White Halter Bodice (0.965 < z <= 1.35)
        #    - Deep V-cleavage in front showing generous warm shaded skin
        #    - Bare shoulders, bare sides, bare open back!
        if 0.965 < c.z <= 1.355 and ax < 0.165:
            # Front hemisphere only (open back!)
            if c.y < -0.012:
                # Plunging V-neck inner cleavage cutout: narrow at z=1.06, wider at z=1.28
                v_cut_x = max(0.0, (c.z - 1.07) * 0.30)
                # Outer halter edge: wraps under/around bust, narrows toward neck strap at top
                if c.z < 1.22:
                    outer_x = 0.145
                else:
                    outer_x = max(0.052, 0.145 - (c.z - 1.22) * 0.68)

                if v_cut_x <= ax <= outer_x:
                    # Crisp white lapel trim along the inner V-neck edge
                    if ax < v_cut_x + 0.017:
                        p.material_index = idx_white
                    elif ax < v_cut_x + 0.022:
                        p.material_index = idx_gold
                    else:
                        p.material_index = idx_red
            # Halter collar strap around neck (1.31 <= z <= 1.355)
            elif 1.315 <= c.z <= 1.355 and ax < 0.065:
                p.material_index = idx_white

    mesh.update()
    print(f"[MaiCustomizer] Sculpted {sculpted_cnt} bust vertices & dressed real 8,864-poly body in Mai's kunoichi outfit!")
    return mat_red, mat_white, mat_gold


def add_lofted_accessory(bm, sections, radial=18, mat_idx=0, cap=True):
    rings = []
    for s in sections:
        cx, cy, cz = s.get("x", 0.0), s.get("y", 0.0), s["z"]
        rx, ry = s["rx"], s["ry"]
        ring = []
        for j in range(radial):
            th = (j / radial) * math.pi * 2.0
            ring.append(bm.verts.new((cx + math.cos(th) * rx, cy + math.sin(th) * ry, cz)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(radial):
            jn = (j + 1) % radial
            f = bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            f.material_index = mat_idx
            f.smooth = True
    if cap and rings:
        f0 = bm.faces.new(list(reversed(rings[0])))
        f0.material_index = mat_idx
        f0.smooth = True
        f1 = bm.faces.new(rings[-1])
        f1.material_index = mat_idx
        f1.smooth = True
    return rings


def add_sculpted_mai_bust(bm, wmap, side_sign, center, rx=0.086, rz=0.090, depth_y=0.124, seg_u=32, seg_v=22, mat_skin=3, mat_red=0, mat_white=1, mat_gold=2):
    """
    High-resolution anatomical teardrop breast dome with Mai's plunging crimson-and-white
    halter bodice & smooth dual-stage weights onto J_Sec_L/R_Bust1 & Bust2.
    """
    cx, cy, cz = center
    b1 = "J_Sec_L_Bust1" if side_sign > 0 else "J_Sec_R_Bust1"
    b2 = "J_Sec_L_Bust2" if side_sign > 0 else "J_Sec_R_Bust2"
    rings = []

    for iv in range(seg_v + 1):
        vt = iv / seg_v
        phi = vt * (math.pi * 0.52)
        sp = math.sin(phi)
        cp = math.cos(phi)
        w_tot = min(0.98, (sp * 1.15) ** 1.30)
        w_tip = max(0.0, (w_tot - 0.35) / 0.65) * 0.62
        w_root = max(0.0, w_tot - w_tip)
        w_chest = max(0.0, 1.0 - w_tot)
        bd = {b1: w_root, b2: w_tip, "J_Bip_C_UpperChest": w_chest}

        ring = []
        for iu in range(seg_u):
            th = (iu / seg_u) * math.pi * 2.0
            ct = math.cos(th)
            st = math.sin(th)
            lower_full = (1.0 + 0.22 * ((-st) ** 1.35) * sp) if st < 0 else (1.0 - 0.14 * (st ** 1.4) * (1.0 - 0.4 * sp))
            lat_scale = 1.08 if (ct * side_sign) > 0 else 0.94
            root_flare = 1.0 + 0.16 * ((1.0 - vt) ** 2.2)

            lx = cp * ct * rx * lat_scale * root_flare
            lz = cp * st * rz * lower_full * root_flare
            ly = -sp * depth_y
            lz -= (sp ** 1.65) * 0.022
            lx += side_sign * (sp ** 1.45) * 0.008
            ly += (lx * lx) * 1.20

            v = bm.verts.new((cx + lx, cy + ly, cz + lz))
            wmap[v] = bd
            ring.append((v, ct, st, vt))
        rings.append(ring)

    apex_v = bm.verts.new((cx + side_sign * 0.008, cy - depth_y * 1.01, cz - 0.022))
    wmap[apex_v] = {b1: 0.38, b2: 0.62}

    for iv in range(seg_v):
        r0, r1 = rings[iv], rings[iv + 1]
        for iu in range(seg_u):
            iun = (iu + 1) % seg_u
            v00, ct, st, vt = r0[iu]
            v01 = r0[iun][0]
            v11 = r1[iun][0]
            v10 = r1[iu][0]
            f = bm.faces.new((v00, v10, v11, v01))
            f.smooth = True

            # Plunging V-neck kunoichi bodice: generous shaded cleavage on inner-upper bust,
            # crisp white & gold lapel trim, rich crimson silk wrapping outer/lower bust!
            inner = -ct * side_sign * (1.0 - vt * 0.60)
            upper = st * (1.0 - vt * 0.58)
            metric = inner * 0.95 + upper * 0.72
            if metric > 0.34:
                f.material_index = mat_skin
            elif metric > 0.23:
                f.material_index = mat_white
            elif metric > 0.19:
                f.material_index = mat_gold
            else:
                f.material_index = mat_red

    top_r = rings[-1]
    for iu in range(seg_u):
        iun = (iu + 1) % seg_u
        f = bm.faces.new((top_r[iu][0], apex_v, top_r[iun][0]))
        f.smooth = True
        f.material_index = mat_red


def build_mai_kunoichi_accessories(arm_obj, mat_red, mat_white, mat_gold, mat_skin):
    """
    Build Mai's signature 3D cloth & sculpted bust elements:
    - Seamless ribcage bridge + voluptuous sculpted teardrop breasts (dual-stage Bust1/Bust2!)
    - Sculpted White/Crimson Obi Sash + Giant Iconic Back Bow + 2 Flowing Ribbon Tails
    - Front & Back Gold-Trimmed Crimson Kunoichi Apron Panels (rigged to skirt bones!)
    - White Hair Ribbon Ornament
    """
    acc_mesh = bpy.data.meshes.new("Mai_Accessories_Mesh")
    acc_obj = bpy.data.objects.new("Mai_Kunoichi_Accessories", acc_mesh)
    bpy.context.collection.objects.link(acc_obj)
    acc_obj.data.materials.append(mat_red)    # 0
    acc_obj.data.materials.append(mat_white)  # 1
    acc_obj.data.materials.append(mat_gold)   # 2
    acc_obj.data.materials.append(mat_skin)   # 3

    bm = bmesh.new()
    wmap = {}

    def set_w(ring_list, bone_dict):
        for ring in ring_list:
            for v in ring:
                wmap[v] = bone_dict

    # 0A. Seamless Ribcage / Mid-Torso Bridge (fills VRoid's culled chest band z=1.03..1.26)
    rib_sec = [
        {"z": 1.035, "rx": 0.104, "ry": 0.080, "y": 0.004},
        {"z": 1.110, "rx": 0.114, "ry": 0.086, "y": 0.002},
        {"z": 1.185, "rx": 0.124, "ry": 0.090, "y": 0.002},
        {"z": 1.255, "rx": 0.128, "ry": 0.086, "y": 0.005},
    ]
    rib_rings = add_lofted_accessory(bm, rib_sec, radial=32, mat_idx=3, cap=False)
    for ri, ring in enumerate(rib_rings):
        bd = {"J_Bip_C_Spine": 0.6, "J_Bip_C_Chest": 0.4} if ri == 0 else ({"J_Bip_C_Chest": 0.5, "J_Bip_C_UpperChest": 0.5} if ri == 1 else {"J_Bip_C_UpperChest": 1.0})
        for v in ring:
            wmap[v] = bd
    # Paint crimson front bodice panel on ribcage bridge (leaving back & sides bare skin!)
    for ring in rib_rings:
        for v in ring:
            for f in v.link_faces:
                fc = f.calc_center_median()
                if fc.y < -0.025 and abs(fc.x) < 0.085 and fc.z < 1.16:
                    f.material_index = 0

    # 0B. Voluptuous Sculpted Teardrop Mai Shiranui Breasts (Left & Right, dual-stage Bust1 + Bust2!)
    add_sculpted_mai_bust(bm, wmap, +1, (0.068, -0.056, 1.178), rx=0.088, rz=0.092, depth_y=0.128)
    add_sculpted_mai_bust(bm, wmap, -1, (-0.068, -0.056, 1.178), rx=0.088, rz=0.092, depth_y=0.128)

    # 1. Sculpted 3D Obi Sash Belt around waist (z = 0.89..0.98)
    obi_sec = [
        {"z": 0.895, "rx": 0.145, "ry": 0.112, "y": 0.005},
        {"z": 0.935, "rx": 0.132, "ry": 0.102, "y": 0.002},
        {"z": 0.975, "rx": 0.118, "ry": 0.094, "y": 0.000},
    ]
    obi_r = add_lofted_accessory(bm, obi_sec, radial=28, mat_idx=1, cap=False)
    set_w(obi_r, {"J_Bip_C_Hips": 0.75, "J_Bip_C_Spine": 0.25})

    # 2. Iconic Giant White & Crimson Obi Back Bow
    for s in (-1, 1):
        bow_sec = [
            {"z": 0.93, "rx": 0.025, "ry": 0.022, "x": s * 0.025, "y": 0.115},
            {"z": 0.97, "rx": 0.088, "ry": 0.042, "x": s * 0.125, "y": 0.165},
            {"z": 0.94, "rx": 0.074, "ry": 0.036, "x": s * 0.200, "y": 0.185},
            {"z": 0.92, "rx": 0.015, "ry": 0.012, "x": s * 0.220, "y": 0.190},
        ]
        set_w(add_lofted_accessory(bm, bow_sec, radial=14, mat_idx=1), {"J_Bip_C_Hips": 1.0})

    # Center crimson knot on back bow
    knot_sec = [
        {"z": 0.90, "rx": 0.038, "ry": 0.034, "y": 0.135},
        {"z": 0.95, "rx": 0.042, "ry": 0.038, "y": 0.140},
        {"z": 0.99, "rx": 0.034, "ry": 0.030, "y": 0.132},
    ]
    set_w(add_lofted_accessory(bm, knot_sec, radial=14, mat_idx=0), {"J_Bip_C_Hips": 1.0})

    # 3. Two Long Flowing White Ribbon Tails from back bow (rigged to back skirt bones!)
    for side, s, b_top, b_bot in (
        ("L", 1, "J_Sec_L_TopsUpperLegBack", "J_Sec_L_TopsUpperLegBack_end"),
        ("R", -1, "J_Sec_R_TopsUpperLegBack", "J_Sec_R_TopsUpperLegBack_end"),
    ):
        tail_sec = [
            {"z": 0.92, "rx": 0.036, "ry": 0.008, "x": s * 0.045, "y": 0.140},
            {"z": 0.72, "rx": 0.048, "ry": 0.008, "x": s * 0.085, "y": 0.175},
            {"z": 0.48, "rx": 0.054, "ry": 0.008, "x": s * 0.105, "y": 0.195},
            {"z": 0.34, "rx": 0.040, "ry": 0.007, "x": s * 0.115, "y": 0.205},
        ]
        t_rings = add_lofted_accessory(bm, tail_sec, radial=10, mat_idx=1)
        for ri, ring in enumerate(t_rings):
            bd = {"J_Bip_C_Hips": 1.0} if ri == 0 else ({b_top: 1.0} if ri == 1 else {b_bot: 1.0})
            for v in ring:
                wmap[v] = bd

    # 4. Front & Back Crimson Kunoichi Apron Panels with Gold Hem!
    for y_sign, b_l, b_r in (
        (-1, "J_Sec_L_TopsUpperLegFront", "J_Sec_R_TopsUpperLegFront"),
        (1, "J_Sec_L_TopsUpperLegBack", "J_Sec_R_TopsUpperLegBack"),
    ):
        ap_sec = [
            {"z": 0.90, "rx": 0.095, "ry": 0.009, "y": y_sign * 0.112},
            {"z": 0.72, "rx": 0.108, "ry": 0.009, "y": y_sign * 0.128},
            {"z": 0.54, "rx": 0.118, "ry": 0.009, "y": y_sign * 0.138},
            {"z": 0.50, "rx": 0.115, "ry": 0.008, "y": y_sign * 0.140},
        ]
        a_rings = add_lofted_accessory(bm, ap_sec, radial=14, mat_idx=0)
        for ri, ring in enumerate(a_rings):
            for v in ring:
                if ri == 0:
                    wmap[v] = {"J_Bip_C_Hips": 1.0}
                else:
                    wmap[v] = {b_l: 0.5, b_r: 0.5}
                if ri >= 2:
                    for f in v.link_faces:
                        if f.calc_center_median().z < 0.55:
                            f.material_index = 2  # Gold hem!

    # 5. Mai's White Hair Ribbon Ornament on top-back of head
    for s in (-1, 1):
        hr_sec = [
            {"z": 1.56, "rx": 0.015, "ry": 0.012, "x": s * 0.015, "y": 0.085},
            {"z": 1.59, "rx": 0.045, "ry": 0.018, "x": s * 0.068, "y": 0.105},
            {"z": 1.57, "rx": 0.012, "ry": 0.010, "x": s * 0.105, "y": 0.112},
        ]
        set_w(add_lofted_accessory(bm, hr_sec, radial=10, mat_idx=1), {"J_Bip_C_Head": 1.0})

    bm.verts.ensure_lookup_table()
    vw_list = [wmap.get(v, {"J_Bip_C_Hips": 1.0}) for v in bm.verts]
    bm.to_mesh(acc_mesh)
    bm.free()

    vgroups = {}
    for b in arm_obj.data.bones:
        vgroups[b.name] = acc_obj.vertex_groups.new(name=b.name)
    for vi, wd in enumerate(vw_list):
        for bn, w in wd.items():
            if bn in vgroups:
                vgroups[bn].add([vi], w, "REPLACE")

    acc_obj.parent = arm_obj
    mod = acc_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj


def generate_fan_image(name="MaiKachousenTex", size=256):
    img = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = [0.0] * (size * size * 4)
    for y in range(size):
        v = y / (size - 1)
        for x in range(size):
            u = x / (size - 1)
            r, g, b = 0.96, 0.91, 0.82
            dx = u - 0.5
            dy = v - 0.52
            if dx * dx + dy * dy < 0.055:
                r, g, b = 0.80, 0.09, 0.14
            if v > 0.88:
                r, g, b = 0.78, 0.08, 0.13
            elif v > 0.84:
                r, g, b = 0.88, 0.66, 0.20
            if abs((u * 11.0) - round(u * 11.0)) < 0.03:
                r *= 0.90
                g *= 0.88
                b *= 0.86
            idx = (y * size + x) * 4
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            pixels[idx + 3] = 1.0
    img.pixels.foreach_set(pixels)
    img.pack()
    return img


def attach_kachousen_fan(arm_obj):
    hand_bone = arm_obj.data.bones.get("J_Bip_R_Hand")
    if hand_bone is None:
        return

    fan_mesh = bpy.data.meshes.new("Mai_Kachousen_Mesh")
    fan_obj = bpy.data.objects.new("Mai_Kachousen_Fan", fan_mesh)
    bpy.context.collection.objects.link(fan_obj)

    mat = bpy.data.materials.new("Mai_Fan_Mat")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.55
    tex_node = nt.nodes.new("ShaderNodeTexImage")
    tex_node.image = generate_fan_image()
    nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
    fan_obj.data.materials.append(mat)

    # Compact, graceful hand-fan extending outward along -X (right hand direction)
    bm = bmesh.new()
    origin = hand_bone.head_local + Vector((-0.055, -0.015, 0.0))
    segs = 10
    r_in = 0.028
    r_out = 0.175
    f_in, f_out, b_in, b_out = [], [], [], []
    for i in range(segs + 1):
        t = i / segs
        ang = -0.82 + t * 1.64
        dx = -math.cos(ang)
        dz = math.sin(ang)
        f_in.append((bm.verts.new(origin + Vector((dx * r_in, -0.003, dz * r_in))), t))
        f_out.append((bm.verts.new(origin + Vector((dx * r_out, -0.003, dz * r_out))), t))
        b_in.append((bm.verts.new(origin + Vector((dx * r_in, 0.003, dz * r_in))), t))
        b_out.append((bm.verts.new(origin + Vector((dx * r_out, 0.003, dz * r_out))), t))

    uv_layer = bm.loops.layers.uv.new("UVMap")
    for i in range(segs):
        v0, u0 = f_in[i]
        v1, u1 = f_in[i + 1]
        v2, _ = f_out[i + 1]
        v3, _ = f_out[i]
        ff = bm.faces.new((v0, v1, v2, v3))
        ff.smooth = True
        uvs = [(u0, 0.0), (u1, 0.0), (u1, 1.0), (u0, 1.0)]
        for lp, uv in zip(ff.loops, uvs):
            lp[uv_layer].uv = uv

        fb = bm.faces.new((b_out[i][0], b_out[i + 1][0], b_in[i + 1][0], b_in[i][0]))
        fb.smooth = True
        for lp, uv in zip(fb.loops, reversed(uvs)):
            lp[uv_layer].uv = uv

    bm.to_mesh(fan_mesh)
    bm.free()

    vg = fan_obj.vertex_groups.new(name="J_Bip_R_Hand")
    vg.add(list(range(len(fan_mesh.vertices))), 1.0, "REPLACE")
    fan_obj.parent = arm_obj
    mod = fan_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj


def bake_kof_animations(arm_obj):
    """Bake 9 smooth KOF Mai Shiranui animations onto VRM humanoid bones."""
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones

    anim_bones = [
        "J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest",
        "J_Bip_C_Neck", "J_Bip_C_Head",
        "J_Bip_L_Shoulder", "J_Bip_L_UpperArm", "J_Bip_L_LowerArm", "J_Bip_L_Hand",
        "J_Bip_R_Shoulder", "J_Bip_R_UpperArm", "J_Bip_R_LowerArm", "J_Bip_R_Hand",
        "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg", "J_Bip_L_Foot",
        "J_Bip_R_UpperLeg", "J_Bip_R_LowerLeg", "J_Bip_R_Foot",
    ]

    def reset_pose():
        for name in anim_bones:
            b = pb.get(name)
            if b:
                b.rotation_mode = "XYZ"
                b.location = (0.0, 0.0, 0.0)
                b.rotation_euler = (0.0, 0.0, 0.0)

    def r(name, rx, ry, rz):
        b = pb.get(name)
        if b:
            b.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))

    def loc(name, x, y, z):
        b = pb.get(name)
        if b:
            b.location = (x, y, z)

    def key(frame):
        for name in anim_bones:
            b = pb.get(name)
            if b:
                b.keyframe_insert(data_path="location", frame=frame)
                b.keyframe_insert(data_path="rotation_euler", frame=frame)

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

    # 1. Idle_KOF (Arms gracefully framed to the sides so chest & cleavage are unobstructed!)
    def clip_idle(end_f):
        for f in range(1, end_f + 1, 3):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            bnc = math.sin(t * 2.0)
            swy = math.sin(t)
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, -0.045 + bnc * 0.038, 0.0)
            r("J_Bip_C_Hips", 4 + bnc * 3, 14 + swy * 5, swy * 3)
            r("J_Bip_C_Spine", 3 - bnc * 3, -6, -swy * 3)
            r("J_Bip_C_UpperChest", -6 + bnc * 5, -8 - swy * 3, 0)
            r("J_Bip_C_Head", 3 - bnc * 3, -4, 0)
            r("J_Bip_L_UpperLeg", -20 + bnc * 10, 0, 7)
            r("J_Bip_L_LowerLeg", 36 - bnc * 16, 0, 0)
            r("J_Bip_L_Foot", -14 + bnc * 6, 0, 0)
            r("J_Bip_R_UpperLeg", 8 + bnc * 8, 0, -9)
            r("J_Bip_R_LowerLeg", 22 - bnc * 12, 0, 0)
            r("J_Bip_R_Foot", -24 + bnc * 4, 0, 0)
            # Open kunoichi guard: arms held slightly out & poised, never blocking bust!
            r("J_Bip_L_UpperArm", 6, -12, -52 + bnc * 5)
            r("J_Bip_L_LowerArm", 0, -42, -8)
            r("J_Bip_R_UpperArm", 8, 10, 44 - bnc * 6)
            r("J_Bip_R_LowerArm", 0, 36 + bnc * 6, 10)
            key(f)

    # 2. Jump_Start
    def clip_jump_start(end_f):
        reset_pose()
        loc("J_Bip_C_Hips", 0.0, -0.17, 0.0)
        r("J_Bip_C_Spine", 18, 0, 0)
        r("J_Bip_C_UpperChest", 12, 0, 0)
        r("J_Bip_L_UpperLeg", -46, 0, 6)
        r("J_Bip_L_LowerLeg", 78, 0, 0)
        r("J_Bip_R_UpperLeg", -42, 0, -6)
        r("J_Bip_R_LowerLeg", 74, 0, 0)
        r("J_Bip_L_UpperArm", 0, 22, -62)
        r("J_Bip_R_UpperArm", 0, -22, 62)
        key(1)

        reset_pose()
        loc("J_Bip_C_Hips", 0.0, 0.06, 0.0)
        r("J_Bip_C_Spine", -10, 0, 0)
        r("J_Bip_C_UpperChest", -8, 0, 0)
        r("J_Bip_L_UpperLeg", 12, 0, 4)
        r("J_Bip_L_LowerLeg", 10, 0, 0)
        r("J_Bip_R_UpperLeg", 12, 0, -4)
        r("J_Bip_R_LowerLeg", 10, 0, 0)
        r("J_Bip_L_UpperArm", 0, -14, 18)
        r("J_Bip_R_UpperArm", 0, 14, -24)
        key(end_f)

    # 3. Jump_Air
    def clip_jump_air(end_f):
        for f in (1, end_f // 2, end_f):
            p = math.sin(((f - 1) / (end_f - 1)) * math.pi)
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, 0.03, 0.0)
            r("J_Bip_C_Spine", -6 + p * 5, 6, 0)
            r("J_Bip_C_UpperChest", -8, -6, 0)
            r("J_Bip_L_UpperLeg", -52 - p * 8, 0, 8)
            r("J_Bip_L_LowerLeg", 88, 0, 0)
            r("J_Bip_R_UpperLeg", 16, 0, -8)
            r("J_Bip_R_LowerLeg", 30, 0, 0)
            r("J_Bip_L_UpperArm", 0, -14, -18)
            r("J_Bip_L_LowerArm", 0, -28, 0)
            r("J_Bip_R_UpperArm", 0, 14, -14)
            r("J_Bip_R_LowerArm", 0, 28, 0)
            key(f)

    # 4. Jump_Land
    def clip_jump_land(end_f):
        reset_pose()
        loc("J_Bip_C_Hips", 0.0, -0.20, 0.0)
        r("J_Bip_C_Spine", 22, 0, 0)
        r("J_Bip_C_UpperChest", 14, 0, 0)
        r("J_Bip_L_UpperLeg", -54, 0, 10)
        r("J_Bip_L_LowerLeg", 92, 0, 0)
        r("J_Bip_L_Foot", -32, 0, 0)
        r("J_Bip_R_UpperLeg", -50, 0, -10)
        r("J_Bip_R_LowerLeg", 88, 0, 0)
        r("J_Bip_R_Foot", -32, 0, 0)
        r("J_Bip_L_UpperArm", 0, -12, -32)
        r("J_Bip_R_UpperArm", 0, 12, 32)
        key(1)

        reset_pose()
        loc("J_Bip_C_Hips", 0.0, 0.03, 0.0)
        r("J_Bip_C_Spine", -8, 0, 0)
        r("J_Bip_C_UpperChest", -6, 0, 0)
        r("J_Bip_L_UpperLeg", -12, 0, 6)
        r("J_Bip_L_LowerLeg", 22, 0, 0)
        r("J_Bip_R_UpperLeg", -12, 0, -6)
        r("J_Bip_R_LowerLeg", 22, 0, 0)
        r("J_Bip_L_UpperArm", 0, -14, -46)
        r("J_Bip_R_UpperArm", 0, 14, 46)
        key(end_f // 2 + 1)

        reset_pose()
        loc("J_Bip_C_Hips", 0.0, -0.04, 0.0)
        r("J_Bip_L_UpperLeg", -18, 0, 6)
        r("J_Bip_L_LowerLeg", 30, 0, 0)
        r("J_Bip_R_UpperLeg", 8, 0, -6)
        r("J_Bip_R_LowerLeg", 18, 0, 0)
        r("J_Bip_L_UpperArm", 0, -12, -52)
        r("J_Bip_L_LowerArm", 0, -40, 0)
        r("J_Bip_R_UpperArm", 0, 10, 44)
        r("J_Bip_R_LowerArm", 0, 36, 0)
        key(end_f)

    # 5. Run_Jog
    def clip_jog(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            bnc = abs(math.sin(t))
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, -0.075 + bnc * 0.095, 0.0)
            r("J_Bip_C_Hips", 10, s * 10, s * 5)
            r("J_Bip_C_Spine", 8, -s * 12, -s * 4)
            r("J_Bip_C_UpperChest", 4, -s * 12, -s * 3)
            r("J_Bip_L_UpperLeg", -s * 40 - 8, 0, 3)
            r("J_Bip_L_LowerLeg", max(0, -c) * 65 + 16, 0, 0)
            r("J_Bip_R_UpperLeg", s * 40 - 8, 0, -3)
            r("J_Bip_R_LowerLeg", max(0, c) * 65 + 16, 0, 0)
            r("J_Bip_L_UpperArm", 0, s * 38 - 8, -56)
            r("J_Bip_L_LowerArm", 0, -58, 0)
            r("J_Bip_R_UpperArm", 0, s * 38 + 8, 56)
            r("J_Bip_R_LowerArm", 0, 58, 0)
            key(f)

    # 6. Fan_Spin
    def clip_fan_spin(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = u * 360.0
            lift = math.sin(u * math.pi)
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, -0.04 + lift * 0.14, 0.0)
            r("J_Bip_C_Hips", 5 - lift * 10, spin, 0)
            r("J_Bip_C_Spine", -6 + lift * 6, math.sin(u * math.pi * 2) * 16, 0)
            r("J_Bip_C_UpperChest", -8, math.sin(u * math.pi * 2) * 20, 0)
            r("J_Bip_L_UpperLeg", -16 - lift * 24, 0, 8)
            r("J_Bip_L_LowerLeg", 32 + lift * 36, 0, 0)
            r("J_Bip_R_UpperLeg", 10, 0, -8)
            r("J_Bip_R_LowerLeg", 16, 0, 0)
            r("J_Bip_L_UpperArm", 0, -16, -18)
            r("J_Bip_R_UpperArm", 0, 16, -16 - lift * 20)
            r("J_Bip_R_LowerArm", 0, 20, 0)
            key(f)

    # 7. Ryuuenbu
    def clip_ryuuenbu(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            spin = (u ** 1.2) * 720.0
            dip = math.sin(u * math.pi)
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, -0.17 * dip + 0.05 * math.sin(u * math.pi * 2), 0.0)
            r("J_Bip_C_Hips", 18 * dip, spin, 0)
            r("J_Bip_C_Spine", 16 * dip, 18 * math.sin(u * math.pi * 2), 0)
            r("J_Bip_C_UpperChest", -8 + 12 * dip, 20 * math.sin(u * math.pi * 2), 0)
            r("J_Bip_L_UpperLeg", -42 * dip - 12, 0, 10)
            r("J_Bip_L_LowerLeg", 68 * dip + 18, 0, 0)
            r("J_Bip_R_UpperLeg", -32 * dip, 0, -10)
            r("J_Bip_R_LowerLeg", 54 * dip + 14, 0, 0)
            r("J_Bip_L_UpperArm", 0, -10, -8)
            r("J_Bip_R_UpperArm", 0, 10, 8)
            key(f)

    # 8. Victory_Cheer
    def clip_cheer(end_f):
        for f in range(1, end_f + 1, 2):
            u = (f - 1) / (end_f - 1)
            hop = abs(math.sin(u * math.pi * 2.0))
            swy = math.sin(u * math.pi * 2.0)
            reset_pose()
            loc("J_Bip_C_Hips", 0.0, -0.11 + hop * 0.24, 0.0)
            r("J_Bip_C_Hips", -6 * hop + 10 * (1 - hop), swy * 8, swy * 6)
            r("J_Bip_C_Spine", -10 * hop + 6 * (1 - hop), -swy * 6, -swy * 5)
            r("J_Bip_C_UpperChest", -8 * hop, 0, -swy * 4)
            r("J_Bip_L_UpperLeg", -30 * (1 - hop) + 8 * hop, 0, 10)
            r("J_Bip_L_LowerLeg", 52 * (1 - hop) + 22 * hop, 0, 0)
            r("J_Bip_R_UpperLeg", -30 * (1 - hop) + 8 * hop, 0, -10)
            r("J_Bip_R_LowerLeg", 52 * (1 - hop) + 22 * hop, 0, 0)
            r("J_Bip_L_UpperArm", 0, -10, 48 + hop * 16)
            r("J_Bip_L_LowerArm", 0, -18, 0)
            r("J_Bip_R_UpperArm", 0, 10, -48 - hop * 16)
            r("J_Bip_R_LowerArm", 0, 18, 0)
            key(f)

    # 9. Hip_Sway
    def clip_sway(end_f):
        for f in range(1, end_f + 1, 2):
            t = ((f - 1) / (end_f - 1)) * math.pi * 2.0
            s = math.sin(t)
            c = math.cos(t)
            reset_pose()
            loc("J_Bip_C_Hips", s * 0.085, -0.05 + abs(c) * 0.03, 0.0)
            r("J_Bip_C_Hips", 5, s * 12, s * 12)
            r("J_Bip_C_Spine", -4, -s * 14, -s * 14)
            r("J_Bip_C_UpperChest", -7 + c * 5, -s * 18, -s * 10)
            r("J_Bip_C_Head", 4, s * 10, s * 8)
            r("J_Bip_L_UpperLeg", -12 + s * 8, 0, 8 - s * 10)
            r("J_Bip_L_LowerLeg", 22, 0, 0)
            r("J_Bip_R_UpperLeg", -12 - s * 8, 0, -8 - s * 10)
            r("J_Bip_R_LowerLeg", 22, 0, 0)
            r("J_Bip_L_UpperArm", 0, -10, -52 + s * 12)
            r("J_Bip_L_LowerArm", 0, -42, 0)
            r("J_Bip_R_UpperArm", 0, 12, 48 + s * 12)
            r("J_Bip_R_LowerArm", 0, 38, 0)
            key(f)

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

    arm_obj = bpy.data.objects.get("Root")
    body_obj = bpy.data.objects.get("Body")
    if arm_obj is None or body_obj is None:
        raise RuntimeError("Expected Root armature and Body mesh in VRM base!")

    # 1. Strip VRM unlit shaders -> real lit PBR across ALL materials!
    for m in list(bpy.data.materials):
        if m.name in ("Hair_00_HAIR", "HairBack_00_HAIR"):
            convert_textured_mat_to_lit_pbr(m, tint_rgb=(0.30, 0.11, 0.06), roughness=0.36)
        elif m.name in ("Body_00_SKIN", "Face_00_SKIN"):
            convert_textured_mat_to_lit_pbr(m, tint_rgb=None, roughness=0.52)
        elif any(k in m.name for k in ("Eye", "Face")):
            convert_textured_mat_to_lit_pbr(m, tint_rgb=None, roughness=0.30)

    # 2. Strip baggy T-shirt/shorts, sculpt Mai's voluptuous bust, paint plunging kunoichi outfit!
    mat_red, mat_white, mat_gold = strip_baggy_clothes_and_sculpt_mai_body(body_obj, arm_obj)

    # 3. Build 3D sculpted Mai bust, Obi sash, giant back bow, ribbon tails, front/back apron panels & hair ribbon!
    mat_skin_match = make_clean_pbr_material("Mai_Skin_Match", (0.98, 0.84, 0.74, 1.0), roughness=0.48)
    build_mai_kunoichi_accessories(arm_obj, mat_red, mat_white, mat_gold, mat_skin_match)

    # 4. Attach compact Kachousen fan
    attach_kachousen_fan(arm_obj)

    # 5. Bake 9 KOF fighting-game animations
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
    )
    print(f"[MaiCustomizer] Exported TRUE Mai Shiranui kunoichi GLB -> {out_path}")


if __name__ == "__main__":
    main()
