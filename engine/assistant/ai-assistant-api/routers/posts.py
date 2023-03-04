from requests import Request
from engine.vector_store import upsert_post_in_vector_store
from fastapi import APIRouter, Response
from models.post import Post

post_router = APIRouter()

@post_router.put("/api/v1/posts/{cluster_id}/{post_id}")
async def update_post(cluster_id: int, post_id: int, post: Post):
    post.post_id = post_id
    post.cluster_id = cluster_id
    upsert_post_in_vector_store(post);

    return Response(content="OK", status_code=200)

