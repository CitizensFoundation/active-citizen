import weaviate
import time
client = weaviate.Client("http://localhost:8080")
#client.schema.delete_class("PostsIs")
schema = {
    "classes": [
        {
            "class": "PostsIs",
            "description": "An post",
            "vectorizer": "text2vec-cohere",
            "vectorIndexConfig": {
                "distance": "dot"
            },
            "moduleConfig": {
                "text2vec-cohere": {
                    "model": "multilingual-22-12",
                    "truncate": "RIGHT"
                }
            },
            "properties": [
                {
                    "name": "postId",
                    "dataType": ["int"],
                    "description": "The id.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "group_id",
                    "dataType": ["int"],
                    "description": "The group id.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "community_id",
                    "dataType": ["int"],
                    "description": "The community id.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "domain_id",
                    "dataType": ["int"],
                    "description": "The domain id.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "cluster_id",
                    "dataType": ["int"],
                    "description": "The cluster id.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "content",
                    "dataType": ["text"],
                    "description": "The text content the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "group_name",
                    "dataType": ["text"],
                    "description": "The group name",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "name",
                    "dataType": ["text"],
                    "description": "The text name the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "emojiSummary",
                    "dataType": ["text"],
                    "description": "The emojiSummary",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "oneWordSummary",
                    "dataType": ["text"],
                    "description": "The oneWordSummary",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "shortName",
                    "dataType": ["text"],
                    "description": "The text name the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "shortSummary",
                    "dataType": ["text"],
                    "description": "Short summary of the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "fullSummary",
                    "dataType": ["text"],
                    "description": "Full summary of the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "shortSummaryWithPoints",
                    "dataType": ["text"],
                    "description": "Short summary of the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "fullSummaryWithPoints",
                    "dataType": ["text"],
                    "description": "Full summary of the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "userName",
                    "dataType": ["string"],
                    "description": "The name of the user who posted the post",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": False,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "imageUrl",
                    "dataType": ["string"],
                    "description": "The image url",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "counter_endorsements_up",
                    "dataType": ["int"],
                    "description": "The up count",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "counter_endorsements_down",
                    "dataType": ["int"],
                    "description": "The up count",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "counter_points_for",
                    "dataType": ["int"],
                    "description": "The up count",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "counter_points_against",
                    "dataType": ["int"],
                    "description": "The down count",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "language",
                    "dataType": ["string"],
                    "description": "The up count",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "created_at",
                    "dataType": ["date"],
                    "description": "When Created",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "updated_at",
                    "dataType": ["date"],
                    "description": "When updated",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
                {
                    "name": "userId",
                    "dataType": ["int"],
                    "description": "The user number.",
                    "moduleConfig": {
                            "text2vec-cohere": {
                                "skip": True,
                                "vectorizePropertyName": False
                            }
                    },
                },
            ]
        }
    ]
}

client.schema.create(schema)
