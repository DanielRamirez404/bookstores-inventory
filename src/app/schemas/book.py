from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class BookPayload(BaseModel):
    isbn: Annotated[str, StringConstraints(max_length=20, strip_whitespace=True)]
    author: Annotated[str, StringConstraints(max_length=255, strip_whitespace=True)]
    category: Annotated[str, StringConstraints(max_length=50, strip_whitespace=True)]

    supplier_country: Annotated[
        str, StringConstraints(min_length=2, max_length=3, to_upper=True, strip_whitespace=True)
    ] = Field(description="country code")
    
    cost_usd: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    selling_price_local: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    stock_quantity: int = Field(default=0, ge=0)
