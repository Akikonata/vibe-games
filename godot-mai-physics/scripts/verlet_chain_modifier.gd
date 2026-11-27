class_name VerletChainModifier3D
extends SkeletonModifier3D

## 多节 Verlet 柔体链条骨骼修改器 (用于不知火舞的高马尾、腰带飘带与前后衣摆)
## 算法对标 Unreal KawaiiPhysics / Unity VRM SpringBone

@export var chain_bone_names: PackedStringArray = PackedStringArray()
@export var stiffness: float = 0.14
@export var damping: float = 0.89
@export var gravity_vec: Vector3 = Vector3(0.0, -14.0, 0.0)
@export var wind_strength: float = 0.75
@export var wind_phase: float = 0.0

var _bone_indices: PackedInt32Array = PackedInt32Array()
var _lengths: PackedFloat32Array = PackedFloat32Array()
var _positions: PackedVector3Array = PackedVector3Array()
var _prev_positions: PackedVector3Array = PackedVector3Array()
var _initialized: bool = false
var _elapsed: float = 0.0


func reset_chain() -> void:
	_initialized = false


func _ensure_setup(skel: Skeleton3D) -> bool:
	if _bone_indices.size() >= 2:
		return true
	if chain_bone_names.size() < 2:
		return false

	_bone_indices.clear()
	for bname in chain_bone_names:
		var idx := skel.find_bone(bname)
		if idx < 0:
			return false
		_bone_indices.append(idx)

	_positions.resize(_bone_indices.size())
	_prev_positions.resize(_bone_indices.size())
	_lengths.resize(_bone_indices.size() - 1)
	return true


func _process_modification_with_delta(delta: float) -> void:
	var skel := get_skeleton()
	if skel == null or not _ensure_setup(skel):
		return

	var dt := clampf(delta, 0.0001, 0.033)
	_elapsed += dt
	var skel_xf := skel.global_transform
	var count := _bone_indices.size()

	if not _initialized:
		for i in range(count):
			var wp := (skel_xf * skel.get_bone_global_pose(_bone_indices[i])).origin
			_positions[i] = wp
			_prev_positions[i] = wp
			if i > 0:
				_lengths[i - 1] = maxf(0.03, _positions[i].distance_to(_positions[i - 1]))
		_initialized = true
		return

	# 锚定根骨骼世界坐标
	var root_wp := (skel_xf * skel.get_bone_global_pose(_bone_indices[0])).origin
	_positions[0] = root_wp
	_prev_positions[0] = root_wp

	var wind := Vector3(
		sin(_elapsed * 2.4 + wind_phase) * wind_strength,
		0.0,
		cos(_elapsed * 1.8 + wind_phase) * wind_strength * 0.65
	)

	# 1. Verlet 积分 + 向动画默认姿态的微弱回拉
	for i in range(1, count):
		var pos := _positions[i]
		var prev := _prev_positions[i]
		var vel := (pos - prev) * damping
		_prev_positions[i] = pos

		var anim_wp := (skel_xf * skel.get_bone_global_pose(_bone_indices[i])).origin
		pos += vel + (gravity_vec + wind) * (dt * dt)
		pos = pos.lerp(anim_wp, stiffness)
		_positions[i] = pos

	# 2. 长度约束迭代
	for _iter in range(3):
		for i in range(1, count):
			var p0 := _positions[i - 1]
			var p1 := _positions[i]
			var diff := p1 - p0
			var d := diff.length()
			if d > 0.0001:
				_positions[i] = p0 + (diff / d) * _lengths[i - 1]

	# 3. 写回每节骨骼的全局旋转以指向下一节模拟位置
	var skel_inv := skel_xf.affine_inverse()
	for i in range(count - 1):
		var idx := _bone_indices[i]
		var bone_pose := skel.get_bone_global_pose(idx)
		var next_pose := skel.get_bone_global_pose(_bone_indices[i + 1])

		var orig_dir := (next_pose.origin - bone_pose.origin).normalized()
		var target_local_p0 := skel_inv * _positions[i]
		var target_local_p1 := skel_inv * _positions[i + 1]
		var new_dir := (target_local_p1 - target_local_p0).normalized()

		if orig_dir.length_squared() > 0.0001 and new_dir.length_squared() > 0.0001:
			var rot_q := Quaternion(orig_dir, new_dir)
			bone_pose.origin = target_local_p0
			bone_pose.basis = Basis(rot_q) * bone_pose.basis
			skel.set_bone_global_pose(idx, bone_pose)
