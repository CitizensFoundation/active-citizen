from requests import Request
from fastapi import APIRouter, Response
from models.post import Post

router = APIRouter()

@router.put("/api/v1/post/{post_id}")
async def update_post(post_id: int, post: Post):
    # Create a short langchain summary of the post name and description


    return Response(content="OK", status_code=200)

