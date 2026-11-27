class_name MaiController
extends CharacterBody3D

## 不知火舞角色控制器 (CharacterBody3D)
## 负责真实重力跳跃/二段跳、WASD 移动急停、动作状态机切换与龙炎舞火焰特效

signal action_changed(action_name: String)

const GRAVITY: float = 16.5
const JUMP_VELOCITY: float = 6.4
const DOUBLE_JUMP_VELOCITY: float = 5.6
const MOVE_SPEED: float = 3.2

var anim_player: AnimationPlayer
var skeleton: Skeleton3D
var breast_modifier: BreastSpringModifier3D
var fire_particles: GPUParticles3D
var model_root: Node3D

var current_showcase_action: String = "Idle_KOF"
var _was_on_floor: bool = true
var _jumps_left: int = 2
var _land_timer: float = 0.0
var _action_timer: float = 0.0
var _jog_stop_cycle: float = 0.0
var _is_one_shot_action: bool = false


func setup(p_model_root: Node3D, p_anim: AnimationPlayer, p_skel: Skeleton3D, p_breast_mod: BreastSpringModifier3D, p_fire: GPUParticles3D) -> void:
	model_root = p_model_root
	anim_player = p_anim
	skeleton = p_skel
	breast_modifier = p_breast_mod
	fire_particles = p_fire

	# 设置循环动画模式
	if anim_player:
		for loop_name in ["Idle_KOF", "Run_Jog", "Jump_Air", "Victory_Cheer", "Hip_Sway"]:
			if anim_player.has_animation(loop_name):
				var anim := anim_player.get_animation(loop_name)
				anim.loop_mode = Animation.LOOP_LINEAR
		_play_anim("Idle_KOF", 0.1)


func trigger_jump() -> void:
	if is_on_floor():
		velocity.y = JUMP_VELOCITY
		_jumps_left = 1
		_land_timer = 0.0
		_is_one_shot_action = false
		_play_anim("Jump_Start", 0.06)
		if breast_modifier:
			# 起跳瞬间给一个微弱向下的惯性反冲增强手感
			breast_modifier.apply_impulse(Vector3(0.0, -0.55, 0.12), "both")
		action_changed.emit("自由跳跃 (Jump)")
	elif _jumps_left > 0:
		velocity.y = DOUBLE_JUMP_VELOCITY
		_jumps_left = 0
		_play_anim("Fan_Spin", 0.08)
		if breast_modifier:
			breast_modifier.apply_impulse(Vector3(0.18, -0.65, 0.18), "both")
		if fire_particles:
			fire_particles.emitting = true
		action_changed.emit("二段旋跳 (Double Jump)")


func set_showcase_action(anim_name: String, display_label: String, one_shot: bool = false) -> void:
	current_showcase_action = anim_name
	_is_one_shot_action = one_shot
	_action_timer = 0.0
	_jog_stop_cycle = 0.0
	if is_on_floor():
		_play_anim(anim_name, 0.14)
	if fire_particles:
		fire_particles.emitting = (anim_name == "Ryuuenbu" or anim_name == "Fan_Spin")
	action_changed.emit(display_label)


func _play_anim(anim_name: String, blend: float = 0.12) -> void:
	if anim_player == null:
		return
	if not anim_player.has_animation(anim_name):
		return
	if anim_player.current_animation != anim_name:
		anim_player.play(anim_name, blend)


func _physics_process(delta: float) -> void:
	# 1. 重力与地板检测
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		_jumps_left = 2

	# 2. 键盘 WASD / 方向键自由移动（松手急停可明显触发前后乳摇惯性！）
	var input_vec := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input_vec.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input_vec.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input_vec.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input_vec.y += 1.0

	var is_moving := input_vec.length_squared() > 0.01
	if is_moving:
		input_vec = input_vec.normalized()
		velocity.x = lerpf(velocity.x, input_vec.x * MOVE_SPEED, clampf(delta * 14.0, 0.0, 1.0))
		velocity.z = lerpf(velocity.z, input_vec.y * MOVE_SPEED, clampf(delta * 14.0, 0.0, 1.0))
		# 面向移动方向
		var target_yaw := atan2(velocity.x, velocity.z)
		if model_root:
			model_root.rotation.y = lerp_angle(model_root.rotation.y, target_yaw, clampf(delta * 12.0, 0.0, 1.0))
	else:
		# 急停减速（高减速度产生真实向前惯性）
		velocity.x = move_toward(velocity.x, 0.0, 18.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 18.0 * delta)

	# 限制在道场圆台范围内
	var horiz := Vector2(global_position.x, global_position.z)
	if horiz.length() > 3.2:
		var clamped := horiz.normalized() * 3.2
		global_position.x = clamped.x
		global_position.z = clamped.y

	var pre_land_vy := velocity.y
	move_and_slide()

	# 3. 落地冲击检测 -> 强力触发落地乳摇反弹!
	var now_on_floor := is_on_floor()
	if now_on_floor and not _was_on_floor:
		_land_timer = 0.38
		_play_anim("Jump_Land", 0.04)
		if fire_particles:
			fire_particles.emitting = false
		if breast_modifier:
			var impact := clampf(absf(pre_land_vy) * 0.15, 0.45, 1.35)
			# 落地瞬间胸腔骤停，柔体继续向下并略微向外展开
			breast_modifier.apply_impulse(Vector3(0.08, -impact, 0.14), "left")
			breast_modifier.apply_impulse(Vector3(-0.08, -impact * 0.94, 0.14), "right")
	_was_on_floor = now_on_floor

	# 4. 动作状态机更新
	if not now_on_floor:
		if velocity.y < 1.2 and anim_player and anim_player.current_animation == "Jump_Start":
			_play_anim("Jump_Air", 0.12)
	elif _land_timer > 0.0:
		_land_timer -= delta
		if _land_timer <= 0.0:
			_play_anim(current_showcase_action, 0.16)
	elif is_moving:
		_play_anim("Run_Jog", 0.10)
	else:
		if current_showcase_action == "Run_Jog":
			# 展示“轻跑急停”模式：每 2.2 秒自动急停 0.7 秒观察惯性余震
			_jog_stop_cycle = fmod(_jog_stop_cycle + delta, 2.9)
			if _jog_stop_cycle < 2.1:
				_play_anim("Run_Jog", 0.10)
			else:
				_play_anim("Idle_KOF", 0.06)
		elif _is_one_shot_action and anim_player:
			_action_timer += delta
			var cur_anim := anim_player.get_animation(current_showcase_action) if anim_player.has_animation(current_showcase_action) else null
			var dur := cur_anim.length if cur_anim else 1.2
			if _action_timer >= dur:
				_is_one_shot_action = false
				current_showcase_action = "Idle_KOF"
				_play_anim("Idle_KOF", 0.18)
				if fire_particles:
					fire_particles.emitting = false
				action_changed.emit("KOF 经典待机")
		else:
			_play_anim(current_showcase_action, 0.14)
