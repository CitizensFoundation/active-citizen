from typing import Union, List, Optional

from pydantic import BaseModel

class Community(BaseModel):
    community_id: Optional[int] = None
    name: str
    description: str
    language: str
    image_url: Optional[str] = None
    counter_posts: int
    counter_points_for: Optional[int] = 0
    counter_points_against: Optional[int] = 0
    domain_id: int
    cluster_id: Optional[int] = None
    date: str
    status: str
    assistantConfiguration: str
