# AiSogeThing 개발 컨벤션 (Coding Convention)

이 문서는 프로젝트의 코드 일관성과 유지보수성을 위해 반드시 지켜야 할 규칙들을 정의합니다.

---

## 1. Backend (Python/SQLAlchemy)

### 1.1 SQL 파라미터 바인딩 (SQL Parameter Binding)

**규칙 (Rule):**
`execute()` 함수를 사용하여 Raw SQL 쿼리를 실행할 때, 위치 기반 파라미터(`%s`, `?`) 대신 반드시 **명시적 네임드 파라미터(Explicit Named Parameter Binding)** 문법을 사용해야 합니다.

**이유 (Reasoning):**
1.  **가독성 (Readability)**: `:변수명`과 딕셔너리의 `Key`가 일치하여, 어떤 데이터가 어디에 들어가는지 직관적으로 파악할 수 있습니다.
2.  **안전성 (Safety)**: 파라미터의 순서가 바뀌거나 중간에 새로운 필드가 추가되어도, 데이터가 잘못된 컬럼에 들어가는 휴먼 에러를 방지합니다.
3.  **유지보수 (Maintainability)**: 쿼리 수정 시 `VALUES` 절과 딕셔너리만 수정하면 되므로 관리가 용이합니다.

**✅ Good Case (권장):**
```python
await execute(
    """
    INSERT INTO user_logs (user_id, content_type, action)
    VALUES (:user_id, 'youtube', :action)
    """,
    {
        "user_id": user_id, 
        "action": "view"
    }
)
```

**❌ Bad Case (금지):**
```python
# 순서가 헷갈리고 가독성이 떨어짐
await execute(
    "INSERT INTO user_logs (user_id, content_type, action) VALUES (%s, 'youtube', %s)",
    (user_id, "view")
)
```
