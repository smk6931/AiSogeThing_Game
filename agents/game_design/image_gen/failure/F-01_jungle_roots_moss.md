# Title: F-01 Jungle txt2img — roots/moss 키워드 실패
Description: 정글 바닥 텍스처 생성 시 roots/moss/vines 키워드와 isometric 2.5D 조합이 사이드뷰 씬을 생성한 실패 케이스.
When-To-Read: 정글/숲 바닥 텍스처 생성 시 반드시 읽는다
Keywords: failure, jungle, roots, moss, vines, sideview, isometric, 2.5d
Priority: high

**날짜**: 2026-04-21

---

## 실패 프롬프트 (절대 사용 금지)

```
"isometric 2.5D top-down view, dense jungle floor,
tangled tree roots spreading flat, fallen tropical leaves,
muddy narrow footpaths between roots, hanging vines touching ground..."
```

---

## 실패 원인

`isometric 2.5D` + `jungle` + `tree roots` + `hanging vines` 조합  
→ 모델이 "숲 씬을 비스듬히 바라보는 구도"로 해석  
→ 나무 옆면이 보이는 완전한 사이드뷰 생성  
→ topdown 아님

---

## 교훈 및 대안

| 금지 | 대체 |
|------|------|
| `isometric 2.5D` + 정글 | `strict 90 degree top-down overhead view` |
| `tree roots`, `hanging vines` | 삭제 또는 `flat roots on soil`로 약화 |
| `tangled`, `dense jungle` | `jungle floor texture`, `moss-covered soil` |

### 정글 계열 올바른 프롬프트 방향

```
strict 90 degree top-down overhead view, flat ground plane fills entire frame,
fantasy RPG jungle floor texture, seamless tileable ground,
thick moss-covered earth viewed from directly above,
muddy footpath dirt, shallow puddles on jungle floor,
deep greens and dark browns, dappled light patches on ground,
painterly hand-drawn game art, high detail, ground surface only
```

Negative에 반드시 추가:
```
tree trunks, tree canopy, tall trees, side view of trees, forest scene,
tall structures, sky, horizon, perspective, angled camera, side view
```
