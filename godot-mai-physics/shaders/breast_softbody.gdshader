shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

// 原始 PBR 贴图通道 (Albedo + Normal + ORM)
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap;
uniform bool has_normal_tex = false;
uniform bool has_orm_tex = false;
uniform vec4 albedo_tint : source_color = vec4(1.0, 1.0, 1.0, 1.0);

// 算法开关: 0 = 仅骨骼弹簧, 1 = 质心权重场 GPU 顶点柔体, 2 = 混合柔体笼 (DOA Hybrid)
uniform int algo_mode = 2;

// 左右质心物理参数
uniform vec3 disp_left = vec3(0.0);
uniform vec3 disp_right = vec3(0.0);
uniform vec3 vel_left = vec3(0.0);
uniform vec3 vel_right = vec3(0.0);
uniform float squash_strength = 0.85;
uniform float ripple_strength = 0.012;
uniform float ripple_phase = 0.0;
uniform float energy_left = 0.0;
uniform float energy_right = 0.0;
uniform vec2 cage_shear_left = vec2(0.0);
uniform vec2 cage_shear_right = vec2(0.0);

varying float v_height;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-5;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void vertex() {
	v_height = VERTEX.y;
	float w = COLOR.r;

	if (algo_mode >= 1 && w > 0.005) {
		bool is_left = COLOR.g > 0.5;
		float radial_r = COLOR.b;
		float lower_bias = COLOR.a;

		vec3 disp = is_left ? disp_left : disp_right;
		vec3 vel = is_left ? vel_left : vel_right;
		float energy = is_left ? energy_left : energy_right;
		vec2 shear = is_left ? cage_shear_left : cage_shear_right;

		float w_core = pow(w, 1.15);
		float w_tip = pow(w, 1.85);

		// 1. 质心方向性位移 + 下半部重力滞后
		vec3 offset = disp * w_core;
		offset.y += disp.y * 0.28 * lower_bias * w_tip;

		// 2. 体积恒定泊松法线膨胀
		float compress = clamp(-disp.z * 8.5 + abs(vel.y) * 0.18, 0.0, 1.0);
		float bulge = compress * squash_strength * 0.018 * w_core * (0.4 + 0.6 * radial_r);
		offset += NORMAL * bulge;

		// 3. 相位延迟脂肪表面波纹
		float amp = clamp(sqrt(energy) * ripple_strength, 0.0, 0.014);
		float wave = sin(ripple_phase - radial_r * 4.2) * amp * w_core * (1.0 - 0.35 * radial_r);
		offset += NORMAL * wave;

		// 4. DOA 混合柔体笼二阶剪切波
		if (algo_mode == 2) {
			offset.x += shear.x * (0.5 - radial_r) * w_core * 0.65;
			offset.y += shear.y * (lower_bias - 0.35) * w_core * 0.85;
		}

		float max_off = 0.085;
		float len_off = length(offset);
		if (len_off > max_off) {
			offset *= max_off / len_off;
		}
		VERTEX += offset;
	}
}

void fragment() {
	vec3 base_col = texture(albedo_tex, UV).rgb * albedo_tint.rgb;
	vec3 hsv = rgb2hsv(base_col);
	float h = hsv.x;
	float s = hsv.y;
	float v = hsv.z;

	vec3 orm = has_orm_tex ? texture(orm_tex, UV).rgb : vec3(1.0, 0.65, 0.0);

	// === 实时语义材质分离 (Soft PBR Material Layer Classification) ===
	// 1. 皮肤区域 (暖桃肤色: 色相 0.02~0.11, 中低饱和度 0.14~0.52, 明度 > 0.42)
	float is_skin_hue = smoothstep(0.015, 0.035, h) * (1.0 - smoothstep(0.095, 0.135, h));
	float is_skin_sat = smoothstep(0.11, 0.20, s) * (1.0 - smoothstep(0.46, 0.58, s));
	float is_skin_val = smoothstep(0.38, 0.50, v);
	float skin_mask = clamp(is_skin_hue * is_skin_sat * is_skin_val, 0.0, 1.0);

	// 2. 金属金边区域 (暖金黄色相 0.09~0.17, 高饱和, 或原贴图 Metallic 偏高)
	float is_gold_hue = smoothstep(0.085, 0.11, h) * (1.0 - smoothstep(0.155, 0.185, h));
	float gold_mask = clamp(max(is_gold_hue * smoothstep(0.40, 0.56, s) * smoothstep(0.35, 0.50, v), smoothstep(0.45, 0.75, orm.b)), 0.0, 1.0);
	skin_mask *= (1.0 - gold_mask);

	// 3. 头发区域 (深栗棕色: 色相 0.0~0.12, 明度 0.05~0.38, 位于头部与高马尾高度)
	float is_hair_color = (1.0 - smoothstep(0.11, 0.16, h)) * smoothstep(0.04, 0.12, v) * (1.0 - smoothstep(0.32, 0.44, v)) * smoothstep(0.18, 0.35, s);
	float is_hair_zone = smoothstep(0.72, 1.05, v_height);
	float hair_mask = clamp(is_hair_color * is_hair_zone * (1.0 - skin_mask) * (1.0 - gold_mask), 0.0, 1.0);

	// 4. 其余区域全部归类为布料 (绯红忍者服、白色过膝袜与蝴蝶结、深色腰带)
	float cloth_mask = clamp(1.0 - skin_mask - gold_mask - hair_mask, 0.0, 1.0);

	// === 独立物理属性参数 (彻底告别塑料反光!) ===
	// 皮肤: 细腻微哑光 + 真实次表面散射 (SSS) + 低镜面反射
	float r_skin = 0.66;
	float m_skin = 0.0;
	float sp_skin = 0.24;

	// 布料: 织物哑光微糙 + 极低塑料反光 + 柔和纤维边缘绒感 (Sheen/Rim)
	float weave = (sin(UV.x * 420.0) * sin(UV.y * 420.0)) * 0.035;
	float r_cloth = clamp(0.84 + weave, 0.76, 0.94);
	float m_cloth = 0.0;
	float sp_cloth = 0.12;

	// 头发: 丝滑发丝高光 (中等粗糙度 + 较高镜面与暖色轮廓光)
	float strand = sin(UV.x * 260.0 + UV.y * 40.0) * 0.05;
	float r_hair = clamp(0.36 + strand, 0.28, 0.48);
	float m_hair = 0.05;
	float sp_hair = 0.58;

	// 金边: 真实拉丝金属反光
	float r_gold = 0.26;
	float m_gold = 0.88;
	float sp_gold = 0.72;

	ALBEDO = base_col;
	ROUGHNESS = r_skin * skin_mask + r_cloth * cloth_mask + r_hair * hair_mask + r_gold * gold_mask;
	METALLIC = m_skin * skin_mask + m_cloth * cloth_mask + m_hair * hair_mask + m_gold * gold_mask;
	SPECULAR = sp_skin * skin_mask + sp_cloth * cloth_mask + sp_hair * hair_mask + sp_gold * gold_mask;
	AO = mix(1.0, orm.r, 0.65);

	// 皮肤暖色透光 (WebGL 2 & Metal Forward+ 全兼容, 柔和血色过渡不发灰!)
	BACKLIGHT = vec3(0.42, 0.16, 0.11) * skin_mask;

	// 分层轮廓光: 布料柔和织物绒边 + 头发丝滑反光边 (皮肤不加生硬塑料边!)
	RIM = cloth_mask * 0.18 + hair_mask * 0.34;
	RIM_TINT = cloth_mask * 0.35 + hair_mask * 0.72;
	CLEARCOAT = 0.0;

	if (has_normal_tex) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
		NORMAL_MAP_DEPTH = 0.85 * cloth_mask + 0.55 * skin_mask + 0.95 * hair_mask + 1.0 * gold_mask;
	}
}
