extends Node3D

## 不知火舞 3D 乳摇物理引擎主场景 (Godot 4 Forward+)
## 包含：不知火流黄昏道场舞台、三点+绯红轮廓光、轨道相机与镜头预设、
## 点击拨动交互、3D 骨骼与弹簧向量 Debug 可视化、实时物理调参 HUD 与示波器

var mai_controller: MaiController
var breast_mod: BreastSpringModifier3D
var verlet_mods: Array[VerletChainModifier3D] = []

# Orbit Camera
var cam_pivot: Node3D
var camera: Camera3D
var cam_yaw: float = 0.24
var cam_pitch: float = -0.10
var cam_dist: float = 2.65
var cam_target_offset: Vector3 = Vector3(0.0, 1.05, 0.0)
var _desired_yaw: float = 0.24
var _desired_pitch: float = -0.10
var _desired_dist: float = 2.65
var _desired_target_y: float = 1.05
var _is_dragging: bool = false
var _drag_moved: bool = false

# 3D Debug Vector Overlay
var debug_enabled: bool = false
var debug_mesh_inst: MeshInstance3D
var debug_imm: ImmediateMesh

# HUD references
var oscilloscope: PhysicsOscilloscope
var lbl_status: Label
var lbl_telemetry: Label
var sliders: Dictionary = {}
var slider_labels: Dictionary = {}
var preset_buttons: Dictionary = {}
var algo_buttons: Dictionary = {}
var model_buttons: Dictionary = {}
var slowmo_buttons: Dictionary = {}
var _softbody_shader_mats: Array[ShaderMaterial] = []
var _current_model_key: String = "hunyuan"
var _active_model_node: Node3D = null
var _fire_particles: GPUParticles3D = null

# Lighting Studio references
var world_env_res: Environment
var sky_mat_res: ProceduralSkyMaterial
var key_light_node: DirectionalLight3D
var fill_light_node: OmniLight3D
var rim_light_node: SpotLight3D
var gold_rim_node: OmniLight3D
var light_panel: PanelContainer
var light_sliders: Dictionary = {}
var light_slider_labels: Dictionary = {}
var light_preset_buttons: Dictionary = {}

const LIGHT_PRESETS := {
	"studio": {
		"label": "明亮棚拍",
		"exposure": 1.18,
		"ambient": 0.92,
		"key_energy": 1.95,
		"key_yaw": 26.0,
		"fill_energy": 1.35,
		"rim_energy": 1.85,
		"sky_top": Color(0.18, 0.16, 0.24),
		"sky_horizon": Color(0.42, 0.30, 0.34),
		"fog_density": 0.006,
	},
	"daylight": {
		"label": "清透日光",
		"exposure": 1.28,
		"ambient": 1.25,
		"key_energy": 2.35,
		"key_yaw": 35.0,
		"fill_energy": 1.65,
		"rim_energy": 1.20,
		"sky_top": Color(0.32, 0.48, 0.72),
		"sky_horizon": Color(0.75, 0.78, 0.84),
		"fog_density": 0.003,
	},
	"twilight": {
		"label": "黄昏道场",
		"exposure": 1.05,
		"ambient": 0.68,
		"key_energy": 1.55,
		"key_yaw": 28.0,
		"fill_energy": 0.85,
		"rim_energy": 2.20,
		"sky_top": Color(0.10, 0.06, 0.16),
		"sky_horizon": Color(0.45, 0.15, 0.20),
		"fog_density": 0.012,
	},
	"crimson": {
		"label": "绯红舞台",
		"exposure": 1.12,
		"ambient": 0.58,
		"key_energy": 1.65,
		"key_yaw": -24.0,
		"fill_energy": 0.95,
		"rim_energy": 3.20,
		"sky_top": Color(0.12, 0.03, 0.08),
		"sky_horizon": Color(0.50, 0.10, 0.14),
		"fog_density": 0.014,
	},
}

const MODEL_PATHS := {
	"tripo": "res://assets/mai_shiranui.glb",
	"hunyuan": "res://assets/mai_hunyuan_ready.glb",
}


func _ready() -> void:
	_setup_environment()
	_setup_lights()
	_setup_dojo_stage()
	_setup_sakura_particles()
	_setup_camera()
	_setup_debug_overlay()
	_spawn_mai_shiranui()
	_build_hud()


func _setup_environment() -> void:
	world_env_res = Environment.new()
	var sky := Sky.new()
	sky_mat_res = ProceduralSkyMaterial.new()
	sky_mat_res.sky_top_color = Color(0.18, 0.16, 0.24)
	sky_mat_res.sky_horizon_color = Color(0.42, 0.30, 0.34)
	sky_mat_res.ground_bottom_color = Color(0.10, 0.08, 0.10)
	sky_mat_res.ground_horizon_color = Color(0.26, 0.18, 0.20)
	sky_mat_res.sun_angle_max = 22.0
	sky.sky_material = sky_mat_res

	world_env_res.background_mode = Environment.BG_SKY
	world_env_res.sky = sky
	world_env_res.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	world_env_res.ambient_light_energy = 0.92
	world_env_res.tonemap_mode = Environment.TONE_MAPPER_ACES
	world_env_res.tonemap_exposure = 1.18
	world_env_res.glow_enabled = true
	world_env_res.glow_intensity = 0.14
	world_env_res.glow_bloom = 0.02
	world_env_res.fog_enabled = true
	world_env_res.fog_light_color = Color(0.24, 0.16, 0.20)
	world_env_res.fog_density = 0.006

	var world_env := WorldEnvironment.new()
	world_env.environment = world_env_res
	add_child(world_env)


func _setup_lights() -> void:
	# 主暖色关键光 (Key Light - 明亮清晰棚拍主光)
	key_light_node = DirectionalLight3D.new()
	key_light_node.light_color = Color(1.0, 0.97, 0.93)
	key_light_node.light_energy = 1.95
	key_light_node.shadow_enabled = true
	key_light_node.shadow_blur = 2.0
	key_light_node.rotation_degrees = Vector3(-34.0, 26.0, 0.0)
	add_child(key_light_node)

	# 正面柔光美颜补光 (Front Fill Light - 清晰照亮五官与正面曲线)
	fill_light_node = OmniLight3D.new()
	fill_light_node.position = Vector3(-1.4, 1.85, 2.8)
	fill_light_node.light_color = Color(0.95, 0.96, 1.0)
	fill_light_node.light_energy = 1.35
	fill_light_node.omni_range = 12.0
	add_child(fill_light_node)

	# 轮廓背光 (Rim Light)
	rim_light_node = SpotLight3D.new()
	rim_light_node.position = Vector3(1.9, 2.3, -2.5)
	rim_light_node.look_at_from_position(rim_light_node.position, Vector3(0.0, 1.1, 0.0))
	rim_light_node.light_color = Color(1.0, 0.45, 0.38)
	rim_light_node.light_energy = 1.85
	rim_light_node.spot_range = 10.0
	rim_light_node.spot_angle = 48.0
	add_child(rim_light_node)

	# 暖金辅助背光
	gold_rim_node = OmniLight3D.new()
	gold_rim_node.position = Vector3(-1.8, 1.5, -2.2)
	gold_rim_node.light_color = Color(1.0, 0.82, 0.55)
	gold_rim_node.light_energy = 1.05
	gold_rim_node.omni_range = 9.0
	add_child(gold_rim_node)


func _setup_dojo_stage() -> void:
	# 1. 静态物理地板
	var floor_body := StaticBody3D.new()
	var col_shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(16.0, 0.4, 16.0)
	col_shape.shape = box_shape
	col_shape.position = Vector3(0.0, -0.2, 0.0)
	floor_body.add_child(col_shape)
	add_child(floor_body)

	# 2. 不知火流圆形道场木质擂台
	var stage_mesh := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 4.2
	cyl.bottom_radius = 4.45
	cyl.height = 0.24
	cyl.radial_segments = 64
	stage_mesh.mesh = cyl
	stage_mesh.position = Vector3(0.0, -0.12, 0.0)

	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_texture = _create_dojo_floor_texture()
	floor_mat.roughness = 0.34
	floor_mat.metallic = 0.12
	stage_mesh.material_override = floor_mat
	add_child(stage_mesh)

	# 金色擂台外沿环
	var rim_mesh := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 4.16
	torus.outer_radius = 4.26
	torus.rings = 64
	torus.ring_segments = 16
	rim_mesh.mesh = torus
	rim_mesh.position = Vector3(0.0, 0.0, 0.0)
	var gold_mat := StandardMaterial3D.new()
	gold_mat.albedo_color = Color(0.92, 0.68, 0.22)
	gold_mat.metallic = 0.85
	gold_mat.roughness = 0.25
	rim_mesh.material_override = gold_mat
	add_child(rim_mesh)

	# 3. 四角红木灯柱与发光日式纸灯笼
	var wood_mat := StandardMaterial3D.new()
	wood_mat.albedo_color = Color(0.24, 0.08, 0.07)
	wood_mat.roughness = 0.55

	var lantern_mat := StandardMaterial3D.new()
	lantern_mat.albedo_color = Color(1.0, 0.82, 0.58)
	lantern_mat.emission_enabled = true
	lantern_mat.emission = Color(1.0, 0.48, 0.20)
	lantern_mat.emission_energy_multiplier = 2.2

	for i in range(4):
		var ang := deg_to_rad(45.0 + i * 90.0)
		var px := cos(ang) * 3.85
		var pz := sin(ang) * 3.85

		var pillar := MeshInstance3D.new()
		var pcyl := CylinderMesh.new()
		pcyl.top_radius = 0.08
		pcyl.bottom_radius = 0.10
		pcyl.height = 3.2
		pillar.mesh = pcyl
		pillar.material_override = wood_mat
		pillar.position = Vector3(px, 1.6, pz)
		add_child(pillar)

		var lantern := MeshInstance3D.new()
		var lsph := SphereMesh.new()
		lsph.radius = 0.22
		lsph.height = 0.52
		lantern.mesh = lsph
		lantern.material_override = lantern_mat
		lantern.position = Vector3(px * 0.90, 2.75, pz * 0.90)
		add_child(lantern)

		var l_light := OmniLight3D.new()
		l_light.position = lantern.position
		l_light.light_color = Color(1.0, 0.58, 0.28)
		l_light.light_energy = 0.85
		l_light.omni_range = 5.5
		add_child(l_light)


func _create_dojo_floor_texture() -> ImageTexture:
	var sz := 512
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	var half := sz * 0.5
	for y in range(sz):
		for x in range(sz):
			var dx := (x - half) / half
			var dy := (y - half) / half
			var r := sqrt(dx * dx + dy * dy)
			var plank := 0.03 * sin(float(y) * 0.35)
			var col := Color(0.15 + plank, 0.09 + plank * 0.6, 0.11 + plank * 0.7, 1.0)
			col = col.darkened(clampf(r * 0.55, 0.0, 0.6))
			# 绯红法阵外环
			if absf(r - 0.72) < 0.025:
				col = Color(0.76, 0.14, 0.20, 1.0)
			# 金色内环
			elif absf(r - 0.66) < 0.010 or absf(r - 0.35) < 0.010:
				col = Color(0.92, 0.70, 0.25, 1.0)
			img.set_pixel(x, y, col)
	return ImageTexture.create_from_image(img)


func _setup_sakura_particles() -> void:
	var p := GPUParticles3D.new()
	p.amount = 64
	p.lifetime = 6.0
	p.position = Vector3(0.0, 3.2, 0.0)

	var pmat := ParticleProcessMaterial.new()
	pmat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pmat.emission_box_extents = Vector3(4.0, 0.4, 4.0)
	pmat.direction = Vector3(0.3, -1.0, 0.15)
	pmat.spread = 35.0
	pmat.initial_velocity_min = 0.35
	pmat.initial_velocity_max = 0.75
	pmat.gravity = Vector3(0.12, -0.35, 0.08)
	pmat.scale_min = 0.6
	pmat.scale_max = 1.3
	pmat.color = Color(1.0, 0.62, 0.72, 0.85)
	p.process_material = pmat

	var quad := QuadMesh.new()
	quad.size = Vector2(0.06, 0.04)
	var qmat := StandardMaterial3D.new()
	qmat.albedo_color = Color(1.0, 0.65, 0.76)
	qmat.emission_enabled = true
	qmat.emission = Color(1.0, 0.42, 0.55)
	qmat.emission_energy_multiplier = 0.6
	qmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	quad.material = qmat
	p.draw_pass_1 = quad
	add_child(p)


func _setup_camera() -> void:
	cam_pivot = Node3D.new()
	cam_pivot.position = cam_target_offset
	add_child(cam_pivot)

	camera = Camera3D.new()
	camera.fov = 40.0
	camera.near = 0.05
	camera.far = 100.0
	cam_pivot.add_child(camera)
	_update_camera_transform(1.0)


func _setup_debug_overlay() -> void:
	debug_imm = ImmediateMesh.new()
	debug_mesh_inst = MeshInstance3D.new()
	debug_mesh_inst.mesh = debug_imm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.no_depth_test = true
	debug_mesh_inst.material_override = mat
	add_child(debug_mesh_inst)


func _spawn_mai_shiranui() -> void:
	mai_controller = MaiController.new()
	mai_controller.name = "MaiController"
	add_child(mai_controller)

	# 角色碰撞胶囊体
	var cap_node := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.24
	cap.height = 1.66
	cap_node.shape = cap
	cap_node.position = Vector3(0.0, 0.83, 0.0)
	mai_controller.add_child(cap_node)

	# 龙炎舞 / 花蝶扇火焰粒子特效
	_fire_particles = GPUParticles3D.new()
	_fire_particles.amount = 80
	_fire_particles.lifetime = 0.55
	_fire_particles.emitting = false
	_fire_particles.position = Vector3(0.0, 1.05, 0.0)
	var fmat := ParticleProcessMaterial.new()
	fmat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
	fmat.emission_ring_radius = 0.65
	fmat.emission_ring_inner_radius = 0.45
	fmat.emission_ring_height = 0.35
	fmat.direction = Vector3(0.0, 1.0, 0.0)
	fmat.initial_velocity_min = 0.8
	fmat.initial_velocity_max = 2.2
	fmat.orbit_velocity_min = 1.6
	fmat.orbit_velocity_max = 2.8
	fmat.gravity = Vector3(0.0, 1.8, 0.0)
	fmat.color = Color(1.0, 0.38, 0.10, 0.92)
	_fire_particles.process_material = fmat

	var fquad := QuadMesh.new()
	fquad.size = Vector2(0.14, 0.14)
	var fqmat := StandardMaterial3D.new()
	fqmat.albedo_color = Color(1.0, 0.55, 0.16)
	fqmat.emission_enabled = true
	fqmat.emission = Color(1.0, 0.28, 0.06)
	fqmat.emission_energy_multiplier = 3.2
	fqmat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fquad.material = fqmat
	_fire_particles.draw_pass_1 = fquad
	mai_controller.add_child(_fire_particles)
	mai_controller.action_changed.connect(_on_action_changed)

	# 默认加载混元生3D版（也可随时在右侧面板一键切换 Tripo3D 版！）
	_load_character_model(_current_model_key)


func _load_character_model(model_key: String) -> void:
	if not MODEL_PATHS.has(model_key):
		return
	var saved_algo: int = breast_mod.algo_mode if breast_mod else BreastSpringModifier3D.AlgoMode.HYBRID_SPRING_CAGE
	var saved_action: String = mai_controller.current_showcase_action if mai_controller else "Idle_KOF"

	if _active_model_node:
		_active_model_node.queue_free()
		_active_model_node = null
	_softbody_shader_mats.clear()
	verlet_mods.clear()
	breast_mod = null

	var glb_path: String = MODEL_PATHS[model_key]
	var glb_scene: PackedScene = load(glb_path)
	if glb_scene == null:
		push_error("无法加载模型: " + glb_path)
		return

	_current_model_key = model_key
	var mai_model: Node3D = glb_scene.instantiate()
	_active_model_node = mai_model
	mai_controller.add_child(mai_model)
	_enhance_anime_materials(mai_model)

	var anim_player := _find_node_by_type(mai_model, AnimationPlayer) as AnimationPlayer
	var skeleton := _find_node_by_type(mai_model, Skeleton3D) as Skeleton3D

	if skeleton:
		breast_mod = BreastSpringModifier3D.new()
		breast_mod.name = "BreastSpringModifier3D"
		breast_mod.shader_materials = _softbody_shader_mats
		breast_mod.apply_preset("kof")
		breast_mod.set_algo_mode(saved_algo)
		skeleton.add_child(breast_mod)

	mai_controller.setup(mai_model, anim_player, skeleton, breast_mod, _fire_particles)
	mai_controller.current_showcase_action = saved_action
	if anim_player and anim_player.has_animation(saved_action):
		anim_player.play(saved_action, 0.1)
	_sync_sliders_from_modifier()
	for k in model_buttons:
		model_buttons[k].modulate = Color(1.0, 0.72, 0.35) if k == model_key else Color.WHITE


func _enhance_anime_materials(node: Node) -> void:
	var soft_shader: Shader = load("res://shaders/breast_softbody.gdshader")
	if node is MeshInstance3D:
		var mi := node as MeshInstance3D
		if mi.mesh:
			for s_idx in range(mi.mesh.get_surface_count()):
				var orig_mat := mi.mesh.surface_get_material(s_idx)
				if orig_mat is StandardMaterial3D and soft_shader != null:
					var smat := ShaderMaterial.new()
					smat.shader = soft_shader
					var alb_tex: Texture2D = orig_mat.albedo_texture
					var nrm_tex: Texture2D = orig_mat.normal_texture if orig_mat.normal_enabled else null
					var orm_tex: Texture2D = orig_mat.roughness_texture

					# 混元神经绑骨版直接挂载原版 4K 清晰 PNG PBR 贴图（比压缩 JPEG 更锐利且永不丢贴图！）
					if _current_model_key == "hunyuan":
						var hy_alb: Texture2D = load("res://assets/mai_hunyuan_ready_texture_pbr_20250901.png")
						var hy_nrm: Texture2D = load("res://assets/mai_hunyuan_ready_texture_pbr_20250901_normal.png")
						var hy_orm: Texture2D = load("res://assets/mai_hunyuan_ready_texture_pbr_20250901_metallic-texture_pbr_20250901_roughness.png")
						if hy_alb:
							alb_tex = hy_alb
						if hy_nrm:
							nrm_tex = hy_nrm
						if hy_orm:
							orm_tex = hy_orm

					if alb_tex:
						smat.set_shader_parameter("albedo_tex", alb_tex)
					smat.set_shader_parameter("albedo_tint", orig_mat.albedo_color)
					if nrm_tex:
						smat.set_shader_parameter("normal_tex", nrm_tex)
						smat.set_shader_parameter("has_normal_tex", true)
					if orm_tex:
						smat.set_shader_parameter("orm_tex", orm_tex)
						smat.set_shader_parameter("has_orm_tex", true)
					mi.set_surface_override_material(s_idx, smat)
					_softbody_shader_mats.append(smat)
	for child in node.get_children():
		_enhance_anime_materials(child)


func _find_node_by_type(root: Node, target_type) -> Node:
	if is_instance_of(root, target_type):
		return root
	for child in root.get_children():
		var found := _find_node_by_type(child, target_type)
		if found:
			return found
	return null


func _build_hud() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)

	# 顶部信息与镜头控制栏
	var top_bar := PanelContainer.new()
	top_bar.position = Vector2(16, 14)
	top_bar.add_theme_stylebox_override("panel", _make_panel_style(Color(0.09, 0.05, 0.09, 0.84), Color(0.86, 0.22, 0.28, 0.65)))
	canvas.add_child(top_bar)

	var top_hb := HBoxContainer.new()
	top_hb.add_theme_constant_override("separation", 10)
	top_bar.add_child(top_hb)

	var title_lbl := Label.new()
	title_lbl.text = "不知火舞 · Godot 4 柔体物理引擎 DEMO"
	title_lbl.add_theme_font_size_override("font_size", 16)
	title_lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.62))
	top_hb.add_child(title_lbl)

	lbl_status = Label.new()
	lbl_status.text = "| 当前动作: KOF 经典待机"
	lbl_status.add_theme_color_override("font_color", Color(1.0, 0.64, 0.68))
	top_hb.add_child(lbl_status)

	# 镜头预设按钮
	var cam_presets := [
		["全身", 0.24, -0.10, 2.65, 1.00],
		["上半身", 0.16, -0.04, 1.28, 1.24],
		["侧面", 1.38, -0.04, 1.45, 1.22],
		["特写", 0.06, -0.02, 0.86, 1.26],
	]
	for cp in cam_presets:
		var b := _make_btn(cp[0], func():
			_desired_yaw = cp[1]
			_desired_pitch = cp[2]
			_desired_dist = cp[3]
			_desired_target_y = cp[4]
		)
		top_hb.add_child(b)

	# 慢动作按钮
	for sm in [["1.0x", 1.0], ["0.5x", 0.5], ["0.25x", 0.25]]:
		var b := _make_btn(sm[0], func():
			Engine.time_scale = sm[1]
			for k in slowmo_buttons:
				slowmo_buttons[k].modulate = Color(1.0, 0.85, 0.35) if k == sm[0] else Color.WHITE
		)
		slowmo_buttons[sm[0]] = b
		if sm[0] == "1.0x":
			b.modulate = Color(1.0, 0.85, 0.35)
		top_hb.add_child(b)

	var dbg_btn := _make_btn("Debug 向量 (D)", func():
		debug_enabled = not debug_enabled
	)
	top_hb.add_child(dbg_btn)

	var light_btn := _make_btn("灯光棚拍 (L)", func():
		if light_panel:
			light_panel.visible = not light_panel.visible
	)
	light_btn.modulate = Color(1.0, 0.90, 0.52)
	top_hb.add_child(light_btn)

	# 左侧：实时灯光棚拍调节面板 (Lighting Studio)
	light_panel = PanelContainer.new()
	light_panel.position = Vector2(16, 68)
	light_panel.custom_minimum_size = Vector2(268, 0)
	light_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.08, 0.06, 0.10, 0.84), Color(0.95, 0.78, 0.35, 0.55)))
	canvas.add_child(light_panel)

	var lvb := VBoxContainer.new()
	lvb.add_theme_constant_override("separation", 6)
	light_panel.add_child(lvb)

	var ltitle := Label.new()
	ltitle.text = "灯光棚拍调节 (按 L 隐藏/显示)"
	ltitle.add_theme_font_size_override("font_size", 14)
	ltitle.add_theme_color_override("font_color", Color(1.0, 0.88, 0.50))
	lvb.add_child(ltitle)

	var lpgrid := GridContainer.new()
	lpgrid.columns = 2
	lpgrid.add_theme_constant_override("h_separation", 6)
	lpgrid.add_theme_constant_override("v_separation", 6)
	lvb.add_child(lpgrid)
	for lk in ["studio", "daylight", "twilight", "crimson"]:
		var lb := _make_btn(LIGHT_PRESETS[lk]["label"], func(): _apply_light_preset(lk))
		light_preset_buttons[lk] = lb
		lpgrid.add_child(lb)

	var lslider_defs := [
		["exposure", "整体曝光 (Exposure)", 0.5, 2.2, 0.05],
		["key_energy", "主光强度 (Key Light)", 0.0, 4.0, 0.05],
		["key_yaw", "主光角度 (Key Angle)", -180.0, 180.0, 2.0],
		["fill_energy", "正面补光 (Front Fill)", 0.0, 3.0, 0.05],
		["ambient", "环境亮度 (Ambient)", 0.1, 2.2, 0.05],
		["rim_energy", "轮廓背光 (Rim Light)", 0.0, 4.0, 0.05],
	]
	for lsd in lslider_defs:
		var lprop: String = lsd[0]
		var lhb := HBoxContainer.new()
		var lname := Label.new()
		lname.text = lsd[1]
		lname.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lname.add_theme_font_size_override("font_size", 12)
		var lval := Label.new()
		lval.add_theme_font_size_override("font_size", 12)
		lval.add_theme_color_override("font_color", Color(1.0, 0.88, 0.58))
		lhb.add_child(lname)
		lhb.add_child(lval)
		lvb.add_child(lhb)

		var lsl := HSlider.new()
		lsl.min_value = lsd[2]
		lsl.max_value = lsd[3]
		lsl.step = lsd[4]
		lsl.value_changed.connect(func(v: float):
			_set_light_param(lprop, v)
			lval.text = "%.0f°" % v if lprop == "key_yaw" else "%.2f" % v
		)
		light_sliders[lprop] = lsl
		light_slider_labels[lprop] = lval
		lvb.add_child(lsl)

	_apply_light_preset("studio")

	# 右侧：乳摇物理实验室面板 (Physics Lab)
	var right_panel := PanelContainer.new()
	right_panel.anchor_left = 1.0
	right_panel.anchor_right = 1.0
	right_panel.offset_left = -320
	right_panel.offset_right = -16
	right_panel.offset_top = 14
	right_panel.offset_bottom = 640
	right_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.08, 0.05, 0.09, 0.86), Color(0.92, 0.65, 0.25, 0.55)))
	canvas.add_child(right_panel)

	var rvb := VBoxContainer.new()
	rvb.add_theme_constant_override("separation", 7)
	right_panel.add_child(rvb)

	var lab_title := Label.new()
	lab_title.text = "柔体物理实验室 (双引擎模型 + 3算法对比)"
	lab_title.add_theme_font_size_override("font_size", 14)
	lab_title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.45))
	rvb.add_child(lab_title)

	# 模型切换栏 (Tripo3D 版 vs 腾讯混元生3D 版)
	var mdl_hb := HBoxContainer.new()
	mdl_hb.add_theme_constant_override("separation", 6)
	rvb.add_child(mdl_hb)
	for m_def in [
		["hunyuan", "腾讯混元3D版"],
		["tripo", "Tripo3D版"],
	]:
		var mkey: String = m_def[0]
		var mb := _make_btn(m_def[1], func(): _load_character_model(mkey))
		mb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		model_buttons[mkey] = mb
		if mkey == _current_model_key:
			mb.modulate = Color(1.0, 0.72, 0.35)
		mdl_hb.add_child(mb)

	# 核心算法切换栏 (骨骼弹簧 / 质心顶点场 GPU / DOA 混合柔体笼)
	var algo_hb := HBoxContainer.new()
	algo_hb.add_theme_constant_override("separation", 4)
	rvb.add_child(algo_hb)
	for a_def in [
		[0, "骨骼弹簧"],
		[1, "质心顶点场"],
		[2, "DOA混合笼"],
	]:
		var mode_id: int = a_def[0]
		var ab := _make_btn(a_def[1], func():
			if breast_mod:
				breast_mod.set_algo_mode(mode_id)
				for k in algo_buttons:
					algo_buttons[k].modulate = Color(0.45, 0.95, 0.72) if k == mode_id else Color.WHITE
		)
		ab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		algo_buttons[mode_id] = ab
		if mode_id == 2:
			ab.modulate = Color(0.45, 0.95, 0.72)
		algo_hb.add_child(ab)

	# 预设切换网格
	var pgrid := GridContainer.new()
	pgrid.columns = 2
	pgrid.add_theme_constant_override("h_separation", 6)
	pgrid.add_theme_constant_override("v_separation", 6)
	rvb.add_child(pgrid)

	for key in ["kof", "doa", "realistic", "jelly", "firm"]:
		var label_txt: String = BreastSpringModifier3D.PRESETS[key]["label"]
		var pb := _make_btn(label_txt, func(): _select_preset(key))
		preset_buttons[key] = pb
		pgrid.add_child(pb)

	var poke_btn := _make_btn("测试拨动冲击 (P)", func():
		if breast_mod:
			breast_mod.apply_impulse(Vector3(0.45, -0.75, 0.35), "left")
			breast_mod.apply_impulse(Vector3(-0.35, -0.62, 0.28), "right")
	)
	poke_btn.modulate = Color(1.0, 0.72, 0.72)
	pgrid.add_child(poke_btn)

	# 参数滑块
	var slider_defs := [
		["stiffness", "弹簧刚度 (Stiffness)", 50.0, 380.0, 1.0],
		["damping", "阻尼系数 (Damping)", 1.2, 20.0, 0.1],
		["mass", "等效质量 (Mass)", 0.5, 2.0, 0.05],
		["gravity_sag", "重力下垂 (Gravity Sag)", 0.0, 0.04, 0.001],
		["squash_strength", "体积挤压 (Squash)", 0.0, 1.6, 0.05],
		["coupling", "左右耦合 (Coupling)", 0.0, 0.45, 0.02],
		["inertia_scale", "惯性倍率 (Inertia)", 0.4, 2.5, 0.05],
	]
	for sd in slider_defs:
		var prop: String = sd[0]
		var hb := HBoxContainer.new()
		var name_l := Label.new()
		name_l.text = sd[1]
		name_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_l.add_theme_font_size_override("font_size", 12)
		var val_l := Label.new()
		val_l.add_theme_font_size_override("font_size", 12)
		val_l.add_theme_color_override("font_color", Color(1.0, 0.86, 0.55))
		hb.add_child(name_l)
		hb.add_child(val_l)
		rvb.add_child(hb)

		var sl := HSlider.new()
		sl.min_value = sd[2]
		sl.max_value = sd[3]
		sl.step = sd[4]
		sl.value_changed.connect(func(v: float):
			if breast_mod:
				breast_mod.set(prop, v)
				val_l.text = "%.2f" % v if sd[4] < 1.0 else "%.0f" % v
		)
		sliders[prop] = sl
		slider_labels[prop] = val_l
		rvb.add_child(sl)

	# 实时示波器
	var osc_lbl := Label.new()
	osc_lbl.text = "实时 Y 轴位移示波器 (红=左 / 金=右)"
	osc_lbl.add_theme_font_size_override("font_size", 12)
	osc_lbl.add_theme_color_override("font_color", Color(0.85, 0.85, 0.92))
	rvb.add_child(osc_lbl)

	oscilloscope = PhysicsOscilloscope.new()
	rvb.add_child(oscilloscope)

	lbl_telemetry = Label.new()
	lbl_telemetry.add_theme_font_size_override("font_size", 11)
	lbl_telemetry.add_theme_color_override("font_color", Color(0.75, 0.82, 0.88))
	rvb.add_child(lbl_telemetry)

	_sync_sliders_from_modifier()
	_highlight_preset("kof")

	# 底部动作控制栏
	var bot_panel := PanelContainer.new()
	bot_panel.anchor_top = 1.0
	bot_panel.anchor_bottom = 1.0
	bot_panel.offset_left = 16
	bot_panel.offset_right = 1100
	bot_panel.offset_top = -76
	bot_panel.offset_bottom = -14
	bot_panel.add_theme_stylebox_override("panel", _make_panel_style(Color(0.09, 0.05, 0.09, 0.86), Color(0.86, 0.22, 0.28, 0.65)))
	canvas.add_child(bot_panel)

	var bhb := HBoxContainer.new()
	bhb.add_theme_constant_override("separation", 8)
	bot_panel.add_child(bhb)

	var btn_jump := _make_btn("跳跃 / 二段跳 (Space)", func(): mai_controller.trigger_jump())
	btn_jump.modulate = Color(1.0, 0.78, 0.45)
	bhb.add_child(btn_jump)

	var actions := [
		["1 KOF待机", "Idle_KOF", "KOF 经典待机", false],
		["2 轻跑急停", "Run_Jog", "轻跑与急停惯性", false],
		["3 花蝶扇旋舞", "Fan_Spin", "花蝶扇 · 360°旋舞", true],
		["4 龙炎舞", "Ryuuenbu", "必杀 · 龙炎舞", true],
		["5 胜利连跳", "Victory_Cheer", "胜利欢呼连跳", false],
		["6 魅惑摇摆", "Hip_Sway", "魅惑摇摆 (左右异步)", false],
	]
	for act in actions:
		var ab := _make_btn(act[0], func(): mai_controller.set_showcase_action(act[1], act[2], act[3]))
		bhb.add_child(ab)

	var hint_lbl := Label.new()
	hint_lbl.text = "  拖拽旋转镜头 | 滚轮缩放 | WASD移动 | 点击胸部拨动"
	hint_lbl.add_theme_font_size_override("font_size", 12)
	hint_lbl.add_theme_color_override("font_color", Color(0.78, 0.72, 0.76))
	bhb.add_child(hint_lbl)


func _apply_light_preset(key: String) -> void:
	if not LIGHT_PRESETS.has(key):
		return
	var p: Dictionary = LIGHT_PRESETS[key]
	_set_light_param("exposure", p["exposure"])
	_set_light_param("key_energy", p["key_energy"])
	_set_light_param("key_yaw", p["key_yaw"])
	_set_light_param("fill_energy", p["fill_energy"])
	_set_light_param("ambient", p["ambient"])
	_set_light_param("rim_energy", p["rim_energy"])
	if sky_mat_res:
		sky_mat_res.sky_top_color = p["sky_top"]
		sky_mat_res.sky_horizon_color = p["sky_horizon"]
	if world_env_res:
		world_env_res.fog_density = p["fog_density"]
	for lprop in light_sliders:
		var v: float = p[lprop]
		light_sliders[lprop].set_value_no_signal(v)
		light_slider_labels[lprop].text = "%.0f°" % v if lprop == "key_yaw" else "%.2f" % v
	for lk in light_preset_buttons:
		light_preset_buttons[lk].modulate = Color(1.0, 0.85, 0.36) if lk == key else Color.WHITE


func _set_light_param(prop: String, val: float) -> void:
	match prop:
		"exposure":
			if world_env_res:
				world_env_res.tonemap_exposure = val
		"key_energy":
			if key_light_node:
				key_light_node.light_energy = val
		"key_yaw":
			if key_light_node:
				key_light_node.rotation_degrees.y = val
		"fill_energy":
			if fill_light_node:
				fill_light_node.light_energy = val
		"ambient":
			if world_env_res:
				world_env_res.ambient_light_energy = val
		"rim_energy":
			if rim_light_node:
				rim_light_node.light_energy = val
			if gold_rim_node:
				gold_rim_node.light_energy = val * 0.55


func _select_preset(key: String) -> void:
	if breast_mod:
		breast_mod.apply_preset(key)
		_sync_sliders_from_modifier()
		_highlight_preset(key)


func _highlight_preset(active_key: String) -> void:
	for k in preset_buttons:
		preset_buttons[k].modulate = Color(1.0, 0.82, 0.36) if k == active_key else Color.WHITE


func _sync_sliders_from_modifier() -> void:
	if breast_mod == null:
		return
	for prop in sliders:
		var val: float = breast_mod.get(prop)
		sliders[prop].set_value_no_signal(val)
		slider_labels[prop].text = "%.2f" % val if sliders[prop].step < 1.0 else "%.0f" % val


func _make_btn(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _make_panel_style(bg: Color, border: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(1)
	s.set_corner_radius_all(10)
	s.content_margin_left = 12
	s.content_margin_right = 12
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


func _on_action_changed(label_text: String) -> void:
	if lbl_status:
		lbl_status.text = "| 当前动作: " + label_text


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE:
				mai_controller.trigger_jump()
			KEY_1:
				mai_controller.set_showcase_action("Idle_KOF", "KOF 经典待机", false)
			KEY_2:
				mai_controller.set_showcase_action("Run_Jog", "轻跑与急停惯性", false)
			KEY_3:
				mai_controller.set_showcase_action("Fan_Spin", "花蝶扇 · 360°旋舞", true)
			KEY_4:
				mai_controller.set_showcase_action("Ryuuenbu", "必杀 · 龙炎舞", true)
			KEY_5:
				mai_controller.set_showcase_action("Victory_Cheer", "胜利欢呼连跳", false)
			KEY_6:
				mai_controller.set_showcase_action("Hip_Sway", "魅惑摇摆 (左右异步)", false)
			KEY_D:
				debug_enabled = not debug_enabled
			KEY_L:
				if light_panel:
					light_panel.visible = not light_panel.visible
			KEY_P:
				if breast_mod:
					breast_mod.apply_impulse(Vector3(0.45, -0.75, 0.35), "left")
					breast_mod.apply_impulse(Vector3(-0.35, -0.62, 0.28), "right")

	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT or event.button_index == MOUSE_BUTTON_RIGHT:
			if event.pressed:
				_is_dragging = true
				_drag_moved = false
			else:
				if _is_dragging and not _drag_moved and event.button_index == MOUSE_BUTTON_LEFT:
					_try_click_poke(event.position)
				_is_dragging = false
		elif event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			_desired_dist = clampf(_desired_dist - 0.16, 0.65, 5.2)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			_desired_dist = clampf(_desired_dist + 0.16, 0.65, 5.2)

	elif event is InputEventMouseMotion and _is_dragging:
		if event.relative.length() > 1.5:
			_drag_moved = true
		_desired_yaw -= event.relative.x * 0.008
		_desired_pitch = clampf(_desired_pitch - event.relative.y * 0.007, -0.85, 0.48)


func _try_click_poke(screen_pos: Vector2) -> void:
	if breast_mod == null or camera == null:
		return
	var ray_origin := camera.project_ray_origin(screen_pos)
	var ray_dir := camera.project_ray_normal(screen_pos)
	# 检查射线与左右胸部世界坐标的最近距离
	var dl := _point_ray_dist(breast_mod.left_world_pos, ray_origin, ray_dir)
	var dr := _point_ray_dist(breast_mod.right_world_pos, ray_origin, ray_dir)
	if minf(dl, dr) < 0.32:
		var side := "left" if dl < dr else "right"
		var sx := 0.55 if side == "left" else -0.55
		breast_mod.apply_impulse(Vector3(sx, 0.68, -0.52), side)
		breast_mod.apply_impulse(Vector3(-sx * 0.25, 0.25, -0.15), "right" if side == "left" else "left")


func _point_ray_dist(pt: Vector3, origin: Vector3, dir: Vector3) -> float:
	var v := pt - origin
	var t := maxf(0.0, v.dot(dir))
	return pt.distance_to(origin + dir * t)


func _process(delta: float) -> void:
	# 使用真实时间平滑镜头（慢动作下镜头依旧丝滑）
	var real_dt := delta / maxf(0.05, Engine.time_scale)
	_update_camera_transform(clampf(real_dt * 10.0, 0.0, 1.0))

	if breast_mod:
		if oscilloscope:
			oscilloscope.push_sample(breast_mod.left_disp.y, breast_mod.right_disp.y)
		if lbl_telemetry:
			lbl_telemetry.text = "FPS: %d | 动能: %.3f | 左Y: %+.1fmm | 右Y: %+.1fmm" % [
				Engine.get_frames_per_second(),
				breast_mod.kinetic_energy,
				breast_mod.left_disp.y * 1000.0,
				breast_mod.right_disp.y * 1000.0,
			]

	_update_debug_overlay()


func _update_camera_transform(t: float) -> void:
	cam_yaw = lerpf(cam_yaw, _desired_yaw, t)
	cam_pitch = lerpf(cam_pitch, _desired_pitch, t)
	cam_dist = lerpf(cam_dist, _desired_dist, t)

	var follow_pos := mai_controller.global_position if mai_controller else Vector3.ZERO
	var desired_pivot := Vector3(follow_pos.x, follow_pos.y + _desired_target_y, follow_pos.z)
	cam_pivot.position = cam_pivot.position.lerp(desired_pivot, t)

	var offset := Vector3(
		sin(cam_yaw) * cos(cam_pitch) * cam_dist,
		-sin(cam_pitch) * cam_dist,
		cos(cam_yaw) * cos(cam_pitch) * cam_dist
	)
	camera.position = offset
	camera.look_at(cam_pivot.position, Vector3.UP)


func _update_debug_overlay() -> void:
	debug_imm.clear_surfaces()
	if not debug_enabled or breast_mod == null:
		return

	debug_imm.surface_begin(Mesh.PRIMITIVE_LINES)
	# 胸腔锚点到左右质心的弹簧连线
	var c := breast_mod.chest_world_pos
	var lp := breast_mod.left_world_pos
	var rp := breast_mod.right_world_pos

	_draw_line_3d(c, lp, Color(1.0, 0.25, 0.35))
	_draw_line_3d(c, rp, Color(1.0, 0.80, 0.25))

	# 左右位移向量放大 4x
	_draw_line_3d(lp, lp + breast_mod.left_disp * 4.5, Color(0.2, 1.0, 0.6))
	_draw_line_3d(rp, rp + breast_mod.right_disp * 4.5, Color(0.2, 1.0, 0.6))

	# 左右速度向量
	_draw_line_3d(lp, lp + breast_mod.left_vel * 0.22, Color(0.3, 0.75, 1.0))
	_draw_line_3d(rp, rp + breast_mod.right_vel * 0.22, Color(0.3, 0.75, 1.0))

	debug_imm.surface_end()


func _draw_line_3d(a: Vector3, b: Vector3, col: Color) -> void:
	debug_imm.surface_set_color(col)
	debug_imm.surface_add_vertex(a)
	debug_imm.surface_set_color(col)
	debug_imm.surface_add_vertex(b)
