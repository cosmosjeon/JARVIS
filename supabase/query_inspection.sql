-- Supabase SQL Editor용 데이터 구조 및 현황 조회 스크립트
-- 각 블록은 독립적으로 실행 가능하며, 필요에 따라 주석을 제거해 사용하세요.

-- 1. public 스키마의 테이블 목록 조회
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

[
  {
    "table_name": "folders"
  },
  {
    "table_name": "memos"
  },
  {
    "table_name": "nodes"
  },
  {
    "table_name": "tree_viewport_states"
  },
  {
    "table_name": "trees"
  }
]

-- 2. 각 테이블의 컬럼 정의 조회
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
[
  {
    "table_name": "folders",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "folders",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "folders",
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "folders",
    "column_name": "parent_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "folders",
    "column_name": "created_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": "(EXTRACT(epoch FROM now()) * (1000)::numeric)"
  },
  {
    "table_name": "folders",
    "column_name": "updated_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": "(EXTRACT(epoch FROM now()) * (1000)::numeric)"
  },
  {
    "table_name": "folders",
    "column_name": "deleted_at",
    "data_type": "bigint",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "tree_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "node_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "content",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "position_x",
    "data_type": "real",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "position_y",
    "data_type": "real",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "created_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "updated_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "memos",
    "column_name": "deleted_at",
    "data_type": "bigint",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "tree_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "parent_id",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "keyword",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "question",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "answer",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "order_index",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_name": "nodes",
    "column_name": "created_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "updated_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "deleted_at",
    "data_type": "bigint",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "conversation",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb"
  },
  {
    "table_name": "nodes",
    "column_name": "node_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "'question'::text"
  },
  {
    "table_name": "nodes",
    "column_name": "memo_parent_id",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "memo_title",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "memo_content",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "nodes",
    "column_name": "memo_metadata",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "tree_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "viewport_data",
    "data_type": "jsonb",
    "is_nullable": "NO",
    "column_default": "'{}'::jsonb"
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "created_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": "(EXTRACT(epoch FROM now()) * (1000)::numeric)"
  },
  {
    "table_name": "tree_viewport_states",
    "column_name": "updated_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": "(EXTRACT(epoch FROM now()) * (1000)::numeric)"
  },
  {
    "table_name": "trees",
    "column_name": "id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "title",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "created_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "updated_at",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "deleted_at",
    "data_type": "bigint",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "trees",
    "column_name": "folder_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  }
]

-- 3. 테이블별 예상 레코드 수 및 통계 (pg_stat 기반)
SELECT
  relname AS table_name,
  n_live_tup AS approximate_rows,
  n_dead_tup AS dead_rows,
  last_analyze,
  last_autovacuum
FROM pg_stat_all_tables
WHERE schemaname = 'public'
ORDER BY approximate_rows DESC;
[
  {
    "table_name": "nodes",
    "approximate_rows": 1507,
    "dead_rows": 257,
    "last_analyze": null,
    "last_autovacuum": "2025-10-11 17:49:01.292475+00"
  },
  {
    "table_name": "trees",
    "approximate_rows": 924,
    "dead_rows": 114,
    "last_analyze": null,
    "last_autovacuum": "2025-10-10 23:47:39.209401+00"
  },
  {
    "table_name": "tree_viewport_states",
    "approximate_rows": 64,
    "dead_rows": 19,
    "last_analyze": null,
    "last_autovacuum": "2025-10-12 21:58:33.113209+00"
  },
  {
    "table_name": "folders",
    "approximate_rows": 21,
    "dead_rows": 0,
    "last_analyze": null,
    "last_autovacuum": null
  },
  {
    "table_name": "memos",
    "approximate_rows": 9,
    "dead_rows": 0,
    "last_analyze": null,
    "last_autovacuum": null
  }
]

-- 4. 주요 도메인 테이블 실 레코드 수 집계
SELECT 'folders' AS table_name, COUNT(*) AS row_count FROM public.folders
UNION ALL
SELECT 'trees', COUNT(*) FROM public.trees
UNION ALL
SELECT 'nodes', COUNT(*) FROM public.nodes
UNION ALL
SELECT 'memos', COUNT(*) FROM public.memos
UNION ALL
SELECT 'tree_viewport_states', COUNT(*) FROM public.tree_viewport_states
ORDER BY table_name;
[
  {
    "table_name": "folders",
    "row_count": 21
  },
  {
    "table_name": "memos",
    "row_count": 9
  },
  {
    "table_name": "nodes",
    "row_count": 1507
  },
  {
    "table_name": "tree_viewport_states",
    "row_count": 64
  },
  {
    "table_name": "trees",
    "row_count": 924
  }
]

-- 5. 최신 업데이트 기준 상위 노드 100건 확인 (필요 시 LIMIT 조정)
SELECT *
FROM public.nodes
ORDER BY updated_at DESC
LIMIT 100;
[
  {
    "id": "node_1760306410568_hehrahp5b",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "placeholder_1760306382411_0_h2n2mjx9",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요? 필요한 내용이 있으면 편하게 말씀해 주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306410568,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요? 필요한 내용이 있으면 편하게 말씀해 주세요.",
        "content": "안녕하세요! 무엇을 도와드릴까요? 필요한 내용이 있으면 편하게 말씀해 주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760306382411_0_h2n2mjx9",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306479588_nc9yml4ks",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760306479572_s050mo1tk",
    "keyword": "이",
    "question": "이",
    "answer": "어떤 도움을 드릴까요? 조금 더 자세히 알려주시면 빠르게 도와드릴게요.\n\n예를 들어:\n- 문장/문서 번역\n- 글 다듬기 또는 작성\n- 코드 작성/디버깅\n- 개념 설명\n- 일정·여행·학습 계획 세우기\n\n원하시는 내용을 한두 문장으로 적어주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306479588,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "이",
        "content": "이"
      },
      {
        "role": "assistant",
        "text": "어떤 도움을 드릴까요? 조금 더 자세히 알려주시면 빠르게 도와드릴게요.\n\n예를 들어:\n- 문장/문서 번역\n- 글 다듬기 또는 작성\n- 코드 작성/디버깅\n- 개념 설명\n- 일정·여행·학습 계획 세우기\n\n원하시는 내용을 한두 문장으로 적어주세요.",
        "content": "어떤 도움을 드릴까요? 조금 더 자세히 알려주시면 빠르게 도와드릴게요.\n\n예를 들어:\n- 문장/문서 번역\n- 글 다듬기 또는 작성\n- 코드 작성/디버깅\n- 개념 설명\n- 일정·여행·학습 계획 세우기\n\n원하시는 내용을 한두 문장으로 적어주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306479572_s050mo1tk",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759960076717_e4is0bcql",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "placeholder_1759940387647_2_1e483g",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759960076717,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "content": "안녕하세요! 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759940387647_2_1e483g",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306410589_pw5k8hg21",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760306410568_hehrahp5b",
    "keyword": "이",
    "question": "이",
    "answer": "어떤 도움을 원하시는지 알려주실 수 있을까요? 혹시 “이”의 의미나 사용법을 찾으시는 건가요? 간단히 정리하면:\n\n- 지시 대명사: “이 책”처럼 가까운 것을 가리킬 때\n- 주격 조사: 자음으로 끝나는 말 뒤에 붙는 ‘이’(예: “책이 있다”)\n- 명사: 이(齒) = 치아\n- 성씨: 이/리(李)\n\n원하는 것이 맞다면 더 자세히 설명해 드릴게요. 아니면 실수로 입력하신 거라면 필요한 내용을 말씀해 주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306410589,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "이",
        "content": "이"
      },
      {
        "role": "assistant",
        "text": "어떤 도움을 원하시는지 알려주실 수 있을까요? 혹시 “이”의 의미나 사용법을 찾으시는 건가요? 간단히 정리하면:\n\n- 지시 대명사: “이 책”처럼 가까운 것을 가리킬 때\n- 주격 조사: 자음으로 끝나는 말 뒤에 붙는 ‘이’(예: “책이 있다”)\n- 명사: 이(齒) = 치아\n- 성씨: 이/리(李)\n\n원하는 것이 맞다면 더 자세히 설명해 드릴게요. 아니면 실수로 입력하신 거라면 필요한 내용을 말씀해 주세요.",
        "content": "어떤 도움을 원하시는지 알려주실 수 있을까요? 혹시 “이”의 의미나 사용법을 찾으시는 건가요? 간단히 정리하면:\n\n- 지시 대명사: “이 책”처럼 가까운 것을 가리킬 때\n- 주격 조사: 자음으로 끝나는 말 뒤에 붙는 ‘이’(예: “책이 있다”)\n- 명사: 이(齒) = 치아\n- 성씨: 이/리(李)\n\n원하는 것이 맞다면 더 자세히 설명해 드릴게요. 아니면 실수로 입력하신 거라면 필요한 내용을 말씀해 주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306410568_hehrahp5b",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306500883_1a5yd5nyi",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760306479588_nc9yml4ks",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306500883,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "content": "안녕하세요! 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306479588_nc9yml4ks",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760306382411_0_h2n2mjx9",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760293066862_qv4wihklh",
    "keyword": "는 ChatGPT",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요? 궁금한 것이나 필요한 작업을 알려주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306382411,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요? 궁금한 것이나 필요한 작업을 알려주세요.",
        "content": "안녕하세요! 무엇을 도와드릴까요? 궁금한 것이나 필요한 작업을 알려주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760293066862_qv4wihklh",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760293066862_qv4wihklh",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "placeholder_1760293021838_1_xqnx3vy8",
    "keyword": "너 이름이 뭐야?",
    "question": "너 이름이 뭐야?",
    "answer": "저는 ChatGPT예요. 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760293066862,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "너 이름이 뭐야?",
        "content": "너 이름이 뭐야?"
      },
      {
        "role": "assistant",
        "text": "저는 ChatGPT예요. 무엇을 도와드릴까요?",
        "content": "저는 ChatGPT예요. 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760293021838_1_xqnx3vy8",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760306382411_1_nh92dq5i",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760293066862_qv4wihklh",
    "keyword": ". 무엇을 도와드릴까",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760306382412,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760293066862_qv4wihklh",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306479572_s050mo1tk",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1760306410589_pw5k8hg21",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?  \n예: 번역, 글쓰기/이력서 도움, 코딩/디버깅, 여행 계획, 공부/설명, 아이디어 브레인스토밍 등.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306479572,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?  \n예: 번역, 글쓰기/이력서 도움, 코딩/디버깅, 여행 계획, 공부/설명, 아이디어 브레인스토밍 등.",
        "content": "안녕하세요! 무엇을 도와드릴까요?  \n예: 번역, 글쓰기/이력서 도움, 코딩/디버깅, 여행 계획, 공부/설명, 아이디어 브레인스토밍 등."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306410589_pw5k8hg21",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760293021838_1_xqnx3vy8",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1759960076717_e4is0bcql",
    "keyword": "도와드릴까요?",
    "question": "도와드릴까요?",
    "answer": "안녕하세요! 무엇을 도와드릴까요? \n\n어떤 부분에서 도움이 필요하신지 구체적으로 말씀해 주시면, 최선을 다해 도와드리겠습니다. 😊",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760293021839,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "나좀 도와줘",
        "content": "나좀 도와줘"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요? \n\n어떤 부분에서 도움이 필요하신지 구체적으로 말씀해 주시면, 최선을 다해 도와드리겠습니다. 😊",
        "content": "안녕하세요! 무엇을 도와드릴까요? \n\n어떤 부분에서 도움이 필요하신지 구체적으로 말씀해 주시면, 최선을 다해 도와드리겠습니다. 😊"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759960076717_e4is0bcql",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760293021838_0_aw3a5ovn",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "f25e3512-f819-4dbe-96b3-0fc31deb8524",
    "parent_id": "node_1759960076717_e4is0bcql",
    "keyword": "안녕하세요!",
    "question": "안녕하세요!",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760293021838,
    "updated_at": 1760319307904,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕하세요!",
        "content": "안녕하세요!"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759960076717_e4is0bcql",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "root_3b9da3a2-32df-49bb-94f4-870880d904dd",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1760314840313_56c4d041",
    "parent_id": null,
    "keyword": "ㅏㅏ",
    "question": "ㅏㅏ",
    "answer": "이 입력은 한글 자음 'ㅏ'를 두 번 반복한 것 같습니다. 'ㅏ'는 한글 모음 중 하나로, 발음은 \"아\"와 비슷합니다. 추가로 도와드릴 것이 있나요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760314839479,
    "updated_at": 1760314842907,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅏㅏ",
        "content": "ㅏㅏ"
      },
      {
        "role": "assistant",
        "text": "이 입력은 한글 자음 'ㅏ'를 두 번 반복한 것 같습니다. 'ㅏ'는 한글 모음 중 하나로, 발음은 \"아\"와 비슷합니다. 추가로 도와드릴 것이 있나요?",
        "content": "이 입력은 한글 자음 'ㅏ'를 두 번 반복한 것 같습니다. 'ㅏ'는 한글 모음 중 하나로, 발음은 \"아\"와 비슷합니다. 추가로 도와드릴 것이 있나요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": null,
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_5_wi41nmc9",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "6904fd64-f273-429f-abef-44910819d783",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "니다.",
    "question": "리액트랑 리액트 네이티브 차이가 뭐야?",
    "answer": "리액트(React)와 리액트 네이티브(React Native)의 주요 차이점은 다음과 같습니다:\n\n1. 렌더링 대상\n- 리액트: 웹 브라우저에서 웹 애플리케이션 렌더링\n- 리액트 네이티브: 모바일 기기의 네이티브 컴포넌트 렌더링\n\n2. 사용 환경\n- 리액트: 웹 개발\n- 리액트 네이티브: 모바일 앱 개발 (iOS, Android)\n\n3. UI 컴포넌트\n- 리액트: HTML 태그 사용 (div, span 등)\n- 리액트 네이티브: 모바일 전용 컴포넌트 사용 (View, Text 등)\n\n4. 스타일링\n- 리액트: CSS 사용\n- 리액트 네이티브: StyleSheet 객체 사용\n\n5. 성능\n- 리액트 네이티브: 네이티브 컴포넌트로 인해 더 나은 모바일 성능\n\n기본 개념과 문법은 매우 유사합니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760314762980,
    "updated_at": 1760314819722,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "리액트랑 리액트 네이티브 차이가 뭐야?",
        "content": "리액트랑 리액트 네이티브 차이가 뭐야?",
        "timestamp": 1760314814548
      },
      {
        "role": "assistant",
        "text": "리액트(React)와 리액트 네이티브(React Native)의 주요 차이점은 다음과 같습니다:\n\n1. 렌더링 대상\n- 리액트: 웹 브라우저에서 웹 애플리케이션 렌더링\n- 리액트 네이티브: 모바일 기기의 네이티브 컴포넌트 렌더링\n\n2. 사용 환경\n- 리액트: 웹 개발\n- 리액트 네이티브: 모바일 앱 개발 (iOS, Android)\n\n3. UI 컴포넌트\n- 리액트: HTML 태그 사용 (div, span 등)\n- 리액트 네이티브: 모바일 전용 컴포넌트 사용 (View, Text 등)\n\n4. 스타일링\n- 리액트: CSS 사용\n- 리액트 네이티브: StyleSheet 객체 사용\n\n5. 성능\n- 리액트 네이티브: 네이티브 컴포넌트로 인해 더 나은 모바일 성능\n\n기본 개념과 문법은 매우 유사합니다.",
        "usage": {
          "input_tokens": 32,
          "service_tier": "standard",
          "output_tokens": 349,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "리액트(React)와 리액트 네이티브(React Native)의 주요 차이점은 다음과 같습니다:\n\n1. 렌더링 대상\n- 리액트: 웹 브라우저에서 웹 애플리케이션 렌더링\n- 리액트 네이티브: 모바일 기기의 네이티브 컴포넌트 렌더링\n\n2. 사용 환경\n- 리액트: 웹 개발\n- 리액트 네이티브: 모바일 앱 개발 (iOS, Android)\n\n3. UI 컴포넌트\n- 리액트: HTML 태그 사용 (div, span 등)\n- 리액트 네이티브: 모바일 전용 컴포넌트 사용 (View, Text 등)\n\n4. 스타일링\n- 리액트: CSS 사용\n- 리액트 네이티브: StyleSheet 객체 사용\n\n5. 성능\n- 리액트 네이티브: 네이티브 컴포넌트로 인해 더 나은 모바일 성능\n\n기본 개념과 문법은 매우 유사합니다.",
        "modelInfo": {
          "model": "claude-3-5-haiku-20241022",
          "provider": "claude"
        },
        "timestamp": 1760314814549
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760314754072_goj1ra56n",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314720864_n8ltgyu5p",
    "keyword": "넌 누구니",
    "question": "넌 누구니",
    "answer": "저는 OpenAI가 만든 인공지능 언어 모델, 챗GPT예요. 질문에 답하고 글쓰기·번역·요약·코딩·문제 해결 등 여러 도움을 드릴 수 있어요. 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760314754072,
    "updated_at": 1760314784587,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "넌 누구니",
        "content": "넌 누구니",
        "timestamp": 1760314754072
      },
      {
        "role": "assistant",
        "text": "저는 OpenAI가 만든 인공지능 언어 모델, 챗GPT예요. 질문에 답하고 글쓰기·번역·요약·코딩·문제 해결 등 여러 도움을 드릴 수 있어요. 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 10,
          "total_tokens": 264,
          "output_tokens": 254,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 192
          }
        },
        "status": "complete",
        "content": "저는 Anthropic에서 개발한 Claude라는 AI 어시스턴트입니다. 제 목표는 도움이 되고 유용한 대화를 나누는 것입니다.",
        "modelInfo": {
          "model": "gpt-5-mini-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760314774782
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760314720864_n8ltgyu5p",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_0_3t7nzndn",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "는",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760314762975,
    "updated_at": 1760314762975,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_3_q8fvlft7",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "라는 AI 어시",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760314762978,
    "updated_at": 1760314762975,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_1_rpnvikxx",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "ro",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760314762976,
    "updated_at": 1760314762975,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_4_0nro9sqp",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "스턴",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760314762979,
    "updated_at": 1760314762975,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760314762975_2_3sfadb4n",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760314754072_goj1ra56n",
    "keyword": "발한 C",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760314762977,
    "updated_at": 1760314762975,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1760314754072_goj1ra56n",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760314734674_fnbqqfzzc",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1760139350651_29cb9809",
    "parent_id": "placeholder_1760198183321_0_q8yv67t5",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760314734674,
    "updated_at": 1760314735568,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760314734674
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 11,
          "service_tier": "standard",
          "output_tokens": 25,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "claude-3-5-haiku-20241022",
          "provider": "claude"
        },
        "timestamp": 1760314734675
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760198183321_0_q8yv67t5",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760314720864_n8ltgyu5p",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932241627_0_b1phwp",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 어떤 도움이 필요하신가요? 제가 도와드리겠습니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760314720864,
    "updated_at": 1760314722035,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760314720864
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 어떤 도움이 필요하신가요? 제가 도와드리겠습니다.",
        "usage": {
          "input_tokens": 11,
          "service_tier": "standard",
          "output_tokens": 41,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "안녕하세요! 어떤 도움이 필요하신가요? 제가 도와드리겠습니다.",
        "modelInfo": {
          "model": "claude-3-5-haiku-20241022",
          "provider": "claude"
        },
        "timestamp": 1760314720865
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932241627_0_b1phwp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932241627_0_b1phwp",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_4_e10l01",
    "keyword": "생",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760314718589,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760314717590
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 10,
          "service_tier": "standard",
          "output_tokens": 25,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "claude-3-5-haiku-20241022",
          "provider": "claude"
        },
        "timestamp": 1760314717591
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_4_e10l01",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760307477315_4ek0sdh81",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "node_1760307463662_4svvxvyob",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760307477315,
    "updated_at": 1760307484101,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760307477315
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "totalTokenCount": 736,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 726,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 8
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gemini-2.5-pro",
          "provider": "gemini"
        },
        "timestamp": 1760307477316
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760307463662_4svvxvyob",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760307463662_4svvxvyob",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "node_1760307453361_4ns33bwvs",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760307463662,
    "updated_at": 1760307471284,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760307463662
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "totalTokenCount": 825,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 815,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 8
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gemini-2.5-pro",
          "provider": "gemini"
        },
        "timestamp": 1760307463663
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760307453361_4ns33bwvs",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760307453361_4ns33bwvs",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "placeholder_1760296848343_3_pjv5ztnp",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 😊",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760307453361,
    "updated_at": 1760307456148,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760307453361
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 😊",
        "usage": {
          "totalTokenCount": 388,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 383,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 3
        },
        "status": "complete",
        "content": "안녕하세요! 😊",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760307453362
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760296848343_3_pjv5ztnp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760306683773_2_1gd4kvhq",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "node_1760306676858_0bf9a5jk3",
    "keyword": "도와",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306683775,
    "updated_at": 1760306703376,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760306700123
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 89,
          "output_tokens": 81,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 64
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306700124
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306676858_0bf9a5jk3",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760306683773_1_wsbpghih",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "node_1760306676858_0bf9a5jk3",
    "keyword": "요! 무",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306683774,
    "updated_at": 1760306701439,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760306697031
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 153,
          "output_tokens": 145,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 128
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306697032
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306676858_0bf9a5jk3",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760306683773_0_spdw7vhn",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "node_1760306676858_0bf9a5jk3",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306683773,
    "updated_at": 1760306695952,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760306690223
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 25,
          "output_tokens": 17,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 0
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306690224
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306676858_0bf9a5jk3",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306676858_0bf9a5jk3",
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_id": "93c4410e-6b50-44ea-bc9a-f2617973d844",
    "parent_id": "placeholder_1760296848343_0_6w28fwn8",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306676858,
    "updated_at": 1760306679644,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760306676858
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 25,
          "output_tokens": 17,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 0
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306676859
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760296848343_0_6w28fwn8",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306109042_9cllgwgzl",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760306109015_4xcl57bzl",
    "keyword": "녕",
    "question": "녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306109042,
    "updated_at": 1760306113414,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "녕",
        "content": "녕",
        "timestamp": 1760306109042
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 7,
          "total_tokens": 152,
          "output_tokens": 145,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 128
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306109043
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760306109015_4xcl57bzl",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760306109015_4xcl57bzl",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302172508_0_hf48jto3",
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760306109015,
    "updated_at": 1760306111300,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕",
        "timestamp": 1760306109015
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 25,
          "output_tokens": 17,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 0
          }
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760306109016
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302172508_0_hf48jto3",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760102612900_udoa7m714",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932316495_asdtnh2wi",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 만나서 반가워요. 어떻게 도와드릴까요? 원하는 언어나 주제가 있으면 말씀해 주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760102612900,
    "updated_at": 1760303266522,
    "deleted_at": null,
    "conversation": [
      {
        "role": "assistant",
        "text": "안녕하세요! 만나서 반가워요. 어떻게 도와드릴까요? 원하는 언어나 주제가 있으면 말씀해 주세요.",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 106,
          "output_tokens": 98,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 64
          }
        },
        "status": "complete",
        "content": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-mini-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760303262878
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 만나서 반가워요. 어떻게 도와드릴까요? 원하는 언어나 주제가 있으면 말씀해 주세요.",
        "usage": {
          "input_tokens": 8,
          "total_tokens": 106,
          "output_tokens": 98,
          "input_tokens_details": {
            "cached_tokens": 0
          },
          "output_tokens_details": {
            "reasoning_tokens": 64
          }
        },
        "status": "complete",
        "content": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gpt-5-mini-2025-08-07",
          "provider": "openai"
        },
        "timestamp": 1760303262878
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932316495_asdtnh2wi",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302796164_3_cmohwtbv",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302160711_3_qigx0npp",
    "keyword": "릴까요",
    "question": "릴까요",
    "answer": "저는 구글에서 훈련한 대규모 언어 모델입니다.\n\n궁금한 점이 있으시면 무엇이든 물어보세요!",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302796167,
    "updated_at": 1760302823449,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "누구세요",
        "content": "누구세요",
        "timestamp": 1760302819109
      },
      {
        "role": "assistant",
        "text": "저는 구글에서 훈련한 대규모 언어 모델입니다.\n\n궁금한 점이 있으시면 무엇이든 물어보세요!",
        "usage": {
          "totalTokenCount": 760,
          "promptTokenCount": 4,
          "thoughtsTokenCount": 726,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 4
            }
          ],
          "candidatesTokenCount": 30
        },
        "status": "complete",
        "content": "저는 구글에서 훈련한 대규모 언어 모델입니다.\n\n궁금한 점이 있으시면 무엇이든 물어보세요!",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302819110
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302160711_3_qigx0npp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302796164_2_j48nta9c",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302160711_3_qigx0npp",
    "keyword": "을 도와",
    "question": "을 도와",
    "answer": "저는 Google에서 훈련한 대규모 언어 모델입니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302796166,
    "updated_at": 1760302818281,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "누구세요",
        "content": "누구세요",
        "timestamp": 1760302815863
      },
      {
        "role": "assistant",
        "text": "저는 Google에서 훈련한 대규모 언어 모델입니다.",
        "usage": {
          "totalTokenCount": 366,
          "promptTokenCount": 4,
          "thoughtsTokenCount": 349,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 4
            }
          ],
          "candidatesTokenCount": 13
        },
        "status": "complete",
        "content": "저는 Google에서 훈련한 대규모 언어 모델입니다.",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302815864
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302160711_3_qigx0npp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302796164_1_o5ubgjek",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302160711_3_qigx0npp",
    "keyword": "세요. 무엇",
    "question": "세요. 무엇",
    "answer": "저는 Google에서 훈련한 대규모 언어 모델입니다. 질문에 답하고 정보를 제공하며 다양한 작업을 돕는 인공지능입니다.\n\n궁금한 점이 있으시면 언제든지 물어보세요!",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302796165,
    "updated_at": 1760302813708,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "누구세요",
        "content": "누구세요",
        "timestamp": 1760302810539
      },
      {
        "role": "assistant",
        "text": "저는 Google에서 훈련한 대규모 언어 모델입니다. 질문에 답하고 정보를 제공하며 다양한 작업을 돕는 인공지능입니다.\n\n궁금한 점이 있으시면 언제든지 물어보세요!",
        "usage": {
          "totalTokenCount": 518,
          "promptTokenCount": 4,
          "thoughtsTokenCount": 468,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 4
            }
          ],
          "candidatesTokenCount": 46
        },
        "status": "complete",
        "content": "저는 Google에서 훈련한 대규모 언어 모델입니다. 질문에 답하고 정보를 제공하며 다양한 작업을 돕는 인공지능입니다.\n\n궁금한 점이 있으시면 언제든지 물어보세요!",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302810540
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302160711_3_qigx0npp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302796164_0_ur95xhug",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302160711_3_qigx0npp",
    "keyword": "네, 말씀",
    "question": "네, 말씀",
    "answer": "저는 구글에서 훈련한 대규모 언어 모델(Large Language Model)입니다.\n\n궁금한 점을 도와드리거나 정보를 제공해 드릴 수 있습니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302796164,
    "updated_at": 1760302805248,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "누구세요",
        "content": "누구세요",
        "timestamp": 1760302802205
      },
      {
        "role": "assistant",
        "text": "저는 구글에서 훈련한 대규모 언어 모델(Large Language Model)입니다.\n\n궁금한 점을 도와드리거나 정보를 제공해 드릴 수 있습니다.",
        "usage": {
          "totalTokenCount": 482,
          "promptTokenCount": 4,
          "thoughtsTokenCount": 443,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 4
            }
          ],
          "candidatesTokenCount": 35
        },
        "status": "complete",
        "content": "저는 구글에서 훈련한 대규모 언어 모델(Large Language Model)입니다.\n\n궁금한 점을 도와드리거나 정보를 제공해 드릴 수 있습니다.",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302802206
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302160711_3_qigx0npp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302160711_3_qigx0npp",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "keyword": "드릴",
    "question": "드릴",
    "answer": "네, 말씀하세요. 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302160714,
    "updated_at": 1760302787725,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "얌마",
        "content": "얌마",
        "timestamp": 1760302778831
      },
      {
        "role": "assistant",
        "text": "네, 말씀하세요. 무엇을 도와드릴까요?",
        "usage": {
          "totalTokenCount": 1328,
          "promptTokenCount": 3,
          "thoughtsTokenCount": 1314,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 3
            }
          ],
          "candidatesTokenCount": 11
        },
        "status": "complete",
        "content": "네, 말씀하세요. 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302778832
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760302192917_35v1ncijv",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760302192871_tp0dprm49",
    "keyword": "이",
    "question": "이",
    "answer": "안녕하세요! '이'는 한국어에서 여러 가지 의미로 사용될 수 있어서, 어떤 맥락에서 말씀하신 건지 알려주시면 더 정확한 답변을 드릴 수 있습니다.\n\n가장 흔한 몇 가지 의미는 다음과 같습니다:\n\n1.  **지시 대명사/관형사 (This):**\n    *   **이**것 (this thing)\n    *   **이** 사람 (this person)\n    *   **이** 책 (this book)\n\n2.  **조사 (Subject Particle):**\n    *   받침이 있는 명사 뒤에 붙어 주어를 나타냅니다. (예: 책**이** 좋다, 집**이** 크다)\n    *   (받침이 없는 명사 뒤에는 '가'가 붙습니다. 예: 사과**가** 맛있다)\n\n3.  **명사 (Tooth):**\n    *   **이**가 아프다 (My tooth hurts)\n    *   **이**를 닦다 (Brush one's teeth)\n\n4.  **명사 (Louse - 이):**\n    *   머리에 **이**가 생겼다 (Got lice in the hair)\n\n5.  **성씨 (Surname Lee/Yi):**\n    *   **이**순신 (Yi Sun-sin)\n    *   **이** 씨 (Mr./Ms. Lee)\n\n6.  **숫자 (Two - 한자어):**\n    *   **이**층 (second floor)\n    *   **이**인분 (two servings)\n\n어떤 의미로 '이'라고 하셨나요? 😊",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302192917,
    "updated_at": 1760302202073,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "이",
        "content": "이",
        "timestamp": 1760302192917
      },
      {
        "role": "assistant",
        "text": "안녕하세요! '이'는 한국어에서 여러 가지 의미로 사용될 수 있어서, 어떤 맥락에서 말씀하신 건지 알려주시면 더 정확한 답변을 드릴 수 있습니다.\n\n가장 흔한 몇 가지 의미는 다음과 같습니다:\n\n1.  **지시 대명사/관형사 (This):**\n    *   **이**것 (this thing)\n    *   **이** 사람 (this person)\n    *   **이** 책 (this book)\n\n2.  **조사 (Subject Particle):**\n    *   받침이 있는 명사 뒤에 붙어 주어를 나타냅니다. (예: 책**이** 좋다, 집**이** 크다)\n    *   (받침이 없는 명사 뒤에는 '가'가 붙습니다. 예: 사과**가** 맛있다)\n\n3.  **명사 (Tooth):**\n    *   **이**가 아프다 (My tooth hurts)\n    *   **이**를 닦다 (Brush one's teeth)\n\n4.  **명사 (Louse - 이):**\n    *   머리에 **이**가 생겼다 (Got lice in the hair)\n\n5.  **성씨 (Surname Lee/Yi):**\n    *   **이**순신 (Yi Sun-sin)\n    *   **이** 씨 (Mr./Ms. Lee)\n\n6.  **숫자 (Two - 한자어):**\n    *   **이**층 (second floor)\n    *   **이**인분 (two servings)\n\n어떤 의미로 '이'라고 하셨나요? 😊",
        "usage": {
          "totalTokenCount": 1335,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 974,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 359
        },
        "status": "complete",
        "content": "안녕하세요! '이'는 한국어에서 여러 가지 의미로 사용될 수 있어서, 어떤 맥락에서 말씀하신 건지 알려주시면 더 정확한 답변을 드릴 수 있습니다.\n\n가장 흔한 몇 가지 의미는 다음과 같습니다:\n\n1.  **지시 대명사/관형사 (This):**\n    *   **이**것 (this thing)\n    *   **이** 사람 (this person)\n    *   **이** 책 (this book)\n\n2.  **조사 (Subject Particle):**\n    *   받침이 있는 명사 뒤에 붙어 주어를 나타냅니다. (예: 책**이** 좋다, 집**이** 크다)\n    *   (받침이 없는 명사 뒤에는 '가'가 붙습니다. 예: 사과**가** 맛있다)\n\n3.  **명사 (Tooth):**\n    *   **이**가 아프다 (My tooth hurts)\n    *   **이**를 닦다 (Brush one's teeth)\n\n4.  **명사 (Louse - 이):**\n    *   머리에 **이**가 생겼다 (Got lice in the hair)\n\n5.  **성씨 (Surname Lee/Yi):**\n    *   **이**순신 (Yi Sun-sin)\n    *   **이** 씨 (Mr./Ms. Lee)\n\n6.  **숫자 (Two - 한자어):**\n    *   **이**층 (second floor)\n    *   **이**인분 (two servings)\n\n어떤 의미로 '이'라고 하셨나요? 😊",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302192918
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760302192871_tp0dprm49",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760302192871_tp0dprm49",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302160711_0_ae97u665",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 반갑습니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302192871,
    "updated_at": 1760302193681,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760302192871
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 반갑습니다.",
        "usage": {
          "totalTokenCount": 34,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 28,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 4
        },
        "status": "complete",
        "content": "안녕하세요! 반갑습니다.",
        "modelInfo": {
          "model": "gemini-2.5-flash",
          "provider": "gemini"
        },
        "timestamp": 1760302192872
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302160711_0_ae97u665",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302160711_0_ae97u665",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "keyword": "녕",
    "question": "녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302160711,
    "updated_at": 1760302187006,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760302179525
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "usage": {
          "totalTokenCount": 744,
          "promptTokenCount": 2,
          "thoughtsTokenCount": 734,
          "promptTokensDetails": [
            {
              "modality": "TEXT",
              "tokenCount": 2
            }
          ],
          "candidatesTokenCount": 8
        },
        "status": "complete",
        "content": "안녕하세요! 무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "gemini-2.5-pro",
          "provider": "gemini"
        },
        "timestamp": 1760302179526
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_4_l5btawfh",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "무",
    "question": "무",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172512,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "무"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_5_u09gm9rx",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "엇",
    "question": "엇",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172513,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "엇"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_0_hf48jto3",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "하",
    "question": "하",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172508,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_3_l2ckigek",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "드릴까요",
    "question": "드릴까요",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172511,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "드릴까요"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_1_n6mrk4gx",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "! 반",
    "question": "! 반",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172509,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "! 반"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302172508_2_8t0fymzo",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_1_7c1aux53",
    "keyword": "습니",
    "question": "습니",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302172510,
    "updated_at": 1760302172508,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "습니"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_1_7c1aux53",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302160711_2_fi7fp5lk",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "keyword": "니다",
    "question": "니다",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302160713,
    "updated_at": 1760302160711,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "니다"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302160711_1_w5fbr627",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "keyword": "! 반",
    "question": "! 반",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760302160712,
    "updated_at": 1760302160711,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "! 반"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1760302141950_0_tdh47sgr",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302141950_1_7c1aux53",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760210143558_8r60var9q",
    "keyword": "변:",
    "question": "변:",
    "answer": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302141951,
    "updated_at": 1760302152515,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760302149992
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 10,
          "service_tier": "standard",
          "output_tokens": 36,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "claude-sonnet-4-5-20250929",
          "provider": "claude"
        },
        "timestamp": 1760302149993
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760210143558_8r60var9q",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760302141950_0_tdh47sgr",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760210143558_8r60var9q",
    "keyword": "문: 하",
    "question": "문: 하",
    "answer": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760302141950,
    "updated_at": 1760302148911,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이",
        "timestamp": 1760302146420
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
        "usage": {
          "input_tokens": 10,
          "service_tier": "standard",
          "output_tokens": 36,
          "cache_creation": {
            "ephemeral_1h_input_tokens": 0,
            "ephemeral_5m_input_tokens": 0
          },
          "cache_read_input_tokens": 0,
          "cache_creation_input_tokens": 0
        },
        "status": "complete",
        "content": "안녕하세요! 반갑습니다. 😊\n\n무엇을 도와드릴까요?",
        "modelInfo": {
          "model": "claude-sonnet-4-5-20250929",
          "provider": "claude"
        },
        "timestamp": 1760302146421
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760210143558_8r60var9q",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760301841884_0_aehwr4rj",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "3e2883e2-ded5-418b-93f8-5840104a34bb",
    "parent_id": "node_1760289166756_68ty44y95",
    "keyword": "기분이",
    "question": "기분이",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760301841884,
    "updated_at": 1760301841884,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "기분이"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760289166756_68ty44y95",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760301841884_1_8e10fwm8",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "3e2883e2-ded5-418b-93f8-5840104a34bb",
    "parent_id": "node_1760289166756_68ty44y95",
    "keyword": "신가요? 제가",
    "question": "신가요? 제가",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760301841885,
    "updated_at": 1760301841884,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "신가요? 제가"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760289166756_68ty44y95",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760301841884_2_qaziy6vv",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "3e2883e2-ded5-418b-93f8-5840104a34bb",
    "parent_id": "node_1760289166756_68ty44y95",
    "keyword": "울 수 있는",
    "question": "울 수 있는",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760301841886,
    "updated_at": 1760301841884,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "울 수 있는"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760289166756_68ty44y95",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760198183321_1_grotemvy",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1760139350651_29cb9809",
    "parent_id": "root_4449d3a7-fdfa-48ec-9bb3-b14f392cf3d6",
    "keyword": "도와드",
    "question": "도와드",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760198183322,
    "updated_at": 1760301542308,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "도와드",
        "content": "도와드"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_4449d3a7-fdfa-48ec-9bb3-b14f392cf3d6",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "root_4449d3a7-fdfa-48ec-9bb3-b14f392cf3d6",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1760139350651_29cb9809",
    "parent_id": null,
    "keyword": "안녕",
    "question": "안녕",
    "answer": "안녕하세요! 😊\n\n무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760139346942,
    "updated_at": 1760301542308,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 😊\n\n무엇을 도와드릴까요?",
        "content": "안녕하세요! 😊\n\n무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": null,
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760198183321_0_q8yv67t5",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1760139350651_29cb9809",
    "parent_id": "root_4449d3a7-fdfa-48ec-9bb3-b14f392cf3d6",
    "keyword": "안녕하",
    "question": "안녕하",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760198183321,
    "updated_at": 1760301542308,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕하",
        "content": "안녕하"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_4449d3a7-fdfa-48ec-9bb3-b14f392cf3d6",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760210016413_mbvh0rbs5",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760210013075_9w234x47q",
    "keyword": "하이",
    "question": "하이",
    "answer": "질문: 하이\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760210144374,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "질문: 하이\n\n답변:",
        "content": "질문: 하이\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760210013075_9w234x47q",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760210143558_8r60var9q",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760210016413_mbvh0rbs5",
    "keyword": "하이",
    "question": "하이",
    "answer": "질문: 하이\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760210144374,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "질문: 하이\n\n답변:",
        "content": "질문: 하이\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760210016413_mbvh0rbs5",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932027863_1lhasb3cn",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_5_9sowsy",
    "keyword": "ㅓ",
    "question": "ㅓ",
    "answer": "질문: ㅓ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅓ",
        "content": "ㅓ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅓ\n\n답변:",
        "content": "질문: ㅓ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_5_9sowsy",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760000460830_1_mzxm6lyh",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760000452191_i83y5laax",
    "keyword": "이디어 브레인스",
    "question": "이디어 브레인스",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760000460831,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "이디어 브레인스",
        "content": "이디어 브레인스"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760000452191_i83y5laax",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932307465_g9ypqfdml",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_7_wht0qu",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_7_wht0qu",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760101922851_s05il1swi",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932329839_sbf6n4eu4",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760101922851,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
        "content": "안녕하세요! 👋\n\n무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932329839_sbf6n4eu4",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932041422_sz4vrn7v9",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_3_e1qfjm",
    "keyword": "ㅇ",
    "question": "ㅇ",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "assistant",
        "text": "질문: ㅇ\n\n답변:",
        "content": "질문: ㅇ\n\n답변:"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇ\n\n답변:",
        "content": "질문: ㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_3_e1qfjm",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932255215_0_nk5q8d",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_4_e10l01",
    "keyword": "ㄴㄴ",
    "question": "ㄴ",
    "answer": "혹시 질문이 일부만 전송된 것 같아요. 우선 “각”의 주요 의미를 간단히 정리해 드릴게요.\n\n- 기본 의미\n  - 角: 뿔, 모서리/모퉁이, 기하학의 각(angle)\n  - 各: 각각, 각자(예: 각 국, 각 분야)\n  - 覺: 깨달음(예: 각성)\n  - 閣: 누각/정자, 내각 등(건물·정부 관련 한자어)\n\n- 구어/신조어\n  - 각이다: 어떤 일이 일어날 가능성·분위기가 뚜렷함\n    예) 비 올 각, 합격각, 사과각\n  - 각 잡다: 자세나 준비를 단정히 갖추다\n  - 각 재다: 조건을 따지다/계산하다\n  - 각(이) 보인다/각 나왔다: 될 조짐이 뚜렷함\n\n- 기타\n  - 각도(사진 각도), 각이 지다(모서리가 도드라져 보이다) 등도 관련 표현으로 자주 씁니다.\n\n어떤 의미(학술적 ‘각’, ‘각자’의 각, 신조어 ‘각이다’ 등)를 더 자세히 알고 싶으신가요? 원하는 예문이나 상황을 알려주시면 맞춰 설명해 드릴게요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㄴ",
        "content": "ㄴ"
      },
      {
        "role": "assistant",
        "text": "혹시 질문이 일부만 전송된 것 같아요. 우선 “각”의 주요 의미를 간단히 정리해 드릴게요.\n\n- 기본 의미\n  - 角: 뿔, 모서리/모퉁이, 기하학의 각(angle)\n  - 各: 각각, 각자(예: 각 국, 각 분야)\n  - 覺: 깨달음(예: 각성)\n  - 閣: 누각/정자, 내각 등(건물·정부 관련 한자어)\n\n- 구어/신조어\n  - 각이다: 어떤 일이 일어날 가능성·분위기가 뚜렷함\n    예) 비 올 각, 합격각, 사과각\n  - 각 잡다: 자세나 준비를 단정히 갖추다\n  - 각 재다: 조건을 따지다/계산하다\n  - 각(이) 보인다/각 나왔다: 될 조짐이 뚜렷함\n\n- 기타\n  - 각도(사진 각도), 각이 지다(모서리가 도드라져 보이다) 등도 관련 표현으로 자주 씁니다.\n\n어떤 의미(학술적 ‘각’, ‘각자’의 각, 신조어 ‘각이다’ 등)를 더 자세히 알고 싶으신가요? 원하는 예문이나 상황을 알려주시면 맞춰 설명해 드릴게요.",
        "content": "혹시 질문이 일부만 전송된 것 같아요. 우선 “각”의 주요 의미를 간단히 정리해 드릴게요.\n\n- 기본 의미\n  - 角: 뿔, 모서리/모퉁이, 기하학의 각(angle)\n  - 各: 각각, 각자(예: 각 국, 각 분야)\n  - 覺: 깨달음(예: 각성)\n  - 閣: 누각/정자, 내각 등(건물·정부 관련 한자어)\n\n- 구어/신조어\n  - 각이다: 어떤 일이 일어날 가능성·분위기가 뚜렷함\n    예) 비 올 각, 합격각, 사과각\n  - 각 잡다: 자세나 준비를 단정히 갖추다\n  - 각 재다: 조건을 따지다/계산하다\n  - 각(이) 보인다/각 나왔다: 될 조짐이 뚜렷함\n\n- 기타\n  - 각도(사진 각도), 각이 지다(모서리가 도드라져 보이다) 등도 관련 표현으로 자주 씁니다.\n\n어떤 의미(학술적 ‘각’, ‘각자’의 각, 신조어 ‘각이다’ 등)를 더 자세히 알고 싶으신가요? 원하는 예문이나 상황을 알려주시면 맞춰 설명해 드릴게요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_4_e10l01",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932312066_mtzgpyf7r",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_7_wht0qu",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_7_wht0qu",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932015007_8_8zwxd4",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "까",
    "question": "하이",
    "answer": "안녕하세요! \"이 단어\" 또는 \"이 표현\"에 대해 궁금하신 점이 있으시면 말씀해 주세요. \"까\"라는 용어에 대해 설명해 드릴 수 있습니다.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! \"이 단어\" 또는 \"이 표현\"에 대해 궁금하신 점이 있으시면 말씀해 주세요. \"까\"라는 용어에 대해 설명해 드릴 수 있습니다.",
        "content": "안녕하세요! \"이 단어\" 또는 \"이 표현\"에 대해 궁금하신 점이 있으시면 말씀해 주세요. \"까\"라는 용어에 대해 설명해 드릴 수 있습니다."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932331457_1eiscl8wr",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_5_9sowsy",
    "keyword": "ㅓㅗㅓ",
    "question": "ㅓㅗㅓ",
    "answer": "질문: ㅓㅗㅓ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅓㅗㅓ",
        "content": "ㅓㅗㅓ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅓㅗㅓ\n\n답변:",
        "content": "질문: ㅓㅗㅓ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_5_9sowsy",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760106187048_2d7gkmhw7",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760106177120_wg8xcdv9j",
    "keyword": "한지상이 누구야",
    "question": "한지상이 누구야",
    "answer": "한지상은 2003년 연극 '세발자전거'로 데뷔한 한국의 뮤지컬 배우입니다. ([viva100.com](https://viva100.com/article/201812124388043?utm_source=openai)) 그는 뮤지컬 '프랑켄슈타인'에서 '괴물'과 '앙리' 역을 맡아 1인 2역을 소화하며 주목받았으며, ([mk.co.kr](https://www.mk.co.kr/news/hot-issues/7967573?utm_source=openai)) '킹아더'에서는 타이틀롤인 '아더' 역을 맡아 연기와 가창력을 선보였습니다. ([sports.donga.com](https://sports.donga.com/ent/article/all/20190327/94757399/1?utm_source=openai)) 또한 뮤지컬 '지저스 크라이스트 수퍼스타'에서 유다 역을 맡아 열연을 펼쳤습니다. ([news.zum.com](https://news.zum.com/articles/95527952?utm_source=openai)) 그는 2019년 한국뮤지컬어워즈에서 남우조연상을 수상하며 뮤지컬계에서 입지를 굳혔습니다. ([v.daum.net](https://v.daum.net/v/20220521120846394?utm_source=openai))",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760106187048,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "한지상이 누구야",
        "content": "한지상이 누구야"
      },
      {
        "role": "assistant",
        "text": "한지상은 2003년 연극 '세발자전거'로 데뷔한 한국의 뮤지컬 배우입니다. ([viva100.com](https://viva100.com/article/201812124388043?utm_source=openai)) 그는 뮤지컬 '프랑켄슈타인'에서 '괴물'과 '앙리' 역을 맡아 1인 2역을 소화하며 주목받았으며, ([mk.co.kr](https://www.mk.co.kr/news/hot-issues/7967573?utm_source=openai)) '킹아더'에서는 타이틀롤인 '아더' 역을 맡아 연기와 가창력을 선보였습니다. ([sports.donga.com](https://sports.donga.com/ent/article/all/20190327/94757399/1?utm_source=openai)) 또한 뮤지컬 '지저스 크라이스트 수퍼스타'에서 유다 역을 맡아 열연을 펼쳤습니다. ([news.zum.com](https://news.zum.com/articles/95527952?utm_source=openai)) 그는 2019년 한국뮤지컬어워즈에서 남우조연상을 수상하며 뮤지컬계에서 입지를 굳혔습니다. ([v.daum.net](https://v.daum.net/v/20220521120846394?utm_source=openai))",
        "content": "한지상은 2003년 연극 '세발자전거'로 데뷔한 한국의 뮤지컬 배우입니다. ([viva100.com](https://viva100.com/article/201812124388043?utm_source=openai)) 그는 뮤지컬 '프랑켄슈타인'에서 '괴물'과 '앙리' 역을 맡아 1인 2역을 소화하며 주목받았으며, ([mk.co.kr](https://www.mk.co.kr/news/hot-issues/7967573?utm_source=openai)) '킹아더'에서는 타이틀롤인 '아더' 역을 맡아 연기와 가창력을 선보였습니다. ([sports.donga.com](https://sports.donga.com/ent/article/all/20190327/94757399/1?utm_source=openai)) 또한 뮤지컬 '지저스 크라이스트 수퍼스타'에서 유다 역을 맡아 열연을 펼쳤습니다. ([news.zum.com](https://news.zum.com/articles/95527952?utm_source=openai)) 그는 2019년 한국뮤지컬어워즈에서 남우조연상을 수상하며 뮤지컬계에서 입지를 굳혔습니다. ([v.daum.net](https://v.daum.net/v/20220521120846394?utm_source=openai))"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760106177120_wg8xcdv9j",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759968726305_3uaica0ni",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932084994_0_iyze5h",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759968726305,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "content": "안녕하세요! 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932084994_0_iyze5h",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932225653_mjjmccsms",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_8_8zwxd4",
    "keyword": "이",
    "question": "이",
    "answer": "질문: 이\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "이",
        "content": "이"
      },
      {
        "role": "assistant",
        "text": "질문: 이\n\n답변:",
        "content": "질문: 이\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_8_8zwxd4",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932325124_jufddmr3o",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_5_9sowsy",
    "keyword": "ㅓㅗㅓ",
    "question": "ㅓㅗㅓ",
    "answer": "질문: ㅓㅗㅓ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅓㅗㅓ",
        "content": "ㅓㅗㅓ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅓㅗㅓ\n\n답변:",
        "content": "질문: ㅓㅗㅓ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_5_9sowsy",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760207107588_818ayfp3u",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760207094102_eo4hbdpdy",
    "keyword": "하이",
    "question": "하이",
    "answer": "네, 안녕하세요! 반갑습니다. 😊\n\n오늘은 어떤 이야기를 나누어 볼까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760207107588,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "네, 안녕하세요! 반갑습니다. 😊\n\n오늘은 어떤 이야기를 나누어 볼까요?",
        "content": "네, 안녕하세요! 반갑습니다. 😊\n\n오늘은 어떤 이야기를 나누어 볼까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760207094102_eo4hbdpdy",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932001577_gdogzup87",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "안녕",
    "question": "안영",
    "answer": "질문: 안영\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안영",
        "content": "안영"
      },
      {
        "role": "assistant",
        "text": "질문: 안영\n\n답변:",
        "content": "질문: 안영\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932285974_1_6p5oxt",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_0_izhosp",
    "keyword": "각",
    "question": "ㅣㅣ",
    "answer": "무엇을 도와드릴까요? 입력하신 \"ㅣㅣ\"는 한글 모음 ㅣ를 두 번 입력한 것입니다.\n혹시 \"||\" (파이프/일시정지 기호)을 원하셨나요, 아니면 키보드 입력 테스트 중이신가요?\n참고로 파이프 기호 \"|\"는 보통 Shift + \\ (또는 ₩) 키로 입력합니다. 원하는 작업을 알려주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅣㅣ",
        "content": "ㅣㅣ"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 혹시 실수로 입력하셨나요, 아니면 한글 모음 ‘ㅣ’에 대해 궁금한 점이 있으신가요? 필요하신 도움을 알려주세요—번역, 글쓰기, 정보 찾기 등 무엇이든 도와드릴게요.",
        "content": "안녕하세요! 혹시 실수로 입력하셨나요, 아니면 한글 모음 ‘ㅣ’에 대해 궁금한 점이 있으신가요? 필요하신 도움을 알려주세요—번역, 글쓰기, 정보 찾기 등 무엇이든 도와드릴게요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_0_izhosp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760207948800_nrplga3d4",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760207107588_818ayfp3u",
    "keyword": "하이",
    "question": "하이",
    "answer": "네, 안녕하세요! 다시 한번 반갑습니다. 😊\n\n어떤 것을 도와드릴까요? 아니면 그냥 편하게 이야기 나누고 싶으신가요? 말씀해주세요!",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760207948800,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "네, 안녕하세요! 다시 한번 반갑습니다. 😊\n\n어떤 것을 도와드릴까요? 아니면 그냥 편하게 이야기 나누고 싶으신가요? 말씀해주세요!",
        "content": "네, 안녕하세요! 다시 한번 반갑습니다. 😊\n\n어떤 것을 도와드릴까요? 아니면 그냥 편하게 이야기 나누고 싶으신가요? 말씀해주세요!"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760207107588_818ayfp3u",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760000452191_i83y5laax",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932084994_1_4yt8oe",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 무엇을 도와드릴까요?\n- 정보 찾기/요약\n- 글쓰기/번역\n- 학습/문제풀이\n- 코드/디버깅\n- 아이디어 브레인스토밍\n\n필요한 걸 말씀해 주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760000452191,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?\n- 정보 찾기/요약\n- 글쓰기/번역\n- 학습/문제풀이\n- 코드/디버깅\n- 아이디어 브레인스토밍\n\n필요한 걸 말씀해 주세요.",
        "content": "안녕하세요! 무엇을 도와드릴까요?\n- 정보 찾기/요약\n- 글쓰기/번역\n- 학습/문제풀이\n- 코드/디버깅\n- 아이디어 브레인스토밍\n\n필요한 걸 말씀해 주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932084994_1_4yt8oe",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760000460830_0_hp3h5szv",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760000452191_i83y5laax",
    "keyword": "한 걸 말씀",
    "question": "한 걸 말씀",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760000460830,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "한 걸 말씀",
        "content": "한 걸 말씀"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760000452191_i83y5laax",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760209117394_l4e016jnk",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932293700_mo440jefs",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "무엇을 도와드릴까요?  \n예: 문장 교정, 번역, 요약, 정보 찾기, 코드 디버깅, 일정/계획 세우기 등.  \n원하시는 내용을 한두 문장으로 말해 주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760209117394,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "무엇을 도와드릴까요?  \n예: 문장 교정, 번역, 요약, 정보 찾기, 코드 디버깅, 일정/계획 세우기 등.  \n원하시는 내용을 한두 문장으로 말해 주세요.",
        "content": "무엇을 도와드릴까요?  \n예: 문장 교정, 번역, 요약, 정보 찾기, 코드 디버깅, 일정/계획 세우기 등.  \n원하시는 내용을 한두 문장으로 말해 주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932293700_mo440jefs",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932316495_asdtnh2wi",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_6_nxk3rw",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_6_nxk3rw",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932311107_um844aotn",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_7_wht0qu",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_7_wht0qu",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932015007_5_9sowsy",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "녕하세요! 어",
    "question": "ㅓㅗㅓ",
    "answer": "\"ㅓㅗㅓ\"는 기본적으로 한국어 자모를 나열한 것으로, 특정한 의미가 있는 단어가 아닙니다. 만약 어떤 특정한 내용을 의도하신 것이라면 좀 더 구체적으로 설명해 주시면 도움을 드릴 수 있을 것 같습니다. 다른 질문이나 알고 싶은 내용이 있으면 말씀해 주세요!",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅓㅗㅓ",
        "content": "ㅓㅗㅓ"
      },
      {
        "role": "assistant",
        "text": "\"ㅓㅗㅓ\"는 기본적으로 한국어 자모를 나열한 것으로, 특정한 의미가 있는 단어가 아닙니다. 만약 어떤 특정한 내용을 의도하신 것이라면 좀 더 구체적으로 설명해 주시면 도움을 드릴 수 있을 것 같습니다. 다른 질문이나 알고 싶은 내용이 있으면 말씀해 주세요!",
        "content": "\"ㅓㅗㅓ\"는 기본적으로 한국어 자모를 나열한 것으로, 특정한 의미가 있는 단어가 아닙니다. 만약 어떤 특정한 내용을 의도하신 것이라면 좀 더 구체적으로 설명해 주시면 도움을 드릴 수 있을 것 같습니다. 다른 질문이나 알고 싶은 내용이 있으면 말씀해 주세요!"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932323856_oo0g7kys6",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_6_nxk3rw",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_6_nxk3rw",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932319667_9n2fiou6k",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_6_nxk3rw",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_6_nxk3rw",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760207083809_prwqi2961",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932084994_6_k05tzl",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 어떤 도움이 필요하신가요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760207083809,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 어떤 도움이 필요하신가요?",
        "content": "안녕하세요! 어떤 도움이 필요하신가요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932084994_6_k05tzl",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932305543_upjanzk9i",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_7_wht0qu",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_7_wht0qu",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932015007_4_e10l01",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "요",
    "question": "하이",
    "answer": "안녕하세요! \"요\"라는 용어에 대해 궁금한 점이 있으신가요? 아니면 다른 질문이 있으신가요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! \"요\"라는 용어에 대해 궁금한 점이 있으신가요? 아니면 다른 질문이 있으신가요?",
        "content": "안녕하세요! \"요\"라는 용어에 대해 궁금한 점이 있으신가요? 아니면 다른 질문이 있으신가요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932352665_dhih2m7k9",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_8_8zwxd4",
    "keyword": "무엇",
    "question": "ㅇㄹㄴㅇㄹ",
    "answer": "질문: ㅇㄹㄴㅇㄹ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㄹㄴㅇㄹ",
        "content": "ㅇㄹㄴㅇㄹ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㄹㄴㅇㄹ\n\n답변:",
        "content": "질문: ㅇㄹㄴㅇㄹ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_8_8zwxd4",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932015007_1_3h9kj0",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "녕",
    "question": "하이",
    "answer": "안녕하세요! “녕”이라는 용어에 대해 설명이 필요하신가요? 궁금한 점이 있으면 말씀해 주세요!",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! “녕”이라는 용어에 대해 설명이 필요하신가요? 궁금한 점이 있으면 말씀해 주세요!",
        "content": "안녕하세요! “녕”이라는 용어에 대해 설명이 필요하신가요? 궁금한 점이 있으면 말씀해 주세요!"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932288474_royu5em1v",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_0_izhosp",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_0_izhosp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932275601_bat8dn1aa",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_2_0srd5r",
    "keyword": "ㅇ",
    "question": "ㅇ",
    "answer": "질문: ㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇ",
        "content": "ㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇ\n\n답변:",
        "content": "질문: ㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_2_0srd5r",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932084994_0_iyze5h",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932001577_gdogzup87",
    "keyword": "안영",
    "question": null,
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [],
    "node_type": "question",
    "memo_parent_id": "node_1759932001577_gdogzup87",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932084994_1_4yt8oe",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932001577_gdogzup87",
    "keyword": "안녕\"의",
    "question": "안녕",
    "answer": "안녕하세요! 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "안녕",
        "content": "안녕"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?",
        "content": "안녕하세요! 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932001577_gdogzup87",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932015007_7_wht0qu",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "keyword": "드릴",
    "question": "ㅇㅇ",
    "answer": "\"드릴\"이라는 용어에 대해 알고 싶으신가요? \"드릴\"은 일반적으로 어떤 작업이나 상황에서 도움이 되는 정보를 제공하거나, 특정 행동을 수행할 때 사용하는 방식으로, 예를 들어 \"드릴 내용을 설명해 주세요\" 하는 식으로 사용될 수 있습니다. 다른 궁금한 점이나 추가적인 설명이 필요하신가요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "\"드릴\"이라는 용어에 대해 알고 싶으신가요? \"드릴\"은 일반적으로 어떤 작업이나 상황에서 도움이 되는 정보를 제공하거나, 특정 행동을 수행할 때 사용하는 방식으로, 예를 들어 \"드릴 내용을 설명해 주세요\" 하는 식으로 사용될 수 있습니다. 다른 궁금한 점이나 추가적인 설명이 필요하신가요?",
        "content": "\"드릴\"이라는 용어에 대해 알고 싶으신가요? \"드릴\"은 일반적으로 어떤 작업이나 상황에서 도움이 되는 정보를 제공하거나, 특정 행동을 수행할 때 사용하는 방식으로, 예를 들어 \"드릴 내용을 설명해 주세요\" 하는 식으로 사용될 수 있습니다. 다른 궁금한 점이나 추가적인 설명이 필요하신가요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "root_8a1cbba3-359b-4ede-af29-85c7dc6e7590",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932273012_p0hua1qkm",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_2_0srd5r",
    "keyword": "ㅇ",
    "question": "ㅇ",
    "answer": "안녕하세요! 무엇을 도와드릴까요?\n- 간단한 질문 답변\n- 번역/요약\n- 글쓰기/아이디어\n- 코드/수학 문제\n- 공부/계획 세우기\n\n원하시는 내용을 한 줄로 알려주세요.",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇ",
        "content": "ㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇ\n\n답변:",
        "content": "질문: ㅇ\n\n답변:"
      },
      {
        "role": "user",
        "text": "ㅇ",
        "content": "ㅇ"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 무엇을 도와드릴까요?\n- 간단한 질문 답변\n- 번역/요약\n- 글쓰기/아이디어\n- 코드/수학 문제\n- 공부/계획 세우기\n\n원하시는 내용을 한 줄로 알려주세요.",
        "content": "안녕하세요! 무엇을 도와드릴까요?\n- 간단한 질문 답변\n- 번역/요약\n- 글쓰기/아이디어\n- 코드/수학 문제\n- 공부/계획 세우기\n\n원하시는 내용을 한 줄로 알려주세요."
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_2_0srd5r",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1760000460830_2_skkxiuet",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760000452191_i83y5laax",
    "keyword": "학습/문제",
    "question": "학습/문제",
    "answer": null,
    "status": "placeholder",
    "order_index": 0,
    "created_at": 1760000460832,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "학습/문제",
        "content": "학습/문제"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760000452191_i83y5laax",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760207117274_tz4nwbfg4",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1760207107588_818ayfp3u",
    "keyword": "하이",
    "question": "하이",
    "answer": "안녕하세요! 또 인사해 주셨네요. 무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760207117274,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 또 인사해 주셨네요. 무엇을 도와드릴까요?",
        "content": "안녕하세요! 또 인사해 주셨네요. 무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1760207107588_818ayfp3u",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1760209978590_7pv8ri0fu",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932268202_14zraox4h",
    "keyword": "하이",
    "question": "하이",
    "answer": "하이! 무엇을 도와드릴까요?\n방금 보낸 “ㅇㄹㅇ”이 무슨 뜻으로 쓰신 건지 알려주시면 더 잘 도와드릴 수 있어요. (요즘엔 ‘ㄹㅇ=레알/진짜’처럼 쓰이기도 해요.)",
    "status": "answered",
    "order_index": 0,
    "created_at": 1760209978590,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "하이! 무엇을 도와드릴까요?\n방금 보낸 “ㅇㄹㅇ”이 무슨 뜻으로 쓰신 건지 알려주시면 더 잘 도와드릴 수 있어요. (요즘엔 ‘ㄹㅇ=레알/진짜’처럼 쓰이기도 해요.)",
        "content": "하이! 무엇을 도와드릴까요?\n방금 보낸 “ㅇㄹㅇ”이 무슨 뜻으로 쓰신 건지 알려주시면 더 잘 도와드릴 수 있어요. (요즘엔 ‘ㄹㅇ=레알/진짜’처럼 쓰이기도 해요.)"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932268202_14zraox4h",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "placeholder_1759932084994_6_k05tzl",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "node_1759932001577_gdogzup87",
    "keyword": "안'을 기원하는 뜻을 가지고 있습니다. 더 궁금",
    "question": "하이",
    "answer": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "하이",
        "content": "하이"
      },
      {
        "role": "assistant",
        "text": "안녕하세요! 👋\n\n무엇을 도와드릴까요?",
        "content": "안녕하세요! 👋\n\n무엇을 도와드릴까요?"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "node_1759932001577_gdogzup87",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932300023_7ic2ajbyh",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_0_izhosp",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_0_izhosp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  },
  {
    "id": "node_1759932293700_mo440jefs",
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_id": "tree_1759931998768_71963241",
    "parent_id": "placeholder_1759932015007_0_izhosp",
    "keyword": "ㅇㅇ",
    "question": "ㅇㅇ",
    "answer": "질문: ㅇㅇ\n\n답변:",
    "status": "answered",
    "order_index": 0,
    "created_at": 1759932356458,
    "updated_at": 1760297912051,
    "deleted_at": null,
    "conversation": [
      {
        "role": "user",
        "text": "ㅇㅇ",
        "content": "ㅇㅇ"
      },
      {
        "role": "assistant",
        "text": "질문: ㅇㅇ\n\n답변:",
        "content": "질문: ㅇㅇ\n\n답변:"
      }
    ],
    "node_type": "question",
    "memo_parent_id": "placeholder_1759932015007_0_izhosp",
    "memo_title": null,
    "memo_content": null,
    "memo_metadata": null
  }
]

-- 6. 사용자별 트리 수 요약 (RLS 적용 계정 기준)
SELECT
  user_id,
  COUNT(*) AS tree_count,
  MAX(updated_at) AS last_updated_at
FROM public.trees
GROUP BY user_id
ORDER BY tree_count DESC;
[
  {
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_count": 322,
    "last_updated_at": 1760109249151
  },
  {
    "user_id": "f0907c18-33f3-46de-b7f3-cd2bc25c0f38",
    "tree_count": 229,
    "last_updated_at": 1760314865329
  },
  {
    "user_id": "baccea04-c14f-42f7-a76e-380c0474bddd",
    "tree_count": 159,
    "last_updated_at": 1760110219966
  },
  {
    "user_id": "890f593b-0f60-409a-b827-293fd13ac9a0",
    "tree_count": 45,
    "last_updated_at": 1759868442697
  },
  {
    "user_id": "2333e391-e963-42ce-9a31-c9511e82c065",
    "tree_count": 28,
    "last_updated_at": 1760319307910
  },
  {
    "user_id": "906deca6-0d65-424c-9860-c58ba003e6fc",
    "tree_count": 24,
    "last_updated_at": 1758973457353
  },
  {
    "user_id": "a91133bb-d7ef-4d84-84b2-2004fa70fd76",
    "tree_count": 21,
    "last_updated_at": 1759587767357
  },
  {
    "user_id": "027df0a5-df06-4c90-ab5a-ef3f4d02dfcb",
    "tree_count": 21,
    "last_updated_at": 1758960406481
  },
  {
    "user_id": "895e813c-8e30-476d-8f4a-01643e9fc8f2",
    "tree_count": 20,
    "last_updated_at": 1758957650101
  },
  {
    "user_id": "c7c17091-5de8-4734-8d2f-f7634245cfe9",
    "tree_count": 14,
    "last_updated_at": 1759121429438
  },
  {
    "user_id": "32f7e5ba-6342-4f49-aad7-ac47b3b20afb",
    "tree_count": 12,
    "last_updated_at": 1758954220522
  },
  {
    "user_id": "0b4026b3-2171-4050-94a1-0e23ee7c373c",
    "tree_count": 11,
    "last_updated_at": 1759601099549
  },
  {
    "user_id": "937b450b-2b07-4c3f-83e7-7e95a33ffeea",
    "tree_count": 8,
    "last_updated_at": 1758954002797
  },
  {
    "user_id": "3895ccc0-f264-4ad4-9a2b-2fd7ddccdce7",
    "tree_count": 7,
    "last_updated_at": 1758956710969
  },
  {
    "user_id": "19e1e935-787c-4a1f-9032-0bb9b6a27c81",
    "tree_count": 3,
    "last_updated_at": 1758956959770
  }
]

-- 7. 메모 테이블에서 최근 생성 항목 확인
SELECT *
FROM public.memos
ORDER BY created_at DESC
LIMIT 50;
[
  {
    "id": "memo_1759301776971_3a0unnqh6",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "5f687e7c-842b-4834-9556-289ce044f61b",
    "node_id": "placeholder_1759301519642_2_a30ais",
    "content": "ㄴㅁㅇㄹ",
    "position_x": -286,
    "position_y": -251,
    "created_at": 1759301776971,
    "updated_at": 1759302460762,
    "deleted_at": null
  },
  {
    "id": "memo_1759301610815_xmhzbbhgm",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "5f687e7c-842b-4834-9556-289ce044f61b",
    "node_id": "placeholder_1759301519642_2_a30ais",
    "content": "ㅁㄴㅇㄹ",
    "position_x": 566,
    "position_y": 239,
    "created_at": 1759301610815,
    "updated_at": 1759301733442,
    "deleted_at": null
  },
  {
    "id": "memo_1759300104559_gcy5dgo9x",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "tree_1759135611479_fc615845",
    "node_id": "node_1759135623677_z0z7dc9gt",
    "content": "asfd",
    "position_x": 270,
    "position_y": 84,
    "created_at": 1759300104559,
    "updated_at": 1759301315790,
    "deleted_at": null
  },
  {
    "id": "memo_1759299024080_93t8et6tt",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "tree_1759135611479_fc615845",
    "node_id": "node_1759135623677_z0z7dc9gt",
    "content": "asdf",
    "position_x": 285,
    "position_y": -99,
    "created_at": 1759299024080,
    "updated_at": 1759301317172,
    "deleted_at": null
  },
  {
    "id": "memo_1759299011378_e0m3j322g",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "47b11f1d-6668-44f3-9709-5dc82a34b4e7",
    "node_id": "placeholder_1759298570966_2_h8sai1",
    "content": "ㅁㄴㅇㄹ",
    "position_x": -437,
    "position_y": -15,
    "created_at": 1759299011378,
    "updated_at": 1759299593437,
    "deleted_at": null
  },
  {
    "id": "memo_1759298955841_dkbj2xagi",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "47b11f1d-6668-44f3-9709-5dc82a34b4e7",
    "node_id": "placeholder_1759298570966_2_h8sai1",
    "content": "ㄴㅁㅇㄹ",
    "position_x": -398,
    "position_y": -253,
    "created_at": 1759298955841,
    "updated_at": 1759299387544,
    "deleted_at": null
  },
  {
    "id": "memo_1759298887314_i6i0in9do",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "tree_1759135611479_fc615845",
    "node_id": "node_1759135623677_z0z7dc9gt",
    "content": "asdf",
    "position_x": 390,
    "position_y": -179,
    "created_at": 1759298887314,
    "updated_at": 1759301219404,
    "deleted_at": null
  },
  {
    "id": "memo_1759298857490_cu267wbfc",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "47b11f1d-6668-44f3-9709-5dc82a34b4e7",
    "node_id": "placeholder_1759298570966_2_h8sai1",
    "content": "ㅁㄴㅇㄹ",
    "position_x": -156.303,
    "position_y": -145.186,
    "created_at": 1759298857490,
    "updated_at": 1759299097194,
    "deleted_at": null
  },
  {
    "id": "memo_1759298735246_3rkiyq5ij",
    "user_id": "47b98bd7-82bc-4b76-9484-b0635ef3ab0b",
    "tree_id": "47b11f1d-6668-44f3-9709-5dc82a34b4e7",
    "node_id": "placeholder_1759298570966_1_8mmsia",
    "content": "ㅁㅇㄴㄹ",
    "position_x": -173.303,
    "position_y": -52.1859,
    "created_at": 1759298735246,
    "updated_at": 1759299254928,
    "deleted_at": null
  }
]