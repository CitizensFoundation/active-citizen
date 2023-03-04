import weaviate
import time
client = weaviate.Client("http://localhost:8080")

schema = {
   "classes": [
       {
           "class": "Posts",
           "description": "An post",
           "moduleConfig": {
               "text2vec-transformers": {
                    "skip": False,
                    "vectorizeClassName": False,
                    "vectorizePropertyName": False
                }
           },
           "vectorIndexType": "hnsw",
           "vectorizer": "text2vec-transformers",
           "properties": [
               {
                   "name": "content",
                   "dataType": ["text"],
                   "description": "The text content the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "name",
                   "dataType": ["text"],
                   "description": "The text name the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
                              {
                   "name": "shortName",
                   "dataType": ["text"],
                   "description": "Short summary of the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "shortSummary",
                   "dataType": ["text"],
                   "description": "Short summary of the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "fullSummary",
                   "dataType": ["text"],
                   "description": "Full summary of the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "shortSummaryWithPoints",
                   "dataType": ["text"],
                   "description": "Short summary of the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "fullSummaryWithPoints",
                   "dataType": ["text"],
                   "description": "Full summary of the post",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                "name": "userName",
                "dataType": ["string"],
                "description": "The name of the user who posted the post",
                "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": False,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                }
               },
               {
                   "name": "postId",
                   "dataType": ["int"],
                   "description": "The post number.",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "counter_endorsements_up",
                   "dataType": ["int"],
                   "description": "The up count",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "counter_endorsements_down",
                   "dataType": ["int"],
                   "description": "The up count",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "counter_points_for",
                   "dataType": ["int"],
                   "description": "The up count",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "counter_points_against",
                   "dataType": ["int"],
                   "description": "The down count",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
               {
                   "name": "language",
                   "dataType": ["string"],
                   "description": "Language",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               }
               {
                   "name": "userId",
                   "dataType": ["int"],
                   "description": "The user number.",
                   "moduleConfig": {
                    "text2vec-transformers": {
                        "skip": True,
                        "vectorizePropertyName": False,
                        "vectorizeClassName": False
                    }
                   }
               },
           ]
       }
   ]
}

client.schema.create(schema)