import os
from dotenv import load_dotenv
load_dotenv(override=True)

from openai import AsyncOpenAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from typing import List

# ========================================================
#  OpenAI Client (Chat & Embedding)
# ========================================================

_async_client = None

def get_async_client():
    global _async_client
    if not _async_client:
        _async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _async_client

# --------------------------------------------------------
#  Embedding Methods
# --------------------------------------------------------

async def get_embedding_openai(text: str) -> List[float]:
    """1536차원 벡터 임베딩 (text-embedding-3-small)"""
    if not text:
        return [0.0] * 1536
    
    text = text.replace("\n", " ")
    client = get_async_client()
    
    try:
        response = await client.embeddings.create(
            input=[text],
            model="text-embedding-3-small"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"⚠️ OpenAI Embedding Error: {e}")
        return [0.0] * 1536

async def get_embeddings_batch_openai(texts: List[str]) -> List[List[float]]:
    """배치 임베딩"""
    if not texts:
        return []
    
    client = get_async_client()
    try:
        response = await client.embeddings.create(
            input=texts,
            model="text-embedding-3-small"
        )
        return [d.embedding for d in response.data]
    except Exception as e:
        print(f"⚠️ OpenAI Batch Error: {e}")
        return [[0.0] * 1536 for _ in texts]

# --------------------------------------------------------
#  Chat Methods (LangChain)
# --------------------------------------------------------

def get_chat_model(model="gpt-4o-mini", temperature=0.7):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key: return None
    return ChatOpenAI(model=model, temperature=temperature, api_key=api_key)
    # return ChatOpenAI(model=model, temperature=temperature, openai_api_key=api_key)

async def generate_response_openai(prompt: str, system_role: str = "Assistant"):
    llm = get_chat_model()
    if not llm: return "API Key missing."
    
    try:
        messages = [
            SystemMessage(content=system_role),
            HumanMessage(content=prompt)
        ]
        res = await llm.ainvoke(messages)
        return res.content
    except Exception as e:
        print(f"⚠️ OpenAI Chat Error: {e}")
        return "Error generating response."
