class_name BreastSpringModifier3D
extends SkeletonModifier3D

## 多算法实时乳摇物理核心引擎 (Godot 4 SkeletonModifier3D + GPU Vertex Shader 协同)
##
## 支持 3 种专业算法一键切换对比:
##   0 = 骨骼弹簧阻尼 (Spring Bone / KawaiiPhysics)
##   1 = 质心权重场 GPU 顶点柔体 (CoM Vertex Weight Field + Duffing 非线性刚度 + 泊松膨胀 + 相位波纹)
##   2 = 混合 5 质点柔体笼 (DOA Hybrid Multi-Node Spring Cage: 骨骼 + 5点剪切笼 + GPU 逐顶点涟漪)

enum AlgoMode {
	SPRING_BONE = 0,
	COM_VERTEX_SHADER = 1,
	HYBRID_SPRING_CAGE = 2,
}

const PRESETS := {
	"kof": {
		"label": "KOF 街机经典",
		"stiffness": 155.0,
		"damping": 5.8,
		"mass": 1.05,
		"gravity_sag": 0.016,
		"squash_strength": 0.85,
		"coupling": 0.16,
		"inertia_scale": 1.48,
		"max_disp": 0.060,
		"nonlinear_k3": 14000.0,
	},
	"doa": {
		"label": "DOA 柔体引擎",
		"stiffness": 114.0,
		"damping": 4.2,
		"mass": 1.30,
		"gravity_sag": 0.024,
		"squash_strength": 1.15,
		"coupling": 0.24,
		"inertia_scale": 1.78,
		"max_disp": 0.072,
		"nonlinear_k3": 18000.0,
	},
	"realistic": {
		"label": "写实自然",
		"stiffness": 225.0,
		"damping": 11.2,
		"mass": 0.92,
		"gravity_sag": 0.012,
		"squash_strength": 0.50,
		"coupling": 0.10,
		"inertia_scale": 1.02,
		"max_disp": 0.040,
		"nonlinear_k3": 28000.0,
	},
	"jelly": {
		"label": "超弹果冻",
		"stiffness": 88.0,
		"damping": 2.2,
		"mass": 1.45,
		"gravity_sag": 0.028,
		"squash_strength": 1.38,
		"coupling": 0.28,
		"inertia_scale": 2.02,
		"max_disp": 0.082,
		"nonlinear_k3": 9500.0,
	},
	"firm": {
		"label": "紧身束缚",
		"stiffness": 340.0,
		"damping": 16.5,
		"mass": 0.80,
		"gravity_sag": 0.005,
		"squash_strength": 0.28,
		"coupling": 0.06,
		"inertia_scale": 0.65,
		"max_disp": 0.024,
		"nonlinear_k3": 42000.0,
	},
}

@export var chest_bone_name: String = "Spine02"
@export var left_breast_bone_name: String = "Breast.L"
@export var right_breast_bone_name: String = "Breast.R"

@export var algo_mode: int = AlgoMode.HYBRID_SPRING_CAGE
@export var stiffness: float = 155.0
@export var damping: float = 5.8
@export var mass: float = 1.05
@export var gravity_sag: float = 0.016
@export var squash_strength: float = 0.85
@export var coupling: float = 0.16
@export var inertia_scale: float = 1.48
@export var max_disp: float = 0.060
@export var nonlinear_k3: float = 14000.0  # Duffing 库珀韧带非线性硬化系数

var shader_materials: Array[ShaderMaterial] = []

var _chest_idx: int = -1
var _left_idx: int = -1
var _right_idx: int = -1
var _bones_resolved: bool = false

var _initialized: bool = false
var _prev_chest_pos: Vector3 = Vector3.ZERO
var _prev_chest_vel: Vector3 = Vector3.ZERO
var _prev_chest_quat: Quaternion = Quaternion.IDENTITY
var _prev_ang_vel: Vector3 = Vector3.ZERO
var _ripple_phase: float = 0.0

# 主质心状态 (位于 Chest 局部坐标系)
var left_disp: Vector3 = Vector3.ZERO
var left_vel: Vector3 = Vector3.ZERO
var right_disp: Vector3 = Vector3.ZERO
var right_vel: Vector3 = Vector3.ZERO

# 5 质点柔体笼的次级剪切模 (记录外圈相对质心的滞后剪切运动，用于 DOA Hybrid 模式)
var _cage_shear_l: Vector2 = Vector2.ZERO
var _cage_shear_vel_l: Vector2 = Vector2.ZERO
var _cage_shear_r: Vector2 = Vector2.ZERO
var _cage_shear_vel_r: Vector2 = Vector2.ZERO

var _left_rest_offset: Vector3 = Vector3(0.082, 0.02, 0.115)
var _right_rest_offset: Vector3 = Vector3(-0.082, 0.02, 0.115)

# 遥测数据
var chest_acc_local: Vector3 = Vector3.ZERO
var chest_world_pos: Vector3 = Vector3.ZERO
var left_world_pos: Vector3 = Vector3.ZERO
var right_world_pos: Vector3 = Vector3.ZERO
var kinetic_energy: float = 0.0


func set_algo_mode(mode: int) -> void:
	algo_mode = clampi(mode, 0, 2)
	for sm in shader_materials:
		sm.set_shader_parameter("algo_mode", algo_mode)


func apply_preset(preset_key: String) -> void:
	if not PRESETS.has(preset_key):
		return
	var p: Dictionary = PRESETS[preset_key]
	stiffness = p["stiffness"]
	damping = p["damping"]
	mass = p["mass"]
	gravity_sag = p["gravity_sag"]
	squash_strength = p["squash_strength"]
	coupling = p["coupling"]
	inertia_scale = p["inertia_scale"]
	max_disp = p["max_disp"]
	nonlinear_k3 = p["nonlinear_k3"]


func reset_state() -> void:
	_initialized = false
	left_disp = Vector3.ZERO
	left_vel = Vector3.ZERO
	right_disp = Vector3.ZERO
	right_vel = Vector3.ZERO
	_cage_shear_l = Vector2.ZERO
	_cage_shear_vel_l = Vector2.ZERO
	_cage_shear_r = Vector2.ZERO
	_cage_shear_vel_r = Vector2.ZERO


func apply_impulse(impulse_local: Vector3, target: String = "both") -> void:
	var inv_m: float = 1.0 / maxf(0.4, mass)
	if target == "both" or target == "left":
		left_vel += impulse_local * inv_m
		_cage_shear_vel_l += Vector2(impulse_local.x, impulse_local.y) * (inv_m * 0.55)
	if target == "both" or target == "right":
		right_vel += impulse_local * inv_m
		_cage_shear_vel_r += Vector2(impulse_local.x, impulse_local.y) * (inv_m * 0.55)


func _resolve_bones(skel: Skeleton3D) -> bool:
	if _bones_resolved and _chest_idx >= 0 and _left_idx >= 0 and _right_idx >= 0:
		return true
	_chest_idx = skel.find_bone(chest_bone_name)
	_left_idx = skel.find_bone(left_breast_bone_name)
	_right_idx = skel.find_bone(right_breast_bone_name)
	if _chest_idx >= 0 and _left_idx >= 0 and _right_idx >= 0:
		_bones_resolved = true
		return true
	return false


func _process_modification_with_delta(delta: float) -> void:
	_step_physics(delta)


func _step_physics(raw_dt: float) -> void:
	var skel := get_skeleton()
	if skel == null or not _resolve_bones(skel):
		return

	var dt := clampf(raw_dt, 0.0001, 0.04)
	_ripple_phase += dt * 18.0

	var chest_global_xf: Transform3D = skel.global_transform * skel.get_bone_global_pose(_chest_idx)
	var cur_pos: Vector3 = chest_global_xf.origin
	var cur_quat: Quaternion = chest_global_xf.basis.orthonormalized().get_rotation_quaternion()
	chest_world_pos = cur_pos

	if not _initialized:
		_prev_chest_pos = cur_pos
		_prev_chest_vel = Vector3.ZERO
		_prev_chest_quat = cur_quat
		_prev_ang_vel = Vector3.ZERO
		_initialized = true
		return

	# 1. 世界线性加速度
	var cur_vel: Vector3 = (cur_pos - _prev_chest_pos) / dt
	var cur_acc: Vector3 = (cur_vel - _prev_chest_vel) / dt
	if cur_acc.length() > 60.0:
		cur_acc = cur_acc.normalized() * 60.0

	# 2. 世界角速度 ω 与角加速度 α
	var delta_q: Quaternion = (cur_quat * _prev_chest_quat.inverse()).normalized()
	if delta_q.w < 0.0:
		delta_q = -delta_q
	var sin_half: float = Vector3(delta_q.x, delta_q.y, delta_q.z).length()
	var ang_vel := Vector3.ZERO
	if sin_half > 0.00001:
		var angle: float = 2.0 * atan2(sin_half, delta_q.w)
		var axis: Vector3 = Vector3(delta_q.x, delta_q.y, delta_q.z) / sin_half
		ang_vel = axis * minf(angle / dt, 30.0)

	var ang_acc: Vector3 = (ang_vel - _prev_ang_vel) / dt
	if ang_acc.length() > 130.0:
		ang_acc = ang_acc.normalized() * 130.0

	# 3. 转换到 Chest 局部坐标系
	var inv_q: Quaternion = cur_quat.inverse()
	var local_acc: Vector3 = inv_q * cur_acc
	var local_ang_vel: Vector3 = inv_q * ang_vel
	var local_ang_acc: Vector3 = inv_q * ang_acc
	var local_grav: Vector3 = inv_q * Vector3(0.0, -1.0, 0.0)

	_prev_chest_pos = cur_pos
	_prev_chest_vel = cur_vel
	_prev_chest_quat = cur_quat
	_prev_ang_vel = ang_vel

	# 4. 固定 240Hz 子步长积分
	var sub_dt := 1.0 / 240.0
	var steps := clampi(int(ceilf(dt / sub_dt)), 1, 14)
	var h := dt / float(steps)

	for _i in range(steps):
		_integrate_side(true, local_acc, local_ang_vel, local_ang_acc, local_grav, h)
		_integrate_side(false, local_acc, local_ang_vel, local_ang_acc, local_grav, h)
		_resolve_cleavage_collision()
		_integrate_cage_shear(h)

	# 5. 根据当前算法模式分发驱动结果:
	#    Mode 0 (Spring Bone): 100% 骨骼驱动, Shader 关闭
	#    Mode 1 (CoM Vertex Shader): 骨骼归位 (仅 20% 辅助), 100% 质心权重场 GPU 逐顶点形变!
	#    Mode 2 (DOA Hybrid Cage): 65% 骨骼大形变 + 55% GPU 质心波纹/泊松膨胀/5点剪切笼!
	if algo_mode == AlgoMode.SPRING_BONE:
		_apply_to_bone(skel, _left_idx, left_disp, left_vel, 1.0)
		_apply_to_bone(skel, _right_idx, right_disp, right_vel, 1.0)
	elif algo_mode == AlgoMode.COM_VERTEX_SHADER:
		_apply_to_bone(skel, _left_idx, left_disp, left_vel, 0.15)
		_apply_to_bone(skel, _right_idx, right_disp, right_vel, 0.15)
	else:
		_apply_to_bone(skel, _left_idx, left_disp, left_vel, 0.65)
		_apply_to_bone(skel, _right_idx, right_disp, right_vel, 0.65)

	# 同步 Uniform 给 GPU Vertex Shader
	var shader_scale := 0.0 if algo_mode == AlgoMode.SPRING_BONE else (1.05 if algo_mode == AlgoMode.COM_VERTEX_SHADER else 0.58)
	var e_l := 0.5 * left_vel.length_squared()
	var e_r := 0.5 * right_vel.length_squared()
	for sm in shader_materials:
		sm.set_shader_parameter("algo_mode", algo_mode)
		sm.set_shader_parameter("disp_left", left_disp * shader_scale)
		sm.set_shader_parameter("disp_right", right_disp * shader_scale)
		sm.set_shader_parameter("vel_left", left_vel * shader_scale)
		sm.set_shader_parameter("vel_right", right_vel * shader_scale)
		sm.set_shader_parameter("squash_strength", squash_strength)
		sm.set_shader_parameter("ripple_phase", _ripple_phase)
		sm.set_shader_parameter("energy_left", e_l)
		sm.set_shader_parameter("energy_right", e_r)
		sm.set_shader_parameter("cage_shear_left", _cage_shear_l)
		sm.set_shader_parameter("cage_shear_right", _cage_shear_r)

	# 6. 更新遥测
	chest_acc_local = local_acc
	left_world_pos = (skel.global_transform * skel.get_bone_global_pose(_left_idx)).origin
	right_world_pos = (skel.global_transform * skel.get_bone_global_pose(_right_idx)).origin
	kinetic_energy = e_l + e_r


func _integrate_side(is_left: bool, local_acc: Vector3, local_ang_vel: Vector3, local_ang_acc: Vector3, local_grav: Vector3, h: float) -> void:
	var disp: Vector3 = left_disp if is_left else right_disp
	var vel: Vector3 = left_vel if is_left else right_vel
	var other_disp: Vector3 = right_disp if is_left else left_disp
	var rest_off: Vector3 = _left_rest_offset if is_left else _right_rest_offset
	var freq_bias: float = 1.028 if is_left else 0.972

	var m: float = maxf(0.35, mass)
	var k: float = stiffness * freq_bias
	var c: float = damping

	# 各向异性刚度
	var kx: float = k * 0.90
	var ky: float = k * 0.74
	var kz: float = k * 1.25

	# 惯性加速度 = 线性惯性 + 切向角加速度 + 离心力
	var r: Vector3 = rest_off + disp
	var tangential: Vector3 = local_ang_acc.cross(r)
	var centrifugal: Vector3 = local_ang_vel.cross(local_ang_vel.cross(r))
	var iscale: float = inertia_scale * 0.022

	var a_inert := Vector3(
		-(local_acc.x + tangential.x * 1.75 + centrifugal.x * 1.05) * iscale,
		-(local_acc.y + tangential.y * 1.50 + centrifugal.y * 1.05) * iscale,
		-(local_acc.z + tangential.z * 1.50 + centrifugal.z * 1.25) * iscale
	)

	var target := Vector3(
		local_grav.x * gravity_sag * 0.95,
		(local_grav.y + 1.0) * gravity_sag * 1.35 - gravity_sag * 0.35,
		local_grav.z * gravity_sag * 1.25
	)

	# Duffing 非线性库珀韧带硬化: F = -k1 * dx - k3 * dx^3 - c * v
	# 小幅晃动极其柔软, 接近拉伸极限时弹性自然变硬不穿模不拉爆!
	var dx: float = disp.x - target.x
	var dy: float = disp.y - target.y
	var dz: float = disp.z - target.z
	var k3: float = nonlinear_k3 if algo_mode >= 1 else 0.0

	var couple_k: float = k * coupling
	var f_x: float = -kx * dx - k3 * (dx * dx * dx) - c * vel.x + couple_k * (other_disp.x - disp.x) * 0.45
	var f_y: float = -ky * dy - k3 * (dy * dy * dy) - c * vel.y + couple_k * (other_disp.y - disp.y) * 0.60
	var f_z: float = -kz * dz - k3 * (dz * dz * dz) - c * vel.z + couple_k * (other_disp.z - disp.z) * 0.40

	var acc := Vector3(f_x / m, f_y / m, f_z / m) + a_inert
	vel += acc * h
	disp += vel * h

	# 胸壁后限反弹
	var min_z: float = -max_disp * 0.36
	if disp.z < min_z:
		disp.z = min_z
		if vel.z < 0.0:
			vel.y += -vel.z * 0.22
			vel.z *= -0.34

	var d_len: float = disp.length()
	if d_len > max_disp:
		var n: Vector3 = disp / d_len
		disp = n * max_disp
		var v_out: float = vel.dot(n)
		if v_out > 0.0:
			vel -= n * (v_out * 1.18)

	if is_left:
		left_disp = disp
		left_vel = vel
	else:
		right_disp = disp
		right_vel = vel


func _integrate_cage_shear(h: float) -> void:
	# 模拟 5 质点柔体笼中外围脂肪相对主质心的二阶滞后剪切波 (更高固有频率、更轻阻尼)
	var k_s := stiffness * 1.45
	var c_s := damping * 0.72
	var target_l := Vector2(left_disp.x, left_disp.y)
	var target_r := Vector2(right_disp.x, right_disp.y)

	var acc_l := -k_s * (_cage_shear_l - target_l) - c_s * _cage_shear_vel_l
	_cage_shear_vel_l += acc_l * h
	_cage_shear_l += _cage_shear_vel_l * h

	var acc_r := -k_s * (_cage_shear_r - target_r) - c_s * _cage_shear_vel_r
	_cage_shear_vel_r += acc_r * h
	_cage_shear_r += _cage_shear_vel_r * h


func _resolve_cleavage_collision() -> void:
	var lx: float = _left_rest_offset.x + left_disp.x
	var rx: float = _right_rest_offset.x + right_disp.x
	var min_sep: float = 0.132
	var sep: float = lx - rx
	if sep < min_sep:
		var overlap: float = (min_sep - sep) * 0.5
		left_disp.x += overlap
		right_disp.x -= overlap
		left_disp.z += overlap * 0.35
		right_disp.z += overlap * 0.35
		if left_vel.x < 0.0:
			left_vel.x *= -0.35
		if right_vel.x > 0.0:
			right_vel.x *= -0.35


func _apply_to_bone(skel: Skeleton3D, bone_idx: int, disp: Vector3, vel: Vector3, weight_scale: float) -> void:
	var rest_xf: Transform3D = skel.get_bone_rest(bone_idx)
	var d := disp * weight_scale
	var v := vel * weight_scale

	skel.set_bone_pose_position(bone_idx, rest_xf.origin + d)

	var pitch: float = clampf(-d.y * 6.0, -0.42, 0.42)
	var yaw: float = clampf(d.x * 6.0, -0.42, 0.42)
	var lag_rot: Quaternion = Quaternion.from_euler(Vector3(pitch, yaw, 0.0))
	skel.set_bone_pose_rotation(bone_idx, rest_xf.basis.get_rotation_quaternion() * lag_rot)

	var stretch_y: float = clampf(1.0 + (v.y * 0.16 - maxf(0.0, -d.z * 3.2)) * squash_strength * weight_scale, 0.82, 1.20)
	var stretch_z: float = clampf(1.0 + d.z * 4.0 * squash_strength * weight_scale, 0.84, 1.18)
	var bulge_x: float = 1.0 / sqrt(stretch_y * stretch_z)
	skel.set_bone_pose_scale(bone_idx, Vector3(bulge_x, stretch_z, stretch_y))
