"""
노량진1동 판타지 세계관 데이터 업데이트
world_area / world_partition_group / world_partition 세 레벨을
실제 노량진1동 지역 특색 + 판타지 감성으로 채운다.

노량진 세계관 배경:
  - 노량진(露梁津): 조선시대 한강 나루터. "빛이 드러나는 나루"
  - 현대: 고시촌(수험 수도 마을), 경사진 언덕, 공원, 학원가
  - 판타지: "노량도(露梁道)" — 현계강 건너편 지식의 성소.
    수험 수도자들이 몰려드는 곳. 자연 정령이 언덕을 지키고,
    고석길이 학원가를 잇는다.
"""
import asyncio
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from sqlalchemy import text
from core.database import async_session_factory

ADMIN_AREA_ID = 3879474  # 노량진1동 osm_id

# ──────────────────────────────────────────────────────────────────────────────
# 1. world_area — 동 레벨
# ──────────────────────────────────────────────────────────────────────────────
WORLD_AREA_UPDATE = {
    "persona_tag": "scholar_haven_frontier",
    "texture_style_profile": "ancient_ford_district",
    "image_prompt_base": (
        "ancient korean hillside neighborhood at dusk, stone study halls alongside sacred groves, "
        "lanterns glowing amber along winding paths, han river visible in misty distance, "
        "robed scholars walking ancient stone roads, fantasy atmosphere, warm mist, moss-covered walls"
    ),
    "image_prompt_negative": (
        "modern cars, glass skyscrapers, neon signs, harsh noon light, western medieval fantasy, "
        "generic RPG, blurry, low quality"
    ),
}

# ──────────────────────────────────────────────────────────────────────────────
# 2. world_partition_group — 21개 그룹
# ──────────────────────────────────────────────────────────────────────────────
# 실제 지역 맥락:
#   sanctuary_green  → 노량진 언덕 공원, 여의천 수변, 경사 녹지
#   ancient_stone_route → 노량진역 방사형 도로, 순례자 길목
#   academy_sanctum  → 고시촌 학원가, 독서실 밀집 구역
#   event_pocket     → 특이 지형, 소광장
#   urban_fantasy_residential → 고시원/쪽방 주거지

GROUP_DATA = {
    # ── sanctuary_green ──────────────────────────────────────────────────────
    1: {
        "display_name": "강신 언덕 서쪽 성역",
        "summary": "현계강 바람이 닿는 언덕 서쪽 끝자락. 물의 정령이 깃든 서쪽 성역.",
        "description": (
            "노량 나루터에서 이어지는 강바람이 가장 먼저 닿는 구역. "
            "한강—판타지로는 '현계강'—에 면한 이 언덕에는 수백 년 전부터 "
            "물의 정령이 머문다고 전해진다. "
            "이슬 맺힌 풀밭과 이끼 낀 바위 사이로 희미한 파란 불빛이 흘러다닌다."
        ),
        "persona_tag": "riverbank_guardian",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "riverside_meadow_01",
        "image_prompt_base": (
            "riverside sacred grove on korean hillside, water spirit territory, "
            "blue-green mist near han river, ancient stone markers, soft ambient glow, "
            "damp grass and mossy rocks, twilight atmosphere"
        ),
        "image_prompt_negative": "urban, dry desert, harsh sunlight, modern structures",
        "prompt_inherit_mode": "append",
    },
    2: {
        "display_name": "녹음 성역 북부 고지",
        "summary": "노량진 북쪽 언덕배기. 짙은 녹음 사이 고지 정령의 땅.",
        "description": (
            "동네 북쪽 경사면을 따라 이어지는 조용한 숲지대. "
            "낮에도 그늘이 짙고 바람이 없는 날엔 먼 경전 읽는 소리가 들린다는 전설이 있다. "
            "고지(高地) 정령들은 이 언덕을 '공부하는 자들의 쉼터'로 봐왔다."
        ),
        "persona_tag": "highland_keeper",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "highland_meadow_01",
        "image_prompt_base": (
            "dense highland grove on steep korean hillside, deep shade under old trees, "
            "soft wind spirits visible as faint shimmer, stone steps half-buried in moss, "
            "overcast soft lighting"
        ),
        "image_prompt_negative": "open plains, bright noon, arid, modern",
        "prompt_inherit_mode": "append",
    },
    3: {
        "display_name": "고요한 숲의 안뜰",
        "summary": "소음 없는 숲 안쪽. 숲 파수꾼이 순찰하는 고요의 뜰.",
        "description": (
            "주거지와 학원가 사이 숨은 소규모 숲. "
            "바깥 세상의 소음이 여기서는 신기하게도 잘 들리지 않는다. "
            "숲 파수꾼이 오래전부터 지켜왔으며, "
            "경계를 허락 없이 넘으면 방향 감각이 흐려진다."
        ),
        "persona_tag": "grove_sentinel",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "inner_grove_01",
        "image_prompt_base": (
            "secluded forest courtyard between korean study buildings and hillside, "
            "ancient guardian spirit presence, hushed ambient light filtering through canopy, "
            "roots and ferns on forest floor"
        ),
        "image_prompt_negative": "crowded, noisy, open sky, bright",
        "prompt_inherit_mode": "append",
    },
    4: {
        "display_name": "절벽 녹지 띠",
        "summary": "경사진 절벽면을 따라 이어지는 좁고 긴 녹지 구역. 은자가 사는 곳.",
        "description": (
            "동작구 특유의 가파른 경사가 만든 좁고 긴 녹지 띠. "
            "도시 속에 끼인 이 경사면엔 절벽의 은자가 살며, "
            "발 아래 도시의 소음과 위쪽 숲의 고요가 공존한다. "
            "수험생들이 지나며 마음을 다잡는 장소이기도 하다."
        ),
        "persona_tag": "cliff_hermit",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "cliff_meadow_01",
        "image_prompt_base": (
            "narrow green belt along steep cliff face in korean urban hillside, "
            "hermit dwelling hidden in crevice, city visible below, forest above, "
            "vertical tension between nature and urban, mystical"
        ),
        "image_prompt_negative": "flat terrain, open meadow, modern buildings up close",
        "prompt_inherit_mode": "append",
    },
    6: {
        "display_name": "내부 성역 뜰",
        "summary": "학원가 안쪽에 조용히 숨어있는 뜰. 뜰 관리자가 손님을 맞는다.",
        "description": (
            "고시촌 골목 안쪽 깊숙이 있는 작은 녹지 뜰. "
            "빽빽한 건물들 사이 이 뜰만은 사계절 내내 꽃이 핀다고 한다. "
            "지친 수험생들이 잠시 쉬어가는 곳이며, "
            "뜰 관리자는 쉬어가는 이들에게 방향을 잃지 말라는 말을 건넨다."
        ),
        "persona_tag": "garden_warden",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "inner_courtyard_01",
        "image_prompt_base": (
            "hidden garden courtyard deep in korean study district, "
            "flowers blooming between cramped buildings, gentle guardian spirit, "
            "lantern light, small pond, quiet sanctuary feel"
        ),
        "image_prompt_negative": "wide open, no enclosure, harsh sunlight, busy",
        "prompt_inherit_mode": "append",
    },
    7: {
        "display_name": "학자의 명상 숲",
        "summary": "학원가와 맞닿은 숲. 현인들이 산책하며 사유하는 명상의 땅.",
        "description": (
            "노량진 학원가 바로 옆에 펼쳐진 완충 숲 구역. "
            "고시생들이 암기한 내용을 되새기며 걷는 이 길엔 "
            "오래전 현인의 혼백이 스며있다고 전해진다. "
            "숲이 주는 고요가 기억력을 높인다는 믿음이 있어 많은 이들이 찾는다."
        ),
        "persona_tag": "sage_wanderer",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "sanctuary_trail_01",
        "image_prompt_base": (
            "meditation grove adjacent to korean exam academy district, "
            "sage spirit wandering stone paths under old trees, "
            "soft warm light through foliage, ancient scrolls motif, "
            "contemplative serene atmosphere"
        ),
        "image_prompt_negative": "crowded, noisy road, harsh, no trees",
        "prompt_inherit_mode": "append",
    },
    8: {
        "display_name": "숲속 갈림길 구역",
        "summary": "녹지 안을 가로지르는 갈림길. 숲길 나그네들이 오가는 통과 지점.",
        "description": (
            "공원과 주거지 사이 경계를 따라 형성된 갈림길 구역. "
            "방향이 여러 갈래로 나뉘어 처음 오는 이들은 헤매기 쉽다. "
            "숲길을 잘 아는 나그네들만이 이곳을 지름길로 쓴다. "
            "봄엔 벚꽃, 가을엔 낙엽이 깔려 다른 풍경을 연출한다."
        ),
        "persona_tag": "forest_walker",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "forest_path_02",
        "image_prompt_base": (
            "forested crossroads zone in korean hillside park, "
            "multiple winding paths diverging through trees, "
            "traveler spirit guides visible at junctions, dappled light, "
            "seasonal foliage, mysterious fork in road"
        ),
        "image_prompt_negative": "concrete, paved highway, no trees, open field",
        "prompt_inherit_mode": "append",
    },
    9: {
        "display_name": "물안개 녹지 구역",
        "summary": "안개가 피어오르는 저지대 녹지. 물안개 표류자의 영역.",
        "description": (
            "지형이 낮아 아침이면 안개가 자욱하게 깔리는 녹지 구역. "
            "안개 속에서 방향을 잃은 이들이 종종 나타나는데, "
            "물안개 표류자들이 이들을 안전한 곳으로 인도해준다고 한다. "
            "안개가 걷히면 이슬 맺힌 풀밭과 연못이 드러난다."
        ),
        "persona_tag": "misty_drifter",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "pond_meadow_01",
        "image_prompt_base": (
            "misty low-lying green zone in korean neighborhood, morning fog over small ponds, "
            "drifting water spirits barely visible in mist, soft diffused light, "
            "dew-covered grass, reflections in still water"
        ),
        "image_prompt_negative": "clear sunny day, dry, no water, urban concrete",
        "prompt_inherit_mode": "append",
    },
    10: {
        "display_name": "남쪽 성역 중심",
        "summary": "노량진1동 남쪽을 아우르는 넓은 성역. 계곡 수호자가 머무는 중심지.",
        "description": (
            "동 남쪽을 넓게 차지하는 성역의 핵심부. "
            "예로부터 이 지역 정령들의 집회 장소였다고 전해지며, "
            "계곡 수호자가 대를 이어 이곳을 지켜왔다. "
            "땅 아래 고대 수맥이 흐른다는 소문도 있다."
        ),
        "persona_tag": "vale_keeper",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "cliff_meadow_01",
        "image_prompt_base": (
            "central southern sacred vale in korean hillside, ancient guardian spirit territory, "
            "wide green expanse with ritual stone markers, underground stream motif, "
            "spirit gathering place, subtle golden hour light"
        ),
        "image_prompt_negative": "crowded, paved, modern infrastructure, no nature",
        "prompt_inherit_mode": "append",
    },
    14: {
        "display_name": "황혼의 사색 숲",
        "summary": "해질 무렵 가장 아름다운 숲. 황혼의 현인이 거닌다.",
        "description": (
            "서쪽 하늘이 붉게 물드는 시간, 이 숲은 금빛으로 빛난다. "
            "수험 준비에 지친 이들이 황혼 무렵 자주 찾는 장소. "
            "황혼의 현인은 사유하는 자들 곁을 조용히 걷다 사라진다고 전해진다."
        ),
        "persona_tag": "twilight_sage",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "forest_path_01",
        "image_prompt_base": (
            "twilight meditation forest in korean urban hillside, "
            "golden hour light filtering through autumn trees, "
            "sage spirit visible as warm shimmer, contemplative mood, "
            "stone benches, fallen leaves"
        ),
        "image_prompt_negative": "morning, noon, rain, dark night, modern lit streets",
        "prompt_inherit_mode": "append",
    },
    18: {
        "display_name": "고독한 정령의 언덕",
        "summary": "홀로 떨어진 작은 언덕. 고독한 정령 하나가 자리를 지킨다.",
        "description": (
            "도로와 건물에 둘러싸여 고립된 작은 녹지 언덕. "
            "아무도 크게 신경 쓰지 않지만, 오래된 정령 하나가 꿋꿋이 이곳을 지킨다. "
            "지나치는 이들이 가끔 혼자 중얼거리는 소리를 듣는다고 한다."
        ),
        "persona_tag": "solitary_spirit",
        "theme_code": "sanctuary_green",
        "texture_style_profile": "cliff_meadow_01",
        "image_prompt_base": (
            "tiny isolated spirit mound surrounded by korean urban roads and buildings, "
            "lone ancient tree with singular spirit residing, "
            "forgotten sacred spot, overgrown but dignified, subtle glowing aura"
        ),
        "image_prompt_negative": "crowds, wide open, grand scale, multiple trees",
        "prompt_inherit_mode": "append",
    },
    # ── ancient_stone_route ──────────────────────────────────────────────────
    5: {
        "display_name": "북쪽 순례자의 고석길",
        "summary": "노량진역 북쪽 방사형 도로. 고시촌으로 향하는 순례자들의 주요 길목.",
        "description": (
            "노량진역에서 북쪽 고시촌으로 이어지는 주요 도로망. "
            "매년 수만 명의 수험생이 이 길을 오가며 '운명의 길'이라 부른다. "
            "판타지로는 지식의 성소로 향하는 순례자 대로—돌 사이사이 고대 문자가 새겨져 있다."
        ),
        "persona_tag": "pilgrim_runner",
        "theme_code": "ancient_stone_route",
        "texture_style_profile": "sunlit_stone_route_01",
        "image_prompt_base": (
            "ancient stone pilgrim road in korean exam district, "
            "worn cobblestones with carved runes, streams of robed scholars walking, "
            "lanterns lining the path, misty morning atmosphere, destiny road"
        ),
        "image_prompt_negative": "asphalt, cars, modern signage, empty, forest",
        "prompt_inherit_mode": "append",
    },
    12: {
        "display_name": "회랑의 고석 통로",
        "summary": "학원가를 에두르는 고석 통로. 길 위에서 사색하는 학자형 나그네의 구역.",
        "description": (
            "아카데미 구역 주변을 감싸는 도로망. "
            "단순한 통행로이지만, 여기를 오가는 이들은 자연스레 지식 토론을 시작한다. "
            "길 위의 학자들이 주고받는 논쟁이 이 길의 공기를 채운다."
        ),
        "persona_tag": "road_scholar",
        "theme_code": "ancient_stone_route",
        "texture_style_profile": "sunlit_stone_route_02",
        "image_prompt_base": (
            "stone corridor road surrounding korean academy district, "
            "scholars debating as they walk, inscribed stone tiles, "
            "warm academic atmosphere, lantern-lit sides, arched stone passages"
        ),
        "image_prompt_negative": "nature, forest, empty road, no buildings, modern",
        "prompt_inherit_mode": "append",
    },
    16: {
        "display_name": "남쪽 교차로 요충지",
        "summary": "남부 핵심 교차로. 요충지 수호자가 길목을 지킨다.",
        "description": (
            "동 남쪽 주요 교차점. 여러 방향으로 나뉘는 이 교차로는 "
            "방향을 잃은 여행자들이 다시 방향을 잡는 장소다. "
            "요충지 수호자는 갈 길을 모르는 이들에게 방향을 제시하지만, "
            "항상 옳은 방향인지는 장담할 수 없다."
        ),
        "persona_tag": "waypoint_guardian",
        "theme_code": "ancient_stone_route",
        "texture_style_profile": "arcane_floor_01",
        "image_prompt_base": (
            "mystical crossroads in southern korean district, "
            "guardian spirit at junction, glowing arcane rune intersection, "
            "multiple stone paths diverging, atmospheric fog at ground level"
        ),
        "image_prompt_negative": "forest, green, nature, no road, empty",
        "prompt_inherit_mode": "append",
    },
    17: {
        "display_name": "동쪽 학자의 통로",
        "summary": "동쪽 골목을 잇는 좁은 통로. 통로 질주자들이 가장 빠른 길을 안다.",
        "description": (
            "동쪽 방향 골목길을 잇는 좁은 도로들. "
            "이 길을 잘 아는 이들은 어떤 길보다 빠르게 목적지에 도달한다. "
            "고시생들 사이에서 '지름길의 달인'들이 전수해온 루트가 여기 있다."
        ),
        "persona_tag": "path_runner",
        "theme_code": "ancient_stone_route",
        "texture_style_profile": "arcane_floor_02",
        "image_prompt_base": (
            "narrow eastern alley passages in korean hillside district, "
            "swift runner spirit darting through tight stone corridors, "
            "arcanely lit narrow paths, fast movement energy, dusk lighting"
        ),
        "image_prompt_negative": "wide road, open, green, nature, grand scale",
        "prompt_inherit_mode": "append",
    },
    19: {
        "display_name": "잊혀진 샛길",
        "summary": "지도에도 없는 작은 샛길. 골목 방랑자만이 아는 비밀 통로.",
        "description": (
            "지도에는 표기조차 되지 않는 작은 샛길. "
            "오래된 벽과 벽 사이 미로처럼 이어진다. "
            "골목 방랑자들은 이 길을 통해 어디서든 빠져나올 수 있다고 하며, "
            "가끔 이 길에서 길 잃은 이들을 발견하기도 한다."
        ),
        "persona_tag": "alley_wanderer",
        "theme_code": "ancient_stone_route",
        "texture_style_profile": "stone_route_trim",
        "image_prompt_base": (
            "forgotten back alley between old korean buildings, "
            "wanderer spirit navigating secret passage, "
            "overgrown stone path, faded wall murals, dim but curious atmosphere"
        ),
        "image_prompt_negative": "wide open, modern, bright daylight, busy crowd",
        "prompt_inherit_mode": "append",
    },
    # ── academy_sanctum ──────────────────────────────────────────────────────
    11: {
        "display_name": "고시촌 경전 전당",
        "summary": "고시촌 동쪽 학원 밀집 구역. 경전 탐구자들이 밤새 공부하는 전당.",
        "description": (
            "노량진 고시촌의 핵심 학원 밀집 구역. "
            "건물마다 빽빽이 들어찬 독서실과 학원에서 밤새 불빛이 새나온다. "
            "판타지로는 고대 경전을 해독하는 수행자들의 전당—"
            "시험에 합격하는 것은 곧 금지된 지식의 문을 여는 것과 같다."
        ),
        "persona_tag": "tome_seeker",
        "theme_code": "academy_sanctum",
        "texture_style_profile": "academy_ruin_yard_01",
        "image_prompt_base": (
            "korean exam academy district at night, dense study halls with glowing windows, "
            "robed scholars hunched over ancient tomes, arcane rune-lit corridors, "
            "exhausted but determined energy, lantern-lit narrow streets between buildings"
        ),
        "image_prompt_negative": "nature, open air, daytime, empty, casual",
        "prompt_inherit_mode": "append",
    },
    15: {
        "display_name": "룬 학자의 수련 전당",
        "summary": "고시촌 서쪽 학원 구역. 룬 문자를 해석하는 고급 수련의 장.",
        "description": (
            "고시촌에서도 더 전문적인 과목을 다루는 학원들이 모인 서쪽 구역. "
            "이곳의 수련생들은 단순 암기를 넘어 문제의 본질을 꿰뚫는 훈련을 받는다. "
            "룬 학자들이 벽에 새긴 기호들은 해독하는 데 평생이 걸린다는 이야기도 있다."
        ),
        "persona_tag": "rune_scholar",
        "theme_code": "academy_sanctum",
        "texture_style_profile": "academy_ruin_yard_01",
        "image_prompt_base": (
            "advanced rune academy in korean study district, "
            "scholars decoding wall inscriptions, layered arcane symbols on stone walls, "
            "deep academic atmosphere, specialized knowledge hall, candle-lit study rooms"
        ),
        "image_prompt_negative": "outdoor, casual, green, modern, empty",
        "prompt_inherit_mode": "append",
    },
    # ── event_pocket ─────────────────────────────────────────────────────────
    13: {
        "display_name": "숨겨진 성소 터",
        "summary": "골목 안쪽 특이 지형. 성소의 문지기가 지키는 숨겨진 성지.",
        "description": (
            "고시촌 골목 안쪽에 갑자기 나타나는 특이한 지형 구역. "
            "오래된 건물들 사이에 예상치 못한 작은 광장이나 계단이 있다. "
            "성소의 문지기는 이곳을 아는 이들에게만 특별한 기회를 제공한다고 한다."
        ),
        "persona_tag": "shrine_guardian",
        "theme_code": "event_pocket",
        "texture_style_profile": "arcane_floor_01",
        "image_prompt_base": (
            "hidden shrine courtyard discovered in korean alley, "
            "guardian spirit at ancient stone threshold, "
            "unexpected sacred space between cramped buildings, "
            "ritual offerings, soft sacred light emanating from ground"
        ),
        "image_prompt_negative": "wide open, forest, road, no buildings, bland",
        "prompt_inherit_mode": "append",
    },
    20: {
        "display_name": "야외 신탁의 광장",
        "summary": "열린 공간에 마련된 야외 광장. 신탁의 수호자가 예언을 내린다.",
        "description": (
            "고시촌 한편에 열린 야외 공간. "
            "수험생들이 삼삼오오 모여 정보를 교환하고 위로를 나누는 장소. "
            "판타지로는 신탁의 수호자가 가끔 나타나 '합격의 조짐'을 알려준다고 전해진다. "
            "믿거나 말거나이지만, 이곳에서 기도한 이들의 합격률이 높다는 소문이 있다."
        ),
        "persona_tag": "oracle_keeper",
        "theme_code": "event_pocket",
        "texture_style_profile": "arcane_floor_01",
        "image_prompt_base": (
            "open air oracle plaza in korean exam district, "
            "oracle spirit appearing to gathered scholars, "
            "circular stone plaza with celestial markings, "
            "hope and destiny atmosphere, lanterns floating above"
        ),
        "image_prompt_negative": "enclosed, dark, forested, empty, no people",
        "prompt_inherit_mode": "append",
    },
    # ── urban_fantasy_residential ─────────────────────────────────────────────
    21: {
        "display_name": "방랑자들의 마을",
        "summary": "고시원과 쪽방이 모인 주거 구역. 꿈을 쫓는 방랑자들의 임시 거처.",
        "description": (
            "전국 각지에서 몰려온 고시생들이 작은 방 하나씩을 얻어 사는 주거 구역. "
            "쪽방과 고시원이 빼곡하게 들어선 이곳은 "
            "판타지로는 대륙 각지에서 지식을 찾아 온 방랑자들의 임시 마을. "
            "서로 다른 목적과 출신을 가진 이들이 같은 꿈 아래 모여든다."
        ),
        "persona_tag": "hamlet_dweller",
        "theme_code": "urban_fantasy_residential",
        "texture_style_profile": "village_square_01",
        "image_prompt_base": (
            "cramped korean study district residential hamlet, "
            "tiny rooms with warm glowing windows stacked tightly, "
            "diverse wanderers from across the land gathered here, "
            "bittersweet hopeful atmosphere, narrow alleys between dwellings, lanterns"
        ),
        "image_prompt_negative": "grand buildings, nature, open space, luxury, empty",
        "prompt_inherit_mode": "append",
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# 3. world_partition 배리에이션
# ── 그룹별 파티션에 3가지 변형을 (partition_seq-1) % 3 으로 배정
# ──────────────────────────────────────────────────────────────────────────────
PARTITION_VARIANTS = {
    # group_seq: [(persona_tag, summary, description, image_prompt_append), ...]
    "riverbank_guardian": [
        ("riverbank_guardian",
         "강바람이 직접 닿는 구역. 물의 기운이 가장 진하다.",
         "현계강에서 불어오는 바람이 가장 먼저 닿는 자리. 풀잎마다 강의 기억이 담겨있다.",
         "water spirit aura, river wind, blue-green mist on grass"),
        ("shore_watcher",
         "강 방향을 바라보는 언덕 가장자리. 강을 지켜보는 파수꾼의 땅.",
         "언덕 끝에 서면 현계강의 흐름이 내려다보인다. 파수꾼들이 대를 이어 이곳을 지킨다.",
         "overlooking river, guardian post, misty river view"),
        ("tide_whisperer",
         "밀물과 썰물의 기운이 닿는 경계 지점. 조류 속삭임이들리는 곳.",
         "강의 수위가 변할 때마다 이 구역의 공기가 달라진다고 한다. 조류를 읽는 자만이 안다.",
         "tidal energy, shifting ground moisture, subtle blue shimmer"),
    ],
    "highland_keeper": [
        ("highland_keeper",
         "고지대 숲의 핵심부. 높이 있어 바람이 강하고 기운이 맑다.",
         "노량진 북쪽 언덕 가장 높은 자리. 여기서 보면 동 전체가 한눈에 들어온다.",
         "highland wind, clear air, elevated vantage point, pine and moss"),
        ("hill_sentinel",
         "언덕 중턱을 지키는 파수꾼의 순찰 구역.",
         "고지 정령의 파수꾼이 언덕 중턱을 따라 순찰하는 구역. 낯선 이들을 면밀히 관찰한다.",
         "mid-hill patrol zone, watchful spirit presence, dense foliage"),
        ("canopy_drifter",
         "나무 상층부에 걸린 안개가 내려앉는 구역.",
         "나무 꼭대기에서 시작된 안개가 아침마다 이 구역으로 흘러내린다. 시야가 짧아진다.",
         "canopy fog drifting down, reduced visibility, ethereal morning light"),
    ],
    "grove_sentinel": [
        ("grove_sentinel",
         "숲 안쪽 핵심. 숲 파수꾼이 직접 순찰하는 구역.",
         "어떤 소리도 새어나가지 않는 고요의 핵심부. 파수꾼의 눈길이 항상 머문다.",
         "deep grove silence, sentinel patrol, filtered canopy light"),
        ("moss_keeper",
         "이끼가 가장 두껍게 쌓인 고요한 구역.",
         "세월이 겹겹이 쌓인 이끼 층 위에 미세한 정령의 흔적이 보인다.",
         "thick moss ground cover, ancient stillness, green-gold light"),
        ("shadow_grove",
         "낮에도 그늘이 깊은 숲 안쪽 구역.",
         "한낮에도 햇빛이 거의 들지 않아 늘 서늘하다. 이 서늘함을 좋아하는 정령이 있다.",
         "deep shade even at noon, cool dark grove, shadow spirit territory"),
    ],
    "cliff_hermit": [
        ("cliff_hermit",
         "절벽 경사면의 가장 좁은 구역. 은자가 직접 거주하는 자리.",
         "절벽을 등지고 도시를 내려다보는 은자의 자리. 아무도 찾아오지 않는다.",
         "cliff face dwelling, hermit presence, steep slope, city below"),
        ("ledge_keeper",
         "경사면 중간 단(段)에 형성된 구역.",
         "절벽에 자연스럽게 생긴 평평한 단. 여기서 쉬어가는 여행자들이 있다.",
         "natural rock ledge, resting spot, vertical terrain, urban backdrop"),
        ("slope_wanderer",
         "경사를 따라 오르내리는 이들이 지나는 통과 구역.",
         "위아래를 잇는 통로 역할을 하는 경사 구역. 지나치는 이들이 간혹 발자국을 남긴다.",
         "sloping passage, transient movement, worn path on incline"),
    ],
    "garden_warden": [
        ("garden_warden",
         "내부 뜰의 중심. 뜰 관리자가 직접 돌보는 구역.",
         "사시사철 꽃이 피는 이상한 뜰의 중심부. 관리자의 손길이 닿지 않는 곳이 없다.",
         "garden center, tended flowers, warm sanctuary light"),
        ("bloom_keeper",
         "계절마다 다른 꽃이 피는 화단 구역.",
         "봄엔 벚꽃, 여름엔 수국, 가을엔 국화, 겨울엔 동백. 계절을 읽을 수 있는 구역.",
         "seasonal blooms, rotating flower beds, gentle garden spirit"),
        ("root_warden",
         "오래된 나무 뿌리가 뜰 아래를 지나는 구역.",
         "수백 년 된 나무 뿌리가 뜰 아래를 가로지른다. 이 뿌리가 뜰의 비밀을 품고 있다.",
         "ancient tree roots, underground network, deep garden magic"),
    ],
    "sage_wanderer": [
        ("sage_wanderer",
         "현인이 자주 거니는 명상 산책로 구역.",
         "아침 일찍 이 길을 걸으면 혼자인데도 발소리가 두 개처럼 들린다.",
         "meditation path, sage spirit walking beside you, dawn mist"),
        ("contemplation_grove",
         "앉아서 사유하기 좋은 나무 그늘 구역.",
         "적당히 펼쳐진 나무 그늘 아래 돌 벤치가 있다. 앉으면 생각이 정리된다.",
         "stone bench under tree shade, contemplative energy, scattered sunlight"),
        ("whisper_hollow",
         "바람이 돌면서 소리를 내는 오목한 지형 구역.",
         "바람이 모이는 오목한 지형이라 바람 소리가 마치 속삭임처럼 들린다.",
         "wind-gathering hollow, whispering ambient, natural acoustic bowl"),
    ],
    "forest_walker": [
        ("forest_walker",
         "숲 속 갈림길의 중심 분기점.",
         "세 갈래 이상으로 길이 나뉘는 지점. 처음 온 이들은 반드시 한 번은 헤맨다.",
         "forest junction, multiple paths diverging, wayfinding challenge"),
        ("understory_drifter",
         "숲 하층부를 따라 이어지는 구역.",
         "키 낮은 식물들이 가득한 하층부. 길이 불분명하지만 익숙한 이들은 금방 지난다.",
         "forest understory, low shrubs and ferns, hidden trail"),
        ("canopy_crosser",
         "나무 상층부 사이로 하늘이 보이는 탁 트인 구역.",
         "나무들이 잠시 벌어져 하늘이 보이는 구역. 방향 감각을 되찾을 수 있다.",
         "canopy gap with open sky view, orientation point, bright spot in forest"),
    ],
    "misty_drifter": [
        ("misty_drifter",
         "안개가 가장 짙은 저지대 중심 구역.",
         "새벽 안개가 허리 높이까지 차오르는 구역. 발 아래가 안 보여 조심스럽게 걷게 된다.",
         "dense knee-height morning fog, careful movement, misty ground"),
        ("pond_keeper",
         "작은 연못이 안개를 만드는 구역.",
         "작은 연못이 있어 항상 안개가 일어난다. 연못 수면엔 알 수 없는 문양이 떠 있다.",
         "small pond as fog source, water surface reflection, mysterious pattern"),
        ("dew_collector",
         "이슬이 유독 많이 맺히는 풀밭 구역.",
         "아침이면 풀밭 전체가 이슬로 뒤덮인다. 이슬을 모으면 특별한 효과가 있다고 한다.",
         "heavy dew on grass, morning droplets, glistening ground surface"),
    ],
    "vale_keeper": [
        ("vale_keeper",
         "계곡 수호자가 직접 지키는 성역 핵심부.",
         "수호자의 기운이 가장 강한 구역. 함부로 들어서면 기분이 묘하게 달라진다.",
         "sacred vale center, strongest guardian aura, solemn atmosphere"),
        ("water_vein",
         "지하 수맥이 지나는 위쪽 지표면 구역.",
         "땅 아래 고대 수맥이 흐르는 곳. 발바닥으로 미세한 진동을 느낄 수 있다.",
         "underground stream passing beneath, subtle vibration, water-energy ground"),
        ("gathering_ground",
         "정령들의 집회 터로 알려진 구역.",
         "예로부터 정령들이 모여 회의를 한다고 전해지는 넓은 터. 사람은 밤엔 오지 않는다.",
         "spirit assembly ground, circular clearing, ancient meeting place"),
    ],
    "twilight_sage": [
        ("twilight_sage",
         "황혼 빛이 가장 아름답게 드는 구역.",
         "서쪽 하늘이 금빛으로 물들 때 이 구역만 따로 빛난다. 황혼의 현인이 나타나는 시간.",
         "golden hour light peak spot, sage spirit manifestation at dusk"),
        ("amber_hollow",
         "노란 단풍잎이 빛을 받아 황금빛으로 빛나는 구역.",
         "가을이면 단풍잎이 빛을 받아 온 구역이 황금색이 된다. 봄엔 연두색 빛이 대신한다.",
         "amber foliage catching sunset, seasonal color shift, warm golden glow"),
        ("evening_path",
         "해질 무렵 산책자들이 가장 많이 찾는 구역.",
         "하루의 끝에 많은 이들이 이곳을 걸으며 다음 날을 생각한다.",
         "evening stroll path, peaceful end-of-day energy, fading warm light"),
    ],
    "solitary_spirit": [
        ("solitary_spirit",
         "홀로 남겨진 고독한 정령의 유일한 구역.",
         "아무도 눈여겨보지 않는 작은 녹지. 그러나 정령에게는 온 세상이다.",
         "lone spirit domain, small but meaningful, overgrown but tended"),
    ],
    "pilgrim_runner": [
        ("pilgrim_runner",
         "순례자 주도로의 핵심 통행 구역.",
         "가장 많은 수험생이 오가는 길목. 희망과 불안이 뒤섞인 발걸음이 돌을 닳게 했다.",
         "high traffic pilgrim road, worn stone, determined footsteps energy"),
        ("waystation_stretch",
         "순례자가 잠시 멈춰 숨을 고르는 구역.",
         "긴 길 위 잠시 쉬어가는 구간. 여기서 물 한 모금 마시고 다시 출발한다.",
         "rest point on pilgrim road, brief respite energy, water source nearby"),
        ("conviction_lane",
         "가장 결의에 찬 이들이 빠르게 지나는 구역.",
         "주저함 없이 직진하는 이들만 이 구간을 막힘 없이 통과할 수 있다.",
         "determined straight path, high conviction energy, fast passage"),
    ],
    "road_scholar": [
        ("road_scholar",
         "길 위에서 논쟁하는 학자들의 주요 통로.",
         "걸으면서 토론하는 이들의 발소리와 목소리가 섞여 하나의 리듬이 된다.",
         "scholarly debate on stone road, academic energy, multiple voices"),
        ("inscription_way",
         "돌 틈새에 문자가 새겨진 구역.",
         "오래된 돌 사이사이에 과거 학자들이 새긴 문구들이 남아있다. 읽으면 힌트가 된다.",
         "stone inscriptions visible between tiles, ancient wisdom etched in road"),
        ("crosswalk_dialogue",
         "서로 다른 길이 교차하며 만남이 일어나는 구역.",
         "다른 방향에서 온 학자들이 만나 짧은 교류를 나누는 교차점.",
         "crosswalk meeting point, brief encounters, exchange of knowledge"),
    ],
    "waypoint_guardian": [
        ("waypoint_guardian",
         "교차로 핵심 요충지. 수호자가 가장 집중하는 지점.",
         "모든 방향의 에너지가 모이는 교차점. 수호자의 존재가 가장 강하게 느껴진다.",
         "crossroads focal point, guardian energy peak, arcane convergence"),
        ("direction_anchor",
         "방향을 잃은 이들이 반드시 거쳐가는 구역.",
         "길을 잃으면 왠지 모르게 이곳으로 돌아오게 된다. 자연스러운 귀환점.",
         "natural return point, orientation anchor, compass energy"),
        ("junction_echo",
         "소리가 메아리처럼 울리는 교차로 주변 구역.",
         "교차로 특유의 구조로 소리가 이상하게 반사된다. 먼 곳의 발소리도 들린다.",
         "sound reflection at junction, acoustic anomaly, heightened awareness"),
    ],
    "path_runner": [
        ("path_runner",
         "가장 빠른 지름길이 지나는 구역.",
         "아는 이만 쓰는 지름길. 이 길로 가면 목적지까지 절반의 시간이 걸린다.",
         "shortcut path, efficient route, runner spirit energy"),
        ("sprint_corridor",
         "일직선으로 이어지는 빠른 통로 구역.",
         "막힘 없이 직선으로 이어지는 좁은 통로. 빠르게 지나가는 것이 예의다.",
         "straight narrow corridor, fast movement, no obstruction"),
        ("alley_dash",
         "좁고 굽은 골목을 빠르게 통과하는 구역.",
         "굽은 골목이라 속도를 줄여야 하지만, 숙련자는 벽을 짚으며 속도를 유지한다.",
         "winding alley shortcut, skilled navigation required, wall-running energy"),
    ],
    "alley_wanderer": [
        ("alley_wanderer",
         "잊혀진 샛길의 미로 같은 핵심 구역.",
         "한 번 들어오면 어떻게 나왔는지 기억이 안 난다. 하지만 항상 나오긴 한다.",
         "labyrinthine alley, disorienting but safe, forgotten passage"),
        ("wall_whisperer",
         "오래된 벽이 이야기를 품은 구역.",
         "세월이 지난 벽에 희미한 낙서와 문양이 남아있다. 읽을 수 있다면 무언가를 얻는다.",
         "old wall inscriptions, faded stories, hidden information"),
        ("shadow_lane",
         "건물 그림자로 낮에도 어두운 샛길 구역.",
         "낮에도 햇빛이 닿지 않는 그늘진 골목. 무언가를 숨기기 좋은 장소.",
         "permanently shadowed alley, discreet passage, hidden dealings energy"),
    ],
    "tome_seeker": [
        ("tome_seeker",
         "경전 탐구자들이 밤새 공부하는 핵심 구역.",
         "새벽 3시에도 불이 꺼지지 않는 학원 건물들. 지식을 향한 욕망이 가장 짙은 곳.",
         "late night study hall glow, intense focus energy, arcane tome atmosphere"),
        ("rote_chamber",
         "암기 수련이 이루어지는 구역.",
         "벽을 치며 외우는 소리, 혼자 중얼거리는 소리. 이 구역은 항상 그 소리로 가득하다.",
         "recitation energy, memory palace atmosphere, repetitive chant ambiance"),
        ("breakthrough_spot",
         "갑자기 모든 것이 이해되는 깨달음의 구역.",
         "이상하게도 이 구역에서 공부하면 막혔던 개념이 뚫린다는 소문이 있다.",
         "insight energy, sudden clarity, arcane knowledge surge"),
    ],
    "rune_scholar": [
        ("rune_scholar",
         "룬 학자들이 벽에 문자를 새기는 구역.",
         "벽면마다 크고 작은 룬 문자가 빼곡하다. 해독하면 시험 힌트가 된다는 설이 있다.",
         "rune-covered walls, dense scholarly inscriptions, arcane cipher"),
        ("interpretation_hall",
         "문자 해석 토론이 이루어지는 구역.",
         "같은 문자를 두고도 해석이 갈린다. 논쟁이 이 구역을 채운다.",
         "debate over inscriptions, multiple interpretation energy, scholarly tension"),
        ("deep_study",
         "가장 난해한 경전을 다루는 심층 수련 구역.",
         "일반 수련생은 들어올 수 없는 심화 과정 구역. 몇 안 되는 이들만 출입한다.",
         "restricted advanced study zone, exclusive knowledge, deep arcane"),
    ],
    "shrine_guardian": [
        ("shrine_guardian",
         "성소 입구를 지키는 문지기의 구역.",
         "여기를 지나려면 문지기의 인정을 받아야 한다. 기준은 명확하지 않다.",
         "shrine threshold, guardian inspection, sacred boundary"),
        ("offering_ground",
         "제물이 바쳐지는 의식 구역.",
         "작은 제단에 수험생들이 놓고 간 과자와 음료가 쌓인다. 의외로 성의가 느껴진다.",
         "offering altar, prayer energy, small ritual space"),
        ("hidden_antechamber",
         "성소 본진으로 이어지는 숨겨진 전실 구역.",
         "아는 이들만 찾는 성소의 전실. 여기서 마음을 가다듬고 들어간다.",
         "hidden anteroom before shrine, preparation space, quiet sacred waiting"),
    ],
    "oracle_keeper": [
        ("oracle_keeper",
         "신탁이 내려지는 광장 중심부.",
         "운이 좋은 날엔 신탁의 수호자가 직접 나타나 한마디를 건넨다.",
         "oracle manifestation point, destiny energy, open sky above"),
        ("gathering_plaza",
         "수험생들이 모여 정보를 교환하는 구역.",
         "합격 소식, 불합격 소식, 새로운 전략. 이 광장에선 모든 정보가 돌아다닌다.",
         "information exchange hub, crowd energy, whispers of hope and despair"),
        ("fate_marker",
         "운명의 갈림길로 알려진 구역.",
         "이 구역에서 내린 결정이 이후 운명을 가른다는 이야기가 전해진다.",
         "fate decision point, pivotal life moment energy, subtle ominous"),
    ],
    "hamlet_dweller": [
        ("hamlet_dweller",
         "방랑자들이 임시로 거주하는 마을 핵심 구역.",
         "좁은 방 하나에 짐을 풀고, 내일을 위해 오늘을 버티는 이들의 공간.",
         "cramped dwelling, determined residents, lantern-lit windows at night"),
        ("communal_alley",
         "거주자들이 서로 얼굴을 익히는 좁은 골목 구역.",
         "좁은 골목에서 마주치는 이웃들. 말은 많이 안 해도 서로를 알아간다.",
         "narrow communal passage, neighborly but quiet, shared journey"),
        ("hope_corner",
         "다음 날을 위한 의지를 다지는 구역.",
         "이 구석에서 내일 시험을 위해 마지막 페이지를 넘기는 이들이 있다.",
         "determination corner, last-minute study, hopeful pre-dawn energy"),
    ],
}

# ──────────────────────────────────────────────────────────────────────────────
# texture_profile → image_prompt_append 매핑
# ──────────────────────────────────────────────────────────────────────────────
TEXTURE_PROMPT_APPEND = {
    "pond_meadow_01":         "still pond reflection, water lilies, soft ripples, marshy edges",
    "cliff_meadow_01":        "steep cliff edge with sparse grass, rocky outcrops, exposed soil",
    "sunlit_stone_route_02":  "bright sunlit cobblestone road, warm afternoon glow, long shadows",
    "forest_path_02":         "winding dirt path through dense trees, dappled light, leaf litter",
    "sunlit_stone_route_01":  "morning light on ancient stone road, dew on cobblestones, fresh start",
    "forest_path_01":         "gentle forest trail, soft soil, roots crossing path, filtered green light",
    "sanctuary_trail_01":     "sacred narrow trail, stone lanterns lining path, reverent atmosphere",
    "academy_ruin_yard_01":   "stone courtyard with worn academic engravings, old study building walls",
    "arcane_floor_02":        "complex arcane floor pattern, glowing rune grid, magical energy field",
    "stone_route_trim":       "trimmed stone edging along narrow path, precise cut, orderly border",
    "arcane_floor_01":        "simple arcane floor marking, subtle glow, magical threshold",
    "village_square_01":      "worn village square stones, footpath patterns, community gathering marks",
    "riverside_meadow_01":    "riverside grass meadow, water-smoothed stones, gentle slope to water",
    "highland_meadow_01":     "highland grass with exposed rock, wind-bent vegetation, mountain air",
    "inner_grove_01":         "enclosed grove floor, soft moss carpet, filtered enclosed light",
    "inner_courtyard_01":     "maintained courtyard stone floor, swept clean, small potted plants",
}


async def run_updates():
    async with async_session_factory() as session:
        print("[1/3] world_area 업데이트...")
        await session.execute(
            text("""
                UPDATE world_area SET
                    persona_tag = :persona_tag,
                    texture_style_profile = :texture_style_profile,
                    image_prompt_base = :image_prompt_base,
                    image_prompt_negative = :image_prompt_negative
                WHERE osm_id = :osm_id
            """),
            {**WORLD_AREA_UPDATE, "osm_id": ADMIN_AREA_ID}
        )
        print("  OK: world_area 노량진1동 업데이트 완료")

        print("[2/3] world_partition_group 업데이트 (21개)...")
        for seq, data in GROUP_DATA.items():
            await session.execute(
                text("""
                    UPDATE world_partition_group SET
                        display_name = :display_name,
                        summary = :summary,
                        description = :description,
                        persona_tag = :persona_tag,
                        theme_code = :theme_code,
                        image_prompt_base = :image_prompt_base,
                        image_prompt_negative = :image_prompt_negative,
                        prompt_inherit_mode = :prompt_inherit_mode
                    WHERE admin_area_id = :admin_area_id AND group_seq = :group_seq
                """),
                {
                    "display_name": data["display_name"],
                    "summary": data["summary"],
                    "description": data["description"],
                    "persona_tag": data["persona_tag"],
                    "theme_code": data["theme_code"],
                    "image_prompt_base": data["image_prompt_base"],
                    "image_prompt_negative": data["image_prompt_negative"],
                    "prompt_inherit_mode": data["prompt_inherit_mode"],
                    "admin_area_id": ADMIN_AREA_ID,
                    "group_seq": seq,
                }
            )
            print(f"  OK: group [{seq:02d}] {data['display_name']}")

        print("[3/3] world_partition 업데이트 (222개 파티션)...")
        # 각 파티션의 group_seq를 가져와 variants 적용
        partitions = await session.execute(
            text("""
                SELECT p.id, p.partition_seq, p.texture_profile,
                       g.persona_tag as group_persona, g.group_seq
                FROM world_partition p
                JOIN world_partition_group_member m ON m.partition_id = p.id
                JOIN world_partition_group g ON g.id = m.group_id
                WHERE p.admin_area_id = :admin_area_id
                ORDER BY g.group_seq, p.partition_seq
            """),
            {"admin_area_id": ADMIN_AREA_ID}
        )
        rows = partitions.mappings().all()

        updated = 0
        for row in rows:
            persona = row["group_persona"]
            variants = PARTITION_VARIANTS.get(persona)
            if not variants:
                continue

            variant = variants[(row["partition_seq"] - 1) % len(variants)]
            p_persona, p_summary, p_description, p_prompt_append = variant

            texture = row["texture_profile"] or ""
            texture_hint = TEXTURE_PROMPT_APPEND.get(texture, "")
            full_append = f"{p_prompt_append}, {texture_hint}" if texture_hint else p_prompt_append

            await session.execute(
                text("""
                    UPDATE world_partition SET
                        persona_tag = :persona_tag,
                        summary = :summary,
                        description = :description,
                        image_prompt_append = :image_prompt_append
                    WHERE id = :id
                """),
                {
                    "id": row["id"],
                    "persona_tag": p_persona,
                    "summary": p_summary,
                    "description": p_description,
                    "image_prompt_append": full_append,
                }
            )
            updated += 1

        await session.commit()
        print(f"  OK: {updated}개 파티션 업데이트 완료")
        print("[DONE] 전체 업데이트 완료.")


if __name__ == "__main__":
    asyncio.run(run_updates())
