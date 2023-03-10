"""Wrapper around weaviate vector database."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from langchain.docstore.document import Document
from langchain.embeddings.base import Embeddings
from langchain.vectorstores.base import VectorStore
from langchain.vectorstores.weaviate import Weaviate

class YrpriWeaviate(Weaviate):
    def similarity_search_concepts(
        self, concepts: Any, k: int = 4, **kwargs: Any
    ) -> List[Document]:
        """Look up similar documents in weaviate."""
        content: Dict[str, Any] = {"concepts": concepts}
        print(content)
        if kwargs.get("search_distance"):
            content["certainty"] = kwargs.get("search_distance")
        query_obj = self._client.query.get(self._index_name, self._query_attrs)
        result = query_obj.with_near_text(content).with_limit(k).do()
        docs = []
        for res in result["data"]["Get"][self._index_name]:
            text = res.pop(self._text_key)
            docs.append(Document(page_content=text, metadata=res))
        return docs
