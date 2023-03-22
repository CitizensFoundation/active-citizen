from engine.summarizer import get_emoji_summary, get_full_post_summary, get_full_post_summary_with_points, get_one_word_summary, get_short_post_name, get_short_post_summary, get_short_post_summary_with_points
from models.post import Post
import weaviate
from weaviate.util import generate_uuid5
from uuid import uuid4
import time

async def upsert_post_in_vector_store(post: Post):
    client = weaviate.Client("http://localhost:8080")

    print(post)

    weaviate_class = "PostsIs" if post.language == "is" or post.language=="es" else "Posts"

    uuid = generate_uuid5(post.post_id, weaviate_class)

    data_properties = {
        "postId": post.post_id,
        "name": post.name,
        "description": post.description,
        "language": post.language,
        "counter_endorsements_up": post.counter_endorsements_up,
        "counter_endorsements_down": post.counter_endorsements_down,
        "status": post.status,
        "imageUrl": post.image_url,
        "group_id": post.group_id,
        "community_id": post.community_id,
        "domain_id": post.domain_id,
        "cluster_id": post.cluster_id,
        "created_at": post.date,
        "updated_at": post.date,
        "group_name": post.group_name,
        "emojiSummary": await get_emoji_summary(post),
        "oneWordSummary": await get_one_word_summary(post),
        "shortName": await get_short_post_name(post),
        "shortSummary": await get_short_post_summary(post),
        "fullSummary": await get_full_post_summary(post),
        "shortSummaryWithPoints": await get_short_post_summary_with_points(post),
        "fullSummaryWithPoints": await get_full_post_summary_with_points(post),
    }

    print(data_properties)

    # client.batch.add_data_object(data_properties, "Document", id, doc_vector)
    client.data_object.create(
        data_object=data_properties,
        class_name=weaviate_class,
        uuid=uuid
    )
