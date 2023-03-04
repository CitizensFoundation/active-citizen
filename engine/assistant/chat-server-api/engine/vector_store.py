from engine.summarizer import get_full_post_summary, get_full_post_summary_with_points, get_short_post_name, get_short_post_summary, get_short_post_summary_with_points
from models.post import Post
import weaviate
from weaviate.util import generate_uuid5
from uuid import uuid4
import time

def upsert_post_in_vector_store(post: Post):
    client = weaviate.Client("http://localhost:8080")

    uuid = generate_uuid5(Post.id, "Posts")

    data_properties = {
        "id": post.id,
        "name": post.name,
        "description": post.description,
        "language": post.language,
        "public_data": post.public_data,
        "counter_endorsements_up": post.counter_endorsements_up,
        "counter_endorsements_down": post.counter_endorsements_down,
        "status": post.status,
        "group_id": post.group_id,
        "community_id": post.community_id,
        "domain_id": post.domain_id,
        "cluster_id": post.cluster_id,
        "user_id": post.user_id,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "shortName": get_short_post_name(post),
        "shortSummary": get_short_post_summary(post),
        "fullSummary": get_full_post_summary(post),
        "shortSummaryWithPoints": get_short_post_summary_with_points(post),
        "fullSummaryWithPoints": get_full_post_summary_with_points(post),
    }

    # client.batch.add_data_object(data_properties, "Document", id, doc_vector)
    client.data_object.create(
        data_object=data_properties,
        class_name="Posts",
        uuid=uuid
    )
