from typing import Union, List

from pydantic import BaseModel

class Post(BaseModel):
    name: str
    description: str
    language: str
    group_name: str
    long_lat: List[float]
    counter_endorsements_up: int
    counter_endorsements_down: int
    counter_points_for: int
    counter_points_against: int
    points_for: List[str]
    points_against: List[str]
    total_number_of_posts: int
