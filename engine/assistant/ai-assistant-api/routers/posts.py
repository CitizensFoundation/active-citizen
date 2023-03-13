from requests import Request
from engine.vector_store import upsert_post_in_vector_store
from fastapi import APIRouter, Response
from models.post import Post
import weaviate
import json

post_router = APIRouter()

@post_router.put("/api/v1/posts/{cluster_id}/{post_id}")
async def update_post(cluster_id: int, post_id: int, post: Post):
    post.post_id = post_id
    post.cluster_id = cluster_id
    upsert_post_in_vector_store(post);

    return Response(content="OK", status_code=200)

@post_router.get("/api/v1/posts/{post_id}")
async def get_post(post_id: int):
    client = weaviate.Client("http://localhost:8080")
    where_filter = {
        "path": ["postId"],
        "operator": "Equal",
        "valueInt": post_id,
    }
    result = (
        client.query.
        get("Posts", ["name","postId"]).
        with_limit(1).
        with_where(where_filter).
        do()
    )
    print(result)
    print(result["data"]["Get"]["Posts"][0])

    #result["data"]["Get"][self._index_name]:
    json_str = json.dumps(result["data"]["Get"]["Posts"][0], indent=4, default=str)
    print (json_str)
    return Response(content=json_str, status_code=200)

